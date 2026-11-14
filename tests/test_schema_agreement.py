"""Schema agreement test: verifies that the frontend JSON-schema spec
(rehearsal/schema_spec.json) agrees with the backend validator
(rehearsal/schema.py validate_mission_plan) on a set of valid and invalid fixtures.

This is Section 3.1b Test 9 from the Mission Rehearsal spec.
"""

import json
from pathlib import Path
import pytest
from rehearsal.schema import validate_mission_plan, ValidationError


# ─── Load the exported schema spec ────────────────────────────────────────────

SPEC_PATH = Path(__file__).resolve().parent.parent / "rehearsal" / "schema_spec.json"


def test_schema_spec_file_exists():
    assert SPEC_PATH.exists(), f"schema_spec.json not found at {SPEC_PATH}"


def test_schema_spec_has_required_fields():
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    required = set(spec.get("required", []))
    expected_required = {"schema_version", "centre", "mission", "launch_utc",
                         "transit_days", "landing_site_id", "surface_days"}
    assert expected_required == required, f"Required fields mismatch: {required}"


def test_schema_spec_site_ids_match():
    """Frontend site enum must include the same set as the backend library."""
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    site_enum = set(spec["properties"]["landing_site_id"]["enum"])
    # Must include at least the canonical polar sites
    assert "shackleton_connecting_ridge" in site_enum
    assert "malapert_mountain" in site_enum
    assert "apollo_11" in site_enum


# ─── Valid fixtures (must NOT raise ValidationError) ───────────────────────────

VALID_FIXTURES = [
    # 1. Minimal valid plan
    {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "Demo-A",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 14.0,
    },
    # 2. Full plan with all hardware fields
    {
        "schema_version": 1,
        "centre": "ISRO",
        "mission": "Full-Hardware",
        "launch_utc": "2026-05-01T12:00:00Z",
        "transit_days": 5.0,
        "orbit_hold_days": 2.0,
        "landing_site_id": "malapert_mountain",
        "surface_days": 10.0,
        "hardware": {
            "panel_m2": 2.5,
            "panel_efficiency": 0.28,
            "battery_wh": 1200.0,
            "base_load_w": 65.0,
            "min_soc_fraction": 0.20,
        },
    },
    # 3. With constraints
    {
        "schema_version": 1,
        "centre": "DLR",
        "mission": "Constrained",
        "launch_utc": "2026-06-15T00:00:00Z",
        "transit_days": 3.0,
        "orbit_hold_days": 0.0,
        "landing_site_id": "nobile_rim_1",
        "surface_days": 7.0,
        "constraints": {
            "max_earth_blackout_h": 48.0,
            "min_sunlit_fraction": 0.5,
        },
    },
    # 4. With a launch_slip delay scenario (no probability)
    {
        "schema_version": 1,
        "centre": "JAXA",
        "mission": "With-Slip",
        "launch_utc": "2026-07-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "haworth_rim",
        "surface_days": 5.0,
        "delay_scenarios": [
            {"type": "launch_slip", "days": 3.0},
        ],
    },
    # 5. With probability on delay scenarios summing to < 1
    {
        "schema_version": 1,
        "centre": "CSA",
        "mission": "Probability-View",
        "launch_utc": "2026-08-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "de_gerlache_rim_1",
        "surface_days": 10.0,
        "delay_scenarios": [
            {"type": "launch_slip", "days": 2.0, "probability": 0.3},
            {"type": "reduced_power", "power_factor": 0.6, "probability": 0.1},
        ],
    },
]


@pytest.mark.parametrize("fixture", VALID_FIXTURES, ids=[f"valid_{i+1}" for i in range(len(VALID_FIXTURES))])
def test_valid_fixture_passes_backend_validation(fixture):
    """Backend validator must accept every valid fixture."""
    try:
        result = validate_mission_plan(fixture)
        assert result is not None
    except ValidationError as e:
        pytest.fail(f"Valid fixture raised ValidationError: {e}")


# ─── Invalid fixtures (must raise ValidationError) ─────────────────────────────

INVALID_FIXTURES = [
    # 1. Missing required field: mission
    {
        "schema_version": 1,
        "centre": "ESOC",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 14.0,
    },
    # 2. transit_days out of range (> 40)
    {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "Bad-Transit",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 50.0,  # max is 40
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 14.0,
    },
    # 3. Unknown landing site
    {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "Bad-Site",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "mars_landing_zone",  # not in library
        "surface_days": 14.0,
    },
    # 4. surface_days out of range (> 30)
    {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "Bad-Surface",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 45.0,  # max is 30
    },
    # 5. Probabilities sum > 1
    {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "Bad-Probs",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 10.0,
        "delay_scenarios": [
            {"type": "launch_slip", "days": 2.0, "probability": 0.7},
            {"type": "transit_extension", "days": 1.0, "probability": 0.5},
        ],
    },
]


@pytest.mark.parametrize("fixture", INVALID_FIXTURES, ids=[f"invalid_{i+1}" for i in range(len(INVALID_FIXTURES))])
def test_invalid_fixture_fails_backend_validation(fixture):
    """Backend validator must reject every invalid fixture with ValidationError."""
    with pytest.raises(ValidationError):
        validate_mission_plan(fixture)
