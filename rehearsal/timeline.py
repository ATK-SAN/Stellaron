"""Timeline model for STELLARON Mission Rehearsal (Section 3.2).

Pure deterministic function mapping mission durations and delay perturbations
to exact UTC phase boundaries:
    PRELAUNCH_HOLD -> TRANSIT -> LUNAR_ORBIT -> DESCENT -> SURFACE

Formulas (Section 3.2):
    launch_t        = launch_utc + slip_launch
    orbit_arrival_t = launch_t + transit_days + extension_transit
    descent_t       = orbit_arrival_t + orbit_hold_days + extension_hold
    landing_t       = descent_t + nominal_descent + retry_days
    surface_end_t   = landing_t + surface_days

A scenario with all zeros reproduces the baseline exactly.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union

# Standard nominal operational durations for schematic phases
NOMINAL_PRELAUNCH_HOURS: float = 24.0  # 1 day of countdown / prelaunch hold
NOMINAL_DESCENT_HOURS: float = 2.0      # 2 hours deorbit burn, descent & touchdown


def parse_utc_dt(val: Union[str, datetime]) -> datetime:
    """Parse UTC string or return timezone-aware datetime."""
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    if isinstance(val, str):
        cleaned = val.strip()
        if cleaned.endswith("Z") or cleaned.endswith("z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    raise ValueError(f"Invalid timestamp value: {val}")


def format_utc_iso(dt: datetime) -> str:
    """Format datetime into standard ISO-8601 UTC string."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def compute_timeline(
    plan: Dict[str, Any],
    perturbation: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None,
    nominal_prelaunch_hours: float = NOMINAL_PRELAUNCH_HOURS,
    nominal_descent_hours: float = NOMINAL_DESCENT_HOURS,
    scenario: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """Compute phase boundaries and milestones for a mission plan.

    Args:
        plan: Validated mission plan containing:
            - launch_utc (str)
            - transit_days (float)
            - orbit_hold_days (float)
            - surface_days (float)
        perturbation: Optional scenario dict (or list of scenario dicts) specifying delays:
            - type: "launch_slip" | "transit_extension" | "orbit_hold_extension" | "landing_retry"
            - days: float
        nominal_prelaunch_hours: Duration of PRELAUNCH_HOLD phase in hours.
        nominal_descent_hours: Duration of nominal deorbit and descent in hours.
        scenario: Alias for perturbation.

    Returns:
        Dict with milestones (launch_utc, orbit_arrival_utc, descent_utc, landing_utc, surface_end_utc)
        and phases list: [{"name", "t0_utc", "t1_utc", "duration_days", "duration_seconds"}].
    """
    if perturbation is None and scenario is not None:
        perturbation = scenario
    base_launch_dt = parse_utc_dt(plan["launch_utc"])
    transit_days = float(plan.get("transit_days", 3.0))
    orbit_hold_days = float(plan.get("orbit_hold_days", 0.0))
    surface_days = float(plan.get("surface_days", 14.0))

    # Aggregate perturbations
    slip_launch_days = 0.0
    ext_transit_days = 0.0
    ext_hold_days = 0.0
    retry_landing_days = 0.0

    perturbation_list: List[Dict[str, Any]] = []
    if isinstance(perturbation, list):
        perturbation_list = perturbation
    elif isinstance(perturbation, dict):
        perturbation_list = [perturbation]

    for p in perturbation_list:
        ptype = p.get("type")
        days = float(p.get("days", 0.0))
        if ptype == "launch_slip":
            slip_launch_days += days
        elif ptype == "transit_extension":
            ext_transit_days += days
        elif ptype == "orbit_hold_extension":
            ext_hold_days += days
        elif ptype == "landing_retry":
            retry_landing_days += days

    # 1. Timeline Milestones
    # launch_t = launch_utc + slip_launch
    launch_dt = base_launch_dt + timedelta(days=slip_launch_days)

    # Prelaunch starts nominal_prelaunch_hours before launch
    prelaunch_dt = launch_dt - timedelta(hours=nominal_prelaunch_hours)

    # orbit_arrival_t = launch_t + transit_days + extension_transit
    effective_transit_days = transit_days + ext_transit_days
    orbit_arrival_dt = launch_dt + timedelta(days=effective_transit_days)

    # descent_t = orbit_arrival_t + orbit_hold_days + extension_hold
    effective_hold_days = orbit_hold_days + ext_hold_days
    descent_dt = orbit_arrival_dt + timedelta(days=effective_hold_days)

    # landing_t = descent_t + nominal_descent + retry_days
    descent_total_days = (nominal_descent_hours / 24.0) + retry_landing_days
    landing_dt = descent_dt + timedelta(days=descent_total_days)

    # surface_end_t = landing_t + surface_days
    surface_end_dt = landing_dt + timedelta(days=surface_days)

    # 2. Phase Boundaries
    phases = [
        {
            "name": "PRELAUNCH_HOLD",
            "t0_utc": format_utc_iso(prelaunch_dt),
            "t1_utc": format_utc_iso(launch_dt),
            "duration_days": nominal_prelaunch_hours / 24.0,
            "duration_seconds": nominal_prelaunch_hours * 3600.0,
        },
        {
            "name": "TRANSIT",
            "t0_utc": format_utc_iso(launch_dt),
            "t1_utc": format_utc_iso(orbit_arrival_dt),
            "duration_days": effective_transit_days,
            "duration_seconds": effective_transit_days * 86400.0,
        },
        {
            "name": "LUNAR_ORBIT",
            "t0_utc": format_utc_iso(orbit_arrival_dt),
            "t1_utc": format_utc_iso(descent_dt),
            "duration_days": effective_hold_days,
            "duration_seconds": effective_hold_days * 86400.0,
        },
        {
            "name": "DESCENT",
            "t0_utc": format_utc_iso(descent_dt),
            "t1_utc": format_utc_iso(landing_dt),
            "duration_days": descent_total_days,
            "duration_seconds": descent_total_days * 86400.0,
        },
        {
            "name": "SURFACE",
            "t0_utc": format_utc_iso(landing_dt),
            "t1_utc": format_utc_iso(surface_end_dt),
            "duration_days": surface_days,
            "duration_seconds": surface_days * 86400.0,
        },
    ]

    total_mission_seconds = (surface_end_dt - launch_dt).total_seconds()

    return {
        "milestones": {
            "prelaunch_utc": format_utc_iso(prelaunch_dt),
            "launch_utc": format_utc_iso(launch_dt),
            "orbit_arrival_utc": format_utc_iso(orbit_arrival_dt),
            "descent_utc": format_utc_iso(descent_dt),
            "landing_utc": format_utc_iso(landing_dt),
            "surface_end_utc": format_utc_iso(surface_end_dt),
        },
        "phases": phases,
        "delays": {
            "slip_launch_days": slip_launch_days,
            "ext_transit_days": ext_transit_days,
            "ext_hold_days": ext_hold_days,
            "retry_landing_days": retry_landing_days,
            "total_slip_days": slip_launch_days + ext_transit_days + ext_hold_days + retry_landing_days,
        },
        "durations": {
            "transit_days": effective_transit_days,
            "orbit_hold_days": effective_hold_days,
            "descent_days": descent_total_days,
            "surface_days": surface_days,
            "total_mission_days": total_mission_seconds / 86400.0,
            "total_mission_seconds": total_mission_seconds,
        },
    }
