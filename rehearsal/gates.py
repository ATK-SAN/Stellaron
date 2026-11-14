"""Decision gates module for STELLARON Mission Rehearsal (Section 4).

Evaluates the four mission decision gates:
1. PRE_LAUNCH (launch_t)
2. POST_LAUNCH (launch_t + transit)
3. LUNAR_ORBIT_ARRIVAL (orbit_arrival_t)
4. PRE_DESCENT (descent_t)

For each gate, calculates:
- time_utc: Gate timestamp in UTC
- slip_so_far_days: Delay absorbed up to this decision gate
- remaining_tolerance_days: Additional slip that can still be absorbed before surface phase fails
- first_failing_landing_utc: Exact landing timestamp of the first failing date
"""

from typing import Any, Dict, List, Optional

from engine.celestial import CelestialEngine
from rehearsal.slip import compute_slip_calendar
from rehearsal.timeline import compute_timeline


GATE_NAMES = {
    "PRE_LAUNCH": "Pre-Launch Hold",
    "POST_LAUNCH": "Post-Launch Injection",
    "LUNAR_ORBIT_ARRIVAL": "Lunar Orbit Arrival",
    "PRE_DESCENT": "Pre-Descent Checkout",
}


def evaluate_decision_gates(
    plan: Dict[str, Any],
    slip_calendar: Optional[Dict[str, Any]] = None,
    scenario: Optional[Dict[str, Any]] = None,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """Compute status for the four mission decision gates.

    Args:
        plan: Validated mission plan dictionary.
        slip_calendar: Optional precomputed slip calendar. Computed if omitted.
        scenario: Optional delay scenario perturbing the nominal timeline.
        celestial_engine: Optional CelestialEngine instance.
        engine_stub: Optional deterministic engine stub for unit tests.

    Returns:
        List of 4 gate records:
        [{
            "gate": "PRE_LAUNCH" | "POST_LAUNCH" | "LUNAR_ORBIT_ARRIVAL" | "PRE_DESCENT",
            "name": str,
            "time_utc": ISO-8601 UTC string,
            "slip_so_far_days": float,
            "remaining_tolerance_days": int,
            "first_failing_landing_utc": Optional[str],
        }]
    """
    if slip_calendar is None:
        slip_calendar = compute_slip_calendar(
            plan=plan,
            celestial_engine=celestial_engine,
            engine_stub=engine_stub,
        )

    # Compute timeline for the perturbed (or baseline) scenario
    timeline = compute_timeline(plan, scenario=scenario)
    milestones = timeline["milestones"]

    # Compute cumulative slip accumulated at each gate
    slip_type = scenario.get("type") if scenario else None
    slip_days = float(scenario.get("days", 0.0)) if scenario else 0.0

    slip_launch = slip_days if slip_type == "launch_slip" else 0.0
    slip_transit = slip_days if slip_type == "transit_extension" else 0.0
    slip_orbit = slip_days if slip_type == "orbit_hold_extension" else 0.0

    # Cumulative delay at each gate:
    # PRE_LAUNCH: launch_slip
    # POST_LAUNCH: launch_slip + transit_extension
    # LUNAR_ORBIT_ARRIVAL: launch_slip + transit_extension
    # PRE_DESCENT: launch_slip + transit_extension + orbit_hold_extension
    gate_slip = {
        "PRE_LAUNCH": slip_launch,
        "POST_LAUNCH": slip_launch + slip_transit,
        "LUNAR_ORBIT_ARRIVAL": slip_launch + slip_transit,
        "PRE_DESCENT": slip_launch + slip_transit + slip_orbit,
    }

    # Gate timestamps from milestones
    gate_times = {
        "PRE_LAUNCH": milestones["launch_utc"],
        "POST_LAUNCH": milestones["orbit_arrival_utc"],
        "LUNAR_ORBIT_ARRIVAL": milestones["orbit_arrival_utc"],
        "PRE_DESCENT": milestones["descent_utc"],
    }

    cells = slip_calendar.get("cells", [])
    cell_map = {c["offset_days"]: c for c in cells}
    forward_offsets = sorted([c["offset_days"] for c in cells if c["offset_days"] >= 0])
    max_offset = forward_offsets[-1] if forward_offsets else 0

    gates_output: List[Dict[str, Any]] = []

    for gate_key in ["PRE_LAUNCH", "POST_LAUNCH", "LUNAR_ORBIT_ARRIVAL", "PRE_DESCENT"]:
        accumulated_slip = gate_slip[gate_key]
        current_offset = int(round(accumulated_slip))

        # Evaluate remaining tolerance forward from current_offset
        remaining_tolerance = 0
        first_failing_utc: Optional[str] = None

        if current_offset in cell_map and cell_map[current_offset]["verdict"] == "fails":
            remaining_tolerance = 0
            first_failing_utc = cell_map[current_offset]["date_utc"]
        else:
            first_fail_found = False
            for off in forward_offsets:
                if off >= current_offset:
                    cell = cell_map.get(off)
                    if cell and cell["verdict"] == "fails":
                        remaining_tolerance = max(0, off - current_offset - 1)
                        first_failing_utc = cell["date_utc"]
                        first_fail_found = True
                        break

            if not first_fail_found:
                # No failure seen in calendar forward
                remaining_tolerance = max(0, max_offset - current_offset)
                first_failing_utc = None

        gates_output.append({
            "gate": gate_key,
            "name": GATE_NAMES[gate_key],
            "time_utc": gate_times[gate_key],
            "slip_so_far_days": round(accumulated_slip, 2),
            "remaining_tolerance_days": remaining_tolerance,
            "first_failing_landing_utc": first_failing_utc,
        })

    return gates_output
