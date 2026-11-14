"""Compare module for STELLARON Mission Rehearsal (Section 4).

Supports comparing up to 3 missions or 2 dates side by side.
Outputs are sorted by date or alphabetically. Never uses 'recommended',
'best', 'optimal', 'predicted', or 'guaranteed'.
"""

from typing import Any, Dict, List, Optional

from rehearsal.surface import evaluate_surface
from rehearsal.timeline import compute_timeline
from engine.celestial import CelestialEngine


def compare_scenarios(
    plan: Dict[str, Any],
    scenario_results: List[Dict[str, Any]],
    step_s: float = 1800.0,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> Dict[str, Any]:
    """Compare up to 3 scenario-modified plans side by side.

    Args:
        plan: Original baseline plan (for provenance).
        scenario_results: List from apply_all_scenarios; max 3 entries compared.
        step_s: Physical evaluation time step.
        celestial_engine: Reusable CelestialEngine instance.
        engine_stub: Optional deterministic engine stub for unit tests.

    Returns:
        Dict with scenario comparisons and a summary table.
    """
    max_compare = 3
    to_compare = scenario_results[:max_compare]

    if engine_stub is None and celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    comparisons: List[Dict[str, Any]] = []

    for entry in to_compare:
        mod_plan = entry["modified_plan"]
        timeline = compute_timeline(mod_plan)
        landing_utc = timeline["milestones"]["landing_utc"]

        surface_result = evaluate_surface(
            site_id=mod_plan["landing_site_id"],
            landing_t=landing_utc,
            surface_days=float(mod_plan["surface_days"]),
            hardware=mod_plan.get("hardware", {}),
            constraints=mod_plan.get("constraints", {}),
            step_s=step_s,
            celestial_engine=celestial_engine,
            engine_stub=engine_stub,
        )

        comparisons.append({
            "label": entry["label"],
            "change_sentence": entry["change_sentence"],
            "landing_utc": landing_utc,
            "verdict": surface_result["verdict"],
            "limiting_factor": surface_result["limiting_factor"],
            "metrics": surface_result["metrics"],
        })

    # Sort by landing date (chronological)
    comparisons.sort(key=lambda c: c["landing_utc"])

    # Build compact summary table
    summary_table = []
    for c in comparisons:
        m = c["metrics"]
        summary_table.append({
            "label": c["label"],
            "landing_utc": c["landing_utc"],
            "verdict": c["verdict"],
            "min_soc": m.get("minimum_soc", 0.0),
            "sunlit_hours": m.get("sunlit_hours", 0.0),
            "longest_blackout_h": m.get("longest_earth_blackout_h", 0.0),
            "limiting_factor": c["limiting_factor"],
        })

    return {
        "compared_count": len(comparisons),
        "comparisons": comparisons,
        "summary_table": summary_table,
        "note": "Sorted by modelled landing date. Results are conditional on the supplied inputs.",
    }


def compare_dates(
    plan: Dict[str, Any],
    date_offsets: List[int],
    step_s: float = 1800.0,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> Dict[str, Any]:
    """Compare the same mission across 2 different landing dates.

    Args:
        plan: Validated baseline mission plan.
        date_offsets: List of integer day offsets from baseline landing (max 2).
        step_s: Physical evaluation time step.
        celestial_engine: Reusable CelestialEngine instance.
        engine_stub: Optional deterministic engine stub for unit tests.

    Returns:
        Dict with date comparisons.
    """
    from rehearsal.surface import parse_utc_dt, format_utc_iso
    from datetime import timedelta

    max_dates = 2
    offsets = date_offsets[:max_dates]

    timeline = compute_timeline(plan)
    baseline_landing_utc = timeline["milestones"]["landing_utc"]
    baseline_landing_dt = parse_utc_dt(baseline_landing_utc)

    if engine_stub is None and celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    comparisons: List[Dict[str, Any]] = []

    for offset in offsets:
        landing_dt = baseline_landing_dt + timedelta(days=float(offset))
        landing_utc = format_utc_iso(landing_dt)

        surface_result = evaluate_surface(
            site_id=plan["landing_site_id"],
            landing_t=landing_utc,
            surface_days=float(plan["surface_days"]),
            hardware=plan.get("hardware", {}),
            constraints=plan.get("constraints", {}),
            step_s=step_s,
            celestial_engine=celestial_engine,
            engine_stub=engine_stub,
        )

        comparisons.append({
            "label": f"Landing +{offset}d" if offset >= 0 else f"Landing {offset}d",
            "offset_days": offset,
            "landing_utc": landing_utc,
            "verdict": surface_result["verdict"],
            "limiting_factor": surface_result["limiting_factor"],
            "metrics": surface_result["metrics"],
        })

    comparisons.sort(key=lambda c: c["landing_utc"])

    return {
        "baseline_landing_utc": baseline_landing_utc,
        "compared_count": len(comparisons),
        "comparisons": comparisons,
        "note": "Sorted by modelled landing date. Results are conditional on the supplied inputs.",
    }
