"""Schema validation and normalisation for STELLARON Mission Rehearsal uploads.

Adheres strictly to the Mission Rehearsal Upload Schema (Section 3.1 & 3.1b):
- Reject unknown fields with explicit, actionable error messages.
- Size limit: 1 MB maximum. Parse as data only, never execute.
- Strict numeric ranges and ISO-8601 UTC validation.
- Site IDs validated against data/sites.json.
- Launch date and surface phase end must stay within SPICE kernel ephemeris coverage.
- Probabilities (if present) must sum to <= 1.0; unassigned remainder reported as 'unspecified'.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

MAX_FILE_BYTES: int = 1_048_576  # 1 MB

# High-precision lunar orientation PCK (moon_pa_de421_1900-2050.bpc) coverage range
SPICE_COVERED_START_UTC: str = "1900-01-01T00:00:00Z"
SPICE_COVERED_END_UTC: str = "2049-12-31T23:59:59Z"
SPICE_START_DT = datetime(1900, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
SPICE_END_DT = datetime(2049, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

ALLOWED_DELAY_TYPES = {
    "launch_slip",
    "transit_extension",
    "orbit_hold_extension",
    "landing_retry",
    "reduced_power",
    "comms_outage",
}

DEFAULT_HARDWARE = {
    "panel_m2": 2.5,
    "panel_efficiency": 0.28,
    "battery_wh": 1200.0,
    "base_load_w": 65.0,
    "min_soc_fraction": 0.20,
}

ALLOWED_ROOT_KEYS = {
    "schema_version",
    "centre",
    "mission",
    "launch_utc",
    "transit_days",
    "orbit_hold_days",
    "landing_site_id",
    "surface_days",
    "hardware",
    "constraints",
    "delay_scenarios",
}

ALLOWED_HARDWARE_KEYS = {
    "panel_m2",
    "panel_efficiency",
    "battery_wh",
    "base_load_w",
    "min_soc_fraction",
}

ALLOWED_CONSTRAINTS_KEYS = {
    "max_earth_blackout_h",
    "min_sunlit_fraction",
}

ALLOWED_SCENARIO_KEYS = {
    "type",
    "name",
    "days",
    "power_factor",
    "outage_start_utc",
    "outage_hours",
    "probability",
}


class ValidationError(Exception):
    """Raised when mission upload or form data fails schema validation."""
    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.field = field


def load_valid_site_ids() -> List[str]:
    """Retrieve known lunar landing site IDs from data/sites.json."""
    sites_path = Path(__file__).resolve().parent.parent / "data" / "sites.json"
    if not sites_path.exists():
        # Fallback to web public data if data/sites.json is not present
        sites_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "library_index.json"
        if not sites_path.exists():
            return []
        data = json.loads(sites_path.read_text(encoding="utf-8"))
        return [s["id"] for s in data.get("sites", [])]
    data = json.loads(sites_path.read_text(encoding="utf-8"))
    return [s["id"] for s in data]


def parse_iso8601_utc(dt_str: str, field_name: str = "launch_utc") -> datetime:
    """Parse ISO-8601 UTC timestamp string, requiring explicit UTC or Z."""
    if not isinstance(dt_str, str) or not dt_str.strip():
        raise ValidationError(f"Field '{field_name}' must be a non-empty ISO-8601 UTC string.", field=field_name)

    cleaned = dt_str.strip()
    # Normalize trailing Z to +00:00
    if cleaned.endswith("Z") or cleaned.endswith("z"):
        cleaned = cleaned[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(cleaned)
    except ValueError as e:
        raise ValidationError(
            f"Invalid ISO-8601 datetime format for '{field_name}': '{dt_str}'. Expected format YYYY-MM-DDTHH:MM:SSZ.",
            field=field_name,
        ) from e

    if dt.tzinfo is None:
        raise ValidationError(
            f"Timezone missing on '{field_name}': '{dt_str}'. UTC timezone offset (e.g. 'Z' or '+00:00') is required.",
            field=field_name,
        )

    return dt.astimezone(timezone.utc)


def validate_mission_plan(
    raw_input: Union[str, bytes, Dict[str, Any]],
    known_site_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Validate and normalise a mission rehearsal input payload.

    Args:
        raw_input: Raw JSON string, raw bytes, or pre-parsed dictionary.
        known_site_ids: Optional list of valid site IDs. If None, loads from data/sites.json.

    Returns:
        Normalized mission plan dictionary with defaults filled and probabilities summarized.

    Raises:
        ValidationError: If any schema, constraint, or range rule is violated.
    """
    # 1. Size check on raw bytes
    if isinstance(raw_input, bytes):
        if len(raw_input) > MAX_FILE_BYTES:
            raise ValidationError(
                f"File size ({len(raw_input):,} bytes) exceeds 1 MB limit ({MAX_FILE_BYTES:,} bytes).",
                field="file_size",
            )
        try:
            raw_data = json.loads(raw_input.decode("utf-8"))
        except Exception as e:
            raise ValidationError(f"Malformed JSON data: {e}", field="json") from e
    elif isinstance(raw_input, str):
        if len(raw_input.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValidationError(
                f"Payload size ({len(raw_input.encode('utf-8')):,} bytes) exceeds 1 MB limit.",
                field="file_size",
            )
        try:
            raw_data = json.loads(raw_input)
        except Exception as e:
            raise ValidationError(f"Malformed JSON data: {e}", field="json") from e
    elif isinstance(raw_input, dict):
        raw_data = raw_input
    else:
        raise ValidationError("Input must be a JSON string, bytes, or dictionary.", field="input_type")

    if not isinstance(raw_data, dict):
        raise ValidationError("Top-level JSON payload must be an object.", field="root")

    # 2. Reject unknown root keys
    unknown_root = set(raw_data.keys()) - ALLOWED_ROOT_KEYS
    if unknown_root:
        raise ValidationError(
            f"Unknown field(s) in upload: {', '.join(sorted(unknown_root))}. Allowed fields: {', '.join(sorted(ALLOWED_ROOT_KEYS))}.",
            field=sorted(unknown_root)[0],
        )

    # 3. Required top-level fields
    required_fields = ["schema_version", "centre", "mission", "launch_utc", "transit_days", "landing_site_id", "surface_days"]
    for req in required_fields:
        if req not in raw_data:
            raise ValidationError(f"Missing required field: '{req}'.", field=req)

    # Schema version
    if raw_data["schema_version"] != 1:
        raise ValidationError(
            f"Unsupported schema_version: {raw_data['schema_version']}. Supported version is 1.",
            field="schema_version",
        )

    # Centre & Mission non-empty strings
    centre = raw_data["centre"]
    if not isinstance(centre, str) or not centre.strip():
        raise ValidationError("Field 'centre' must be a non-empty string.", field="centre")
    mission = raw_data["mission"]
    if not isinstance(mission, str) or not mission.strip():
        raise ValidationError("Field 'mission' must be a non-empty string.", field="mission")

    # Durations
    transit_days = raw_data["transit_days"]
    if not isinstance(transit_days, (int, float)) or isinstance(transit_days, bool) or not (1 <= transit_days <= 40):
        raise ValidationError(
            f"Field 'transit_days' must be a number between 1 and 40 (got {transit_days}).",
            field="transit_days",
        )

    orbit_hold_days = raw_data.get("orbit_hold_days", 0)
    if not isinstance(orbit_hold_days, (int, float)) or isinstance(orbit_hold_days, bool) or not (0 <= orbit_hold_days <= 30):
        raise ValidationError(
            f"Field 'orbit_hold_days' must be a number between 0 and 30 (got {orbit_hold_days}).",
            field="orbit_hold_days",
        )

    surface_days = raw_data["surface_days"]
    if not isinstance(surface_days, (int, float)) or isinstance(surface_days, bool) or not (1 <= surface_days <= 30):
        raise ValidationError(
            f"Field 'surface_days' must be a number between 1 and 30 (got {surface_days}).",
            field="surface_days",
        )

    # Site validation
    site_id = raw_data["landing_site_id"]
    if not isinstance(site_id, str) or not site_id.strip():
        raise ValidationError("Field 'landing_site_id' must be a non-empty string.", field="landing_site_id")

    valid_sites = known_site_ids if known_site_ids is not None else load_valid_site_ids()
    if valid_sites and site_id not in valid_sites:
        raise ValidationError(
            f"Landing site '{site_id}' not found in library. Available sites: {', '.join(sorted(valid_sites))}.",
            field="landing_site_id",
        )

    # Launch UTC & Ephemeris Coverage
    launch_dt = parse_iso8601_utc(raw_data["launch_utc"], field_name="launch_utc")
    if launch_dt < SPICE_START_DT or launch_dt > SPICE_END_DT:
        raise ValidationError(
            f"Launch date is outside the ephemeris coverage (covered: 1900-01-01 to 2049-12-31). Got: {raw_data['launch_utc']}.",
            field="launch_utc",
        )

    # Check surface-phase end falls within ephemeris coverage
    from datetime import timedelta
    total_mission_days = transit_days + orbit_hold_days + surface_days
    surface_end_dt = launch_dt + timedelta(days=float(total_mission_days))
    if surface_end_dt > SPICE_END_DT:
        raise ValidationError(
            f"Surface-phase end date ({surface_end_dt.isoformat()}) exceeds SPICE coverage limit (2049-12-31).",
            field="surface_days",
        )

    # 4. Hardware Configuration
    raw_hw = raw_data.get("hardware", {})
    if not isinstance(raw_hw, dict):
        raise ValidationError("Field 'hardware' must be an object.", field="hardware")

    unknown_hw = set(raw_hw.keys()) - ALLOWED_HARDWARE_KEYS
    if unknown_hw:
        raise ValidationError(
            f"Unknown field(s) in hardware: {', '.join(sorted(unknown_hw))}. Allowed: {', '.join(sorted(ALLOWED_HARDWARE_KEYS))}.",
            field=sorted(unknown_hw)[0],
        )

    hardware = {
        "panel_m2": float(raw_hw.get("panel_m2", DEFAULT_HARDWARE["panel_m2"])),
        "panel_efficiency": float(raw_hw.get("panel_efficiency", DEFAULT_HARDWARE["panel_efficiency"])),
        "battery_wh": float(raw_hw.get("battery_wh", DEFAULT_HARDWARE["battery_wh"])),
        "base_load_w": float(raw_hw.get("base_load_w", DEFAULT_HARDWARE["base_load_w"])),
        "min_soc_fraction": float(raw_hw.get("min_soc_fraction", DEFAULT_HARDWARE["min_soc_fraction"])),
    }

    if hardware["panel_m2"] <= 0:
        raise ValidationError("hardware.panel_m2 must be greater than 0.", field="hardware.panel_m2")
    if not (0.0 < hardware["panel_efficiency"] <= 1.0):
        raise ValidationError("hardware.panel_efficiency must be in (0, 1].", field="hardware.panel_efficiency")
    if hardware["battery_wh"] <= 0:
        raise ValidationError("hardware.battery_wh must be greater than 0.", field="hardware.battery_wh")
    if hardware["base_load_w"] < 0:
        raise ValidationError("hardware.base_load_w must be non-negative.", field="hardware.base_load_w")
    if not (0.0 <= hardware["min_soc_fraction"] <= 1.0):
        raise ValidationError("hardware.min_soc_fraction must be in [0, 1].", field="hardware.min_soc_fraction")

    # 5. Constraints
    raw_constraints = raw_data.get("constraints", {})
    if not isinstance(raw_constraints, dict):
        raise ValidationError("Field 'constraints' must be an object.", field="constraints")

    unknown_constraints = set(raw_constraints.keys()) - ALLOWED_CONSTRAINTS_KEYS
    if unknown_constraints:
        raise ValidationError(
            f"Unknown field(s) in constraints: {', '.join(sorted(unknown_constraints))}.",
            field=sorted(unknown_constraints)[0],
        )

    constraints: Dict[str, Any] = {}
    if "max_earth_blackout_h" in raw_constraints:
        v = raw_constraints["max_earth_blackout_h"]
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0:
            raise ValidationError("constraints.max_earth_blackout_h must be a positive number.", field="constraints.max_earth_blackout_h")
        constraints["max_earth_blackout_h"] = float(v)

    if "min_sunlit_fraction" in raw_constraints:
        v = raw_constraints["min_sunlit_fraction"]
        if not isinstance(v, (int, float)) or isinstance(v, bool) or not (0.0 <= v <= 1.0):
            raise ValidationError("constraints.min_sunlit_fraction must be between 0.0 and 1.0.", field="constraints.min_sunlit_fraction")
        constraints["min_sunlit_fraction"] = float(v)

    # 6. Delay Scenarios
    raw_scenarios = raw_data.get("delay_scenarios", [])
    if not isinstance(raw_scenarios, list):
        raise ValidationError("Field 'delay_scenarios' must be an array.", field="delay_scenarios")

    if len(raw_scenarios) > 8:
        raise ValidationError(f"Maximum of 8 delay scenarios allowed (got {len(raw_scenarios)}).", field="delay_scenarios")

    scenarios: List[Dict[str, Any]] = []
    prob_sum = 0.0
    has_any_prob = False
    all_have_prob = len(raw_scenarios) > 0

    for idx, sc in enumerate(raw_scenarios):
        if not isinstance(sc, dict):
            raise ValidationError(f"delay_scenarios[{idx}] must be an object.", field=f"delay_scenarios[{idx}]")

        unknown_sc = set(sc.keys()) - ALLOWED_SCENARIO_KEYS
        if unknown_sc:
            raise ValidationError(
                f"Unknown field(s) in delay_scenarios[{idx}]: {', '.join(sorted(unknown_sc))}.",
                field=f"delay_scenarios[{idx}].{sorted(unknown_sc)[0]}",
            )

        sc_type = sc.get("type")
        if sc_type not in ALLOWED_DELAY_TYPES:
            raise ValidationError(
                f"Invalid scenario type '{sc_type}' in delay_scenarios[{idx}]. Allowed: {', '.join(sorted(ALLOWED_DELAY_TYPES))}.",
                field=f"delay_scenarios[{idx}].type",
            )

        norm_sc: Dict[str, Any] = {"type": sc_type}
        if "name" in sc and isinstance(sc["name"], str):
            norm_sc["name"] = sc["name"].strip()
        else:
            norm_sc["name"] = f"Scenario {idx + 1}: {sc_type.replace('_', ' ').title()}"

        # Type-specific validation
        if sc_type in {"launch_slip", "transit_extension", "orbit_hold_extension", "landing_retry"}:
            days_val = sc.get("days", 0)
            if not isinstance(days_val, (int, float)) or isinstance(days_val, bool) or days_val < 0:
                raise ValidationError(
                    f"delay_scenarios[{idx}].days must be a non-negative number.",
                    field=f"delay_scenarios[{idx}].days",
                )
            norm_sc["days"] = float(days_val)

        elif sc_type == "reduced_power":
            pf = sc.get("power_factor", 1.0)
            if not isinstance(pf, (int, float)) or isinstance(pf, bool) or not (0.0 <= pf <= 1.0):
                raise ValidationError(
                    f"delay_scenarios[{idx}].power_factor must be between 0.0 and 1.0.",
                    field=f"delay_scenarios[{idx}].power_factor",
                )
            norm_sc["power_factor"] = float(pf)

        elif sc_type == "comms_outage":
            if "outage_hours" in sc:
                oh = sc["outage_hours"]
                if not isinstance(oh, (int, float)) or isinstance(oh, bool) or oh < 0:
                    raise ValidationError(
                        f"delay_scenarios[{idx}].outage_hours must be a non-negative number.",
                        field=f"delay_scenarios[{idx}].outage_hours",
                    )
                norm_sc["outage_hours"] = float(oh)
            else:
                norm_sc["outage_hours"] = 24.0

            if "outage_start_utc" in sc and sc["outage_start_utc"]:
                outage_dt = parse_iso8601_utc(sc["outage_start_utc"], field_name=f"delay_scenarios[{idx}].outage_start_utc")
                norm_sc["outage_start_utc"] = outage_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Probability (optional, user supplied)
        if "probability" in sc and sc["probability"] is not None:
            has_any_prob = True
            p = sc["probability"]
            if not isinstance(p, (int, float)) or isinstance(p, bool) or not (0.0 <= p <= 1.0):
                raise ValidationError(
                    f"delay_scenarios[{idx}].probability must be between 0.0 and 1.0.",
                    field=f"delay_scenarios[{idx}].probability",
                )
            norm_sc["probability"] = float(p)
            prob_sum += float(p)
        else:
            all_have_prob = False

        scenarios.append(norm_sc)

    # Probabilities rule: if present, sum must be <= 1 (±1e-6)
    if has_any_prob and prob_sum > 1.0 + 1e-6:
        raise ValidationError(
            f"Scenario probabilities sum to {prob_sum:.4f}, which exceeds 1.0. Total probability cannot exceed 100%.",
            field="delay_scenarios.probability",
        )

    unassigned_prob = max(0.0, 1.0 - prob_sum) if has_any_prob else 1.0

    return {
        "schema_version": 1,
        "centre": centre.strip(),
        "mission": mission.strip(),
        "launch_utc": launch_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "transit_days": float(transit_days),
        "orbit_hold_days": float(orbit_hold_days),
        "landing_site_id": site_id,
        "surface_days": float(surface_days),
        "hardware": hardware,
        "constraints": constraints,
        "delay_scenarios": scenarios,
        "_meta": {
            "assigned_probability": round(prob_sum, 6) if has_any_prob else 0.0,
            "unspecified_probability": round(unassigned_prob, 6) if has_any_prob else 1.0,
            "all_scenarios_have_probability": all_have_prob,
        },
    }


def generate_json_schema() -> Dict[str, Any]:
    """Generate canonical JSON Schema object for frontend form validation parity."""
    valid_sites = load_valid_site_ids()
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "STELLARON_Mission_Plan",
        "type": "object",
        "required": ["schema_version", "centre", "mission", "launch_utc", "transit_days", "landing_site_id", "surface_days"],
        "additionalProperties": False,
        "properties": {
            "schema_version": {"type": "integer", "enum": [1]},
            "centre": {"type": "string", "minLength": 1},
            "mission": {"type": "string", "minLength": 1},
            "launch_utc": {"type": "string", "format": "date-time"},
            "transit_days": {"type": "number", "minimum": 1, "maximum": 40},
            "orbit_hold_days": {"type": "number", "minimum": 0, "maximum": 30, "default": 0},
            "landing_site_id": {"type": "string", "enum": valid_sites},
            "surface_days": {"type": "number", "minimum": 1, "maximum": 30},
            "hardware": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "panel_m2": {"type": "number", "exclusiveMinimum": 0, "default": 2.5},
                    "panel_efficiency": {"type": "number", "exclusiveMinimum": 0, "maximum": 1.0, "default": 0.28},
                    "battery_wh": {"type": "number", "exclusiveMinimum": 0, "default": 1200.0},
                    "base_load_w": {"type": "number", "minimum": 0, "default": 65.0},
                    "min_soc_fraction": {"type": "number", "minimum": 0, "maximum": 1.0, "default": 0.20},
                },
            },
            "constraints": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "max_earth_blackout_h": {"type": "number", "exclusiveMinimum": 0},
                    "min_sunlit_fraction": {"type": "number", "minimum": 0, "maximum": 1.0},
                },
            },
            "delay_scenarios": {
                "type": "array",
                "maxItems": 8,
                "items": {
                    "type": "object",
                    "required": ["type"],
                    "additionalProperties": False,
                    "properties": {
                        "type": {"type": "string", "enum": sorted(list(ALLOWED_DELAY_TYPES))},
                        "name": {"type": "string"},
                        "days": {"type": "number", "minimum": 0},
                        "power_factor": {"type": "number", "minimum": 0, "maximum": 1.0},
                        "outage_start_utc": {"type": "string", "format": "date-time"},
                        "outage_hours": {"type": "number", "minimum": 0},
                        "probability": {"type": "number", "minimum": 0, "maximum": 1.0},
                    },
                },
            },
        },
    }


def write_schema_spec_json(dest_path: Optional[Union[str, Path]] = None) -> Path:
    """Write schema_spec.json for the frontend validator."""
    if dest_path is None:
        dest_path = Path(__file__).resolve().parent / "schema_spec.json"
    else:
        dest_path = Path(dest_path)
    spec = generate_json_schema()
    dest_path.write_text(json.dumps(spec, indent=2, sort_keys=True), encoding="utf-8")
    return dest_path


if __name__ == "__main__":
    out_file = write_schema_spec_json()
    print(f"Generated schema specification: {out_file}")
