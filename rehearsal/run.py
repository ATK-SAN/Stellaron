"""Full rehearsal run pipeline for STELLARON Mission Rehearsal (Section 4).

Orchestrates: validate -> timeline -> surface evaluation -> slip calendar ->
decision gates -> scenario compare -> result JSON with provenance and sha256.

Writes result JSON with provenance and result_sha256.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from engine.celestial import CelestialEngine
from rehearsal.schema import validate_mission_plan, ValidationError
from rehearsal.timeline import compute_timeline
from rehearsal.surface import evaluate_surface
from rehearsal.slip import compute_slip_calendar
from rehearsal.gates import evaluate_decision_gates
from rehearsal.scenarios import apply_all_scenarios
from rehearsal.compare import compare_scenarios


# STELLARON version string
STELLARON_VERSION = "2.0.0-rehearsal"


def _compute_sha256(data: dict) -> str:
    """Deterministic SHA-256 of JSON-serialisable result data."""
    canonical = json.dumps(data, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def run_rehearsal(
    plan_input: Dict[str, Any],
    back_days: int = 5,
    forward_days: int = 60,
    step_s: float = 600.0,
    slip_step_s: float = 1800.0,
    output_path: Optional[str] = None,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> Dict[str, Any]:
    """Execute the full mission rehearsal pipeline.

    Args:
        plan_input: Raw mission plan dict (will be validated).
        back_days: Slip calendar backward sweep days.
        forward_days: Slip calendar forward sweep days.
        step_s: Surface evaluation time step (seconds).
        slip_step_s: Slip calendar evaluation time step (seconds).
        output_path: Optional path to write result JSON.
        celestial_engine: Optional reusable CelestialEngine instance.
        engine_stub: Optional deterministic engine stub for testing.

    Returns:
        Complete rehearsal result dictionary.
    """
    run_id = str(uuid.uuid4())
    run_timestamp = datetime.now(timezone.utc).isoformat()

    # 1. Validate
    try:
        plan = validate_mission_plan(plan_input)
    except ValidationError as e:
        return {
            "run_id": run_id,
            "status": "validation_error",
            "errors": [str(e)],
            "timestamp_utc": run_timestamp,
        }

    # 2. Load SPICE once
    if engine_stub is None and celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    # 3. Baseline timeline
    timeline = compute_timeline(plan)

    # 4. Baseline surface evaluation
    landing_utc = timeline["milestones"]["landing_utc"]
    baseline_surface = evaluate_surface(
        site_id=plan["landing_site_id"],
        landing_t=landing_utc,
        surface_days=float(plan["surface_days"]),
        hardware=plan.get("hardware", {}),
        constraints=plan.get("constraints", {}),
        step_s=step_s,
        celestial_engine=celestial_engine,
        engine_stub=engine_stub,
    )

    # 5. Slip calendar
    slip_calendar = compute_slip_calendar(
        plan=plan,
        back_days=back_days,
        forward_days=forward_days,
        step_s=slip_step_s,
        celestial_engine=celestial_engine,
        engine_stub=engine_stub,
    )

    # 6. Decision gates
    decision_gates = evaluate_decision_gates(
        plan=plan,
        slip_calendar=slip_calendar,
        celestial_engine=celestial_engine,
        engine_stub=engine_stub,
    )

    # 7. Scenario comparison (if delay_scenarios present)
    delay_scenarios = plan.get("delay_scenarios", [])
    scenario_results = apply_all_scenarios(plan, delay_scenarios)
    comparison = None
    if len(scenario_results) > 1:
        comparison = compare_scenarios(
            plan=plan,
            scenario_results=scenario_results,
            step_s=slip_step_s,
            celestial_engine=celestial_engine,
            engine_stub=engine_stub,
        )

    # 8. Probability view (only if user supplied probabilities)
    probability_view = None
    if delay_scenarios and any(s.get("probability") is not None for s in delay_scenarios):
        prob_entries = []
        total_prob = 0.0
        for entry in scenario_results:
            sc = entry.get("scenario")
            if sc is not None and sc.get("probability") is not None:
                p = float(sc["probability"])
                total_prob += p
                prob_entries.append({
                    "label": entry["label"],
                    "probability": p,
                    "change_sentence": entry["change_sentence"],
                })
        unspecified = round(1.0 - total_prob, 6)
        probability_view = {
            "entries": prob_entries,
            "total_specified": round(total_prob, 6),
            "unspecified_remainder": max(0.0, unspecified),
            "note": "Probabilities are conditional on your inputs. "
                    "STELLARON does not estimate likelihood.",
        }

    # 9. Assemble result
    result_data = {
        "baseline": {
            "timeline": timeline,
            "surface": baseline_surface,
        },
        "slip_calendar": slip_calendar,
        "decision_gates": decision_gates,
        "comparison": comparison,
        "probability_view": probability_view,
    }

    result_sha256 = _compute_sha256(result_data)

    result = {
        "run_id": run_id,
        "status": "complete",
        "timestamp_utc": run_timestamp,
        "stellaron_version": STELLARON_VERSION,
        "input_plan": {
            "centre": plan.get("centre"),
            "mission": plan.get("mission"),
            "launch_utc": plan.get("launch_utc"),
            "landing_site_id": plan.get("landing_site_id"),
            "surface_days": plan.get("surface_days"),
        },
        "verdict": baseline_surface.get("verdict"),
        "limiting_factor": baseline_surface.get("limiting_factor"),
        "result_sha256": result_sha256,
        **result_data,
        "provenance": {
            "stellaron_version": STELLARON_VERSION,
            "ephemeris_kernel": "de421.bsp",
            "dem_product": "synthetic_parametric",
            "limb_convention": "upper_limb_0.26deg",
            "model_note": "Modelled surface conditions; schematic transit phases. "
                          "Illustrative path, not a trajectory design.",
            "thresholds_used": {
                "min_soc_fraction": plan.get("hardware", {}).get("min_soc_fraction", 0.20),
                "max_earth_blackout_h": plan.get("constraints", {}).get("max_earth_blackout_h"),
                "min_sunlit_fraction": plan.get("constraints", {}).get("min_sunlit_fraction"),
            },
        },
    }

    # 10. Write JSON output
    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(result, indent=2, default=str, ensure_ascii=False),
            encoding="utf-8",
        )

    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m rehearsal.run <plan.json> [output.json]")
        sys.exit(1)

    plan_path = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else None

    with open(plan_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    result = run_rehearsal(raw, output_path=output)

    if result["status"] == "validation_error":
        print("Validation errors:")
        for e in result["errors"]:
            print(f"  - {e}")
        sys.exit(1)

    print(f"Verdict: {result['verdict']}")
    print(f"Limiting factor: {result['limiting_factor']}")
    print(f"Result SHA-256: {result['result_sha256']}")
    if output:
        print(f"Written to: {output}")
