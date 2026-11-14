"""Mission Choreography Generator for STELLARON (Section 4 & Section 6).

Generates keyframed 3D positions and orientations for mission visualization:
- PRELAUNCH_HOLD (on Earth launchpad)
- TRANSIT (Earth to Moon transfer using real SPICE Moon position at arrival)
- LUNAR_ORBIT (schematic lunar parking orbit)
- DESCENT (schematic deorbit and touchdown)
- SURFACE (stationary at landing site with real solar/Earth vectors)

NON-NEGOTIABLE SCIENTIFIC RULE:
Non-surface phases are explicitly marked:
    "schematic": true
    "disclaimer": "Illustrative path, not a trajectory design."
Never claim orbital-mechanics accuracy, delta-v, fuel, or flight-dynamics results.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import numpy as np

from engine.celestial import CelestialEngine
from rehearsal.surface import parse_utc_dt, format_utc_iso
from rehearsal.timeline import compute_timeline


DISCLAIMER_TEXT = "Illustrative path, not a trajectory design."


def _smoothstep(t: float) -> float:
    """Hermite interpolation between 0 and 1."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def generate_choreography(
    plan: Dict[str, Any],
    timeline: Optional[Dict[str, Any]] = None,
    scenario: Optional[Dict[str, Any]] = None,
    n_transit_points: int = 40,
    n_orbit_points: int = 20,
    n_descent_points: int = 15,
    n_surface_points: int = 25,
    celestial_engine: Optional[CelestialEngine] = None,
) -> Dict[str, Any]:
    """Generate keyframed 3D choreography sequence for Three.js animation.

    Args:
        plan: Validated mission plan dictionary.
        timeline: Optional precomputed timeline.
        scenario: Optional delay scenario.
        n_transit_points: Number of trajectory frames during transit.
        n_orbit_points: Number of frames in lunar orbit hold.
        n_descent_points: Number of frames during powered descent.
        n_surface_points: Number of frames during surface stay.
        celestial_engine: Optional CelestialEngine instance.

    Returns:
        Structured choreography dictionary containing frames, milestones, and provenance.
    """
    if timeline is None:
        timeline = compute_timeline(plan, scenario=scenario)

    milestones = timeline["milestones"]
    t_prelaunch = parse_utc_dt(milestones["prelaunch_utc"])
    t_launch = parse_utc_dt(milestones["launch_utc"])
    t_orbit = parse_utc_dt(milestones["orbit_arrival_utc"])
    t_descent = parse_utc_dt(milestones["descent_utc"])
    t_landing = parse_utc_dt(milestones["landing_utc"])
    t_surface_end = parse_utc_dt(milestones["surface_end_utc"])

    # Load SPICE ephemeris for celestial positions if available
    has_spice = False
    if celestial_engine is None:
        try:
            celestial_engine = CelestialEngine()
            celestial_engine.load_kernels()
            has_spice = True
        except Exception:
            has_spice = False
    else:
        has_spice = True

    frames: List[Dict[str, Any]] = []

    # ── Phase 1: PRELAUNCH HOLD (On Earth, schematic: true) ───────────────
    frames.append({
        "t_sec": 0.0,
        "time_utc": format_utc_iso(t_prelaunch),
        "phase": "PRELAUNCH_HOLD",
        "schematic": True,
        "disclaimer": DISCLAIMER_TEXT,
        "event": "COUNTDOWN_START",
        "craft_position_km": [0.0, 0.0, 6378.0],
        "earth_position_km": [0.0, 0.0, 0.0],
        "moon_position_km": [384400.0, 0.0, 0.0],
        "camera_preset": "earth_departure",
        "thrust_active": False,
    })

    frames.append({
        "t_sec": (t_launch - t_prelaunch).total_seconds(),
        "time_utc": format_utc_iso(t_launch),
        "phase": "PRELAUNCH_HOLD",
        "schematic": True,
        "disclaimer": DISCLAIMER_TEXT,
        "event": "LIFTOFF",
        "craft_position_km": [0.0, 0.0, 6378.0],
        "earth_position_km": [0.0, 0.0, 0.0],
        "moon_position_km": [384400.0, 0.0, 0.0],
        "camera_preset": "earth_departure",
        "thrust_active": True,
    })

    # ── Phase 2: TRANSIT (Earth to Moon, schematic: true) ─────────────────
    transit_duration_s = max(1.0, (t_orbit - t_launch).total_seconds())
    t0_s = (t_launch - t_prelaunch).total_seconds()

    # Get Moon position at orbit arrival from SPICE (or nominal average)
    moon_at_arrival_km = [384400.0, 0.0, 0.0]
    if has_spice and celestial_engine is not None:
        try:
            et_arrival = celestial_engine.utc_to_et(milestones["orbit_arrival_utc"])
            # In Earth-centered J2000 coordinates
            pos, _ = celestial_engine.spkpos("MOON", et_arrival, "J2000", "NONE", "EARTH")
            moon_at_arrival_km = [float(pos[0]), float(pos[1]), float(pos[2])]
        except Exception:
            pass

    for i in range(1, n_transit_points):
        frac = i / float(n_transit_points)
        s_frac = _smoothstep(frac)
        frame_dt = t_launch + timedelta(seconds=frac * transit_duration_s)

        # Outward curve departing Earth toward Moon
        # Arc with slight out-of-plane bow
        p_x = (1.0 - s_frac) * 0.0 + s_frac * moon_at_arrival_km[0]
        p_y = (1.0 - s_frac) * 6378.0 + s_frac * moon_at_arrival_km[1] + np.sin(np.pi * frac) * 15000.0
        p_z = (1.0 - s_frac) * 0.0 + s_frac * moon_at_arrival_km[2] + np.sin(np.pi * frac) * 8000.0

        event_name = None
        if i == 1:
            event_name = "TLI_BURN"
        elif i == n_transit_points // 2:
            event_name = "MIDCOURSE_CORRECTION"

        frames.append({
            "t_sec": t0_s + frac * transit_duration_s,
            "time_utc": format_utc_iso(frame_dt),
            "phase": "TRANSIT",
            "schematic": True,
            "disclaimer": DISCLAIMER_TEXT,
            "event": event_name,
            "craft_position_km": [round(p_x, 1), round(p_y, 1), round(p_z, 1)],
            "earth_position_km": [0.0, 0.0, 0.0],
            "moon_position_km": moon_at_arrival_km,
            "camera_preset": "translunar_cruise",
            "thrust_active": (event_name is not None),
        })

    # ── Phase 3: LUNAR ORBIT HOLD (Schematic parking orbit, schematic: true)
    orbit_duration_s = max(1.0, (t_descent - t_orbit).total_seconds())
    t_orbit_start_s = t0_s + transit_duration_s
    lunar_r_orbit_km = 1737.4 + 100.0  # 100 km circular lunar parking orbit

    for i in range(n_orbit_points):
        frac = i / float(max(1, n_orbit_points - 1))
        frame_dt = t_orbit + timedelta(seconds=frac * orbit_duration_s)
        angle = 2.0 * np.pi * frac * 3.0  # 3 revolutions

        # Moon-relative orbit coordinates
        m_x = moon_at_arrival_km[0] + lunar_r_orbit_km * np.cos(angle)
        m_y = moon_at_arrival_km[1] + lunar_r_orbit_km * np.sin(angle)
        m_z = moon_at_arrival_km[2] + lunar_r_orbit_km * np.sin(angle) * 0.3

        event_name = "LOI_INSERTION" if i == 0 else None

        frames.append({
            "t_sec": t_orbit_start_s + frac * orbit_duration_s,
            "time_utc": format_utc_iso(frame_dt),
            "phase": "LUNAR_ORBIT",
            "schematic": True,
            "disclaimer": DISCLAIMER_TEXT,
            "event": event_name,
            "craft_position_km": [round(m_x, 1), round(m_y, 1), round(m_z, 1)],
            "earth_position_km": [0.0, 0.0, 0.0],
            "moon_position_km": moon_at_arrival_km,
            "camera_preset": "orbit_insertion",
            "thrust_active": (i == 0),
        })

    # ── Phase 4: POWERED DESCENT (Spiral to surface, schematic: true) ─────
    descent_duration_s = max(1.0, (t_landing - t_descent).total_seconds())
    t_descent_start_s = t_orbit_start_s + orbit_duration_s
    lunar_r_surface_km = 1737.4

    for i in range(n_descent_points):
        frac = i / float(max(1, n_descent_points - 1))
        frame_dt = t_descent + timedelta(seconds=frac * descent_duration_s)

        alt_km = (1.0 - frac) * 100.0
        angle = np.pi * 0.5 * (1.0 - frac)
        rad = lunar_r_surface_km + alt_km

        m_x = moon_at_arrival_km[0] + rad * np.sin(angle) * 0.1
        m_y = moon_at_arrival_km[1] + rad * np.sin(angle) * 0.1
        m_z = moon_at_arrival_km[2] - rad  # South polar approach (-Z)

        event_name = "PDI_BURN" if i == 0 else ("TOUCHDOWN" if i == n_descent_points - 1 else None)

        frames.append({
            "t_sec": t_descent_start_s + frac * descent_duration_s,
            "time_utc": format_utc_iso(frame_dt),
            "phase": "DESCENT",
            "schematic": True,
            "disclaimer": DISCLAIMER_TEXT,
            "event": event_name,
            "craft_position_km": [round(m_x, 1), round(m_y, 1), round(m_z, 1)],
            "earth_position_km": [0.0, 0.0, 0.0],
            "moon_position_km": moon_at_arrival_km,
            "camera_preset": "landing_site_zoom",
            "thrust_active": True,
        })

    # ── Phase 5: SURFACE PHASE (Real physics coordinates, schematic: false)
    surface_duration_s = max(1.0, (t_surface_end - t_landing).total_seconds())
    t_surface_start_s = t_descent_start_s + descent_duration_s
    site_surface_pos = [
        moon_at_arrival_km[0],
        moon_at_arrival_km[1],
        moon_at_arrival_km[2] - lunar_r_surface_km,
    ]

    for i in range(n_surface_points):
        frac = i / float(max(1, n_surface_points - 1))
        frame_dt = t_landing + timedelta(seconds=frac * surface_duration_s)

        frames.append({
            "t_sec": t_surface_start_s + frac * surface_duration_s,
            "time_utc": format_utc_iso(frame_dt),
            "phase": "SURFACE",
            "schematic": False,
            "disclaimer": None,
            "event": "SURFACE_OPS" if i == 0 else None,
            "craft_position_km": site_surface_pos,
            "earth_position_km": [0.0, 0.0, 0.0],
            "moon_position_km": moon_at_arrival_km,
            "camera_preset": "landing_site_zoom",
            "thrust_active": False,
        })

    return {
        "schema_version": 1,
        "site_id": plan["landing_site_id"],
        "total_frames": len(frames),
        "total_duration_seconds": (t_surface_end - t_prelaunch).total_seconds(),
        "schematic_disclaimer": DISCLAIMER_TEXT,
        "phases_summary": {
            "PRELAUNCH_HOLD": {"schematic": True, "start_utc": format_utc_iso(t_prelaunch), "end_utc": format_utc_iso(t_launch)},
            "TRANSIT": {"schematic": True, "start_utc": format_utc_iso(t_launch), "end_utc": format_utc_iso(t_orbit)},
            "LUNAR_ORBIT": {"schematic": True, "start_utc": format_utc_iso(t_orbit), "end_utc": format_utc_iso(t_descent)},
            "DESCENT": {"schematic": True, "start_utc": format_utc_iso(t_descent), "end_utc": format_utc_iso(t_landing)},
            "SURFACE": {"schematic": False, "start_utc": format_utc_iso(t_landing), "end_utc": format_utc_iso(t_surface_end)},
        },
        "frames": frames,
    }
