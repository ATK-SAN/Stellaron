"""Slip calendar sweep module for STELLARON Mission Rehearsal (Section 4).

Sweeps landing date over [-back_days, +forward_days] in 1-day steps
(default: -5..+60 days, up to 120 days).
Reuses site horizon profile and loaded SPICE ephemeris kernels for high performance.
Computes tolerance_days_forward (consecutive non-failing days starting from baseline)
and next_pass_window (first date after failure where verdict returns to survives).
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union

from engine.celestial import CelestialEngine
from rehearsal.surface import evaluate_surface, parse_utc_dt, format_utc_iso
from rehearsal.timeline import compute_timeline


def compute_slip_calendar(
    plan: Dict[str, Any],
    back_days: int = 5,
    forward_days: int = 60,
    step_days: int = 1,
    step_s: float = 1800.0,
    soc_margin: float = 0.10,
    blackout_margin_fraction: float = 0.10,
    sunlit_margin: float = 0.05,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> Dict[str, Any]:
    """Execute landing date sweep across [-back_days, +forward_days].

    Args:
        plan: Validated mission plan dictionary.
        back_days: Number of days to sweep prior to nominal landing (>= 0).
        forward_days: Number of days to sweep following nominal landing (>= 0, max 120).
        step_days: Step size in days (default 1).
        step_s: Physical evaluation time step in seconds (default 1800.0s = 30m).
        soc_margin: Margin above reserve SoC for marginal classification.
        blackout_margin_fraction: Margin below blackout limit for marginal classification.
        sunlit_margin: Margin above min sunlit fraction for marginal classification.
        celestial_engine: Reusable CelestialEngine instance with loaded kernels.
        engine_stub: Optional deterministic engine stub for unit tests.

    Returns:
        Dictionary containing baseline landing UTC, tolerance metrics, and array of cells.
    """
    back_days = max(0, int(back_days))
    forward_days = min(120, max(0, int(forward_days)))
    step_days = max(1, int(step_days))

    # Baseline nominal timeline
    timeline = compute_timeline(plan)
    baseline_landing_utc = timeline["milestones"]["landing_utc"]
    baseline_landing_dt = parse_utc_dt(baseline_landing_utc)

    site_id = plan["landing_site_id"]
    surface_days = float(plan["surface_days"])
    hardware = plan.get("hardware", {})
    constraints = plan.get("constraints", {})

    # Reuse celestial engine across all sweep steps if not using stub
    if engine_stub is None and celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    cells: List[Dict[str, Any]] = []
    offsets = list(range(-back_days, forward_days + 1, step_days))

    for offset in offsets:
        cur_landing_dt = baseline_landing_dt + timedelta(days=float(offset))
        cur_landing_utc = format_utc_iso(cur_landing_dt)

        res = evaluate_surface(
            site_id=site_id,
            landing_t=cur_landing_utc,
            surface_days=surface_days,
            hardware=hardware,
            constraints=constraints,
            step_s=step_s,
            soc_margin=soc_margin,
            blackout_margin_fraction=blackout_margin_fraction,
            sunlit_margin=sunlit_margin,
            celestial_engine=celestial_engine,
            engine_stub=engine_stub,
        )

        metrics = res.get("metrics", {})
        cells.append({
            "offset_days": offset,
            "date_utc": cur_landing_utc,
            "verdict": res.get("verdict", "fails"),
            "min_soc": metrics.get("minimum_soc", 0.0),
            "sunlit_hours": metrics.get("sunlit_hours", 0.0),
            "blackout_hours": metrics.get("longest_earth_blackout_h", 0.0),
            "limiting_factor": res.get("limiting_factor", "none"),
        })

    # Analysis of tolerance starting at offset 0 (nominal baseline)
    cell_map = {c["offset_days"]: c for c in cells}
    forward_offsets = sorted([o for o in offsets if o >= 0])

    tolerance_days_forward = 0
    first_failing_offset: Optional[int] = None
    first_failing_landing_utc: Optional[str] = None
    next_pass_window_utc: Optional[str] = None
    next_pass_window_offset: Optional[int] = None

    # Check baseline status
    baseline_cell = cell_map.get(0, cells[0] if cells else {})
    if baseline_cell.get("verdict") == "fails":
        tolerance_days_forward = 0
        first_failing_offset = 0
        first_failing_landing_utc = baseline_cell.get("date_utc")
    else:
        # Count consecutive non-failing days starting from baseline
        consecutive_non_fail = 0
        for off in forward_offsets:
            cell = cell_map[off]
            if cell["verdict"] == "fails":
                first_failing_offset = off
                first_failing_landing_utc = cell["date_utc"]
                break
            consecutive_non_fail += 1

        if first_failing_offset is None:
            # All tested forward offsets passed
            tolerance_days_forward = forward_offsets[-1] if forward_offsets else 0
        else:
            # Tolerance is how many days after baseline before the first failure
            tolerance_days_forward = first_failing_offset - 1

    # Find next_pass_window: first date after failure where verdict returns to survives
    if first_failing_offset is not None:
        for off in forward_offsets:
            if off > first_failing_offset:
                cell = cell_map[off]
                if cell["verdict"] == "survives":
                    next_pass_window_offset = off
                    next_pass_window_utc = cell["date_utc"]
                    break

    return {
        "baseline_landing_utc": baseline_landing_utc,
        "site_id": site_id,
        "surface_days": surface_days,
        "sweep_range_days": [-back_days, forward_days],
        "tolerance_days_forward": tolerance_days_forward,
        "first_failing_offset_days": first_failing_offset,
        "first_failing_landing_utc": first_failing_landing_utc,
        "next_pass_window_offset_days": next_pass_window_offset,
        "next_pass_window_utc": next_pass_window_utc,
        "cells": cells,
    }
