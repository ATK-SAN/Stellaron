"""Surface evaluation wrapper and verdict logic for STELLARON Mission Rehearsal (Section 3.3).

Executes physical illumination, Earth line-of-sight visibility, and battery simulation
over the surface stay interval [landing_t, landing_t + surface_days] using the existing
scientific engine.

Evaluates operational verdicts:
- 'fails': minimum SoC < reserve threshold, or any constraint violated.
- 'marginal': within configurable margin of any limit (default: SoC within 10 percentage
  points of reserve, blackout within 10% of constraint limit, sunlight within 5 percentage points).
- 'survives': exceeds all limits and margins.

Identifies the exact limiting_factor ('battery_reserve', 'earth_blackout', 'sunlit_fraction', 'none').
"""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import numpy as np

from engine.geometry import R_MOON_M
from engine.celestial import CelestialEngine
from engine.intervals import intervals_from_mask, compute_metrics
from engine.energy import compute_solar_power, simulate_battery
from rehearsal.timeline import parse_utc_dt, format_utc_iso

SOLAR_UPPER_LIMB_OFFSET_DEG: float = 0.265

# In-memory cache for site definitions and horizons to prevent redundant disk I/O
_SITE_CACHE: Dict[str, Dict[str, Any]] = {}
_HORIZON_CACHE: Dict[str, Tuple[np.ndarray, np.ndarray]] = {}


def _load_site_metadata(site_id: str) -> Dict[str, Any]:
    """Retrieve site dictionary from data/sites.json."""
    if site_id in _SITE_CACHE:
        return _SITE_CACHE[site_id]

    base_dir = Path(__file__).resolve().parent.parent
    sites_path = base_dir / "data" / "sites.json"
    if not sites_path.exists():
        sites_path = base_dir / "web" / "public" / "data" / "library_index.json"
        data = json.loads(sites_path.read_text(encoding="utf-8"))
        for s in data.get("sites", []):
            _SITE_CACHE[s["id"]] = s
    else:
        sites = json.loads(sites_path.read_text(encoding="utf-8"))
        for s in sites:
            _SITE_CACHE[s["id"]] = s

    if site_id not in _SITE_CACHE:
        raise ValueError(f"Site ID '{site_id}' not found in library.")
    return _SITE_CACHE[site_id]


def _load_site_horizon(site_id: str) -> Tuple[np.ndarray, np.ndarray]:
    """Retrieve 360-degree topographic horizon elevation profile for a site."""
    if site_id in _HORIZON_CACHE:
        return _HORIZON_CACHE[site_id]

    base_dir = Path(__file__).resolve().parent.parent
    processed_path = base_dir / "data" / "processed" / f"{site_id}_2026.json"
    if not processed_path.exists():
        processed_path = base_dir / "web" / "public" / "data" / f"{site_id}_2026.json"

    if processed_path.exists():
        d = json.loads(processed_path.read_text(encoding="utf-8"))
        h = d.get("horizon", {})
        if "az_deg" in h and "elevation_deg" in h:
            az = np.asarray(h["az_deg"], dtype=np.float64)
            el = np.asarray(h["elevation_deg"], dtype=np.float64)
            _HORIZON_CACHE[site_id] = (az, el)
            return az, el

    # Default to 0° flat horizon if precomputed file not present
    az = np.linspace(0.0, 360.0, 360, endpoint=False, dtype=np.float64)
    el = np.zeros(360, dtype=np.float64)
    _HORIZON_CACHE[site_id] = (az, el)
    return az, el


def interpolate_horizon_elevation(azimuth_deg: float, el_profile: np.ndarray) -> float:
    """Interpolate terrain elevation for a given azimuth from a 360-element array."""
    az_mod = azimuth_deg % 360.0
    idx0 = int(np.floor(az_mod)) % 360
    idx1 = (idx0 + 1) % 360
    frac = az_mod - np.floor(az_mod)
    return float((1.0 - frac) * el_profile[idx0] + frac * el_profile[idx1])


def evaluate_verdict(
    min_soc: float,
    min_soc_fraction: float,
    longest_blackout_h: float,
    max_blackout_constraint_h: Optional[float] = None,
    sunlit_fraction: float = 1.0,
    min_sunlit_constraint: Optional[float] = None,
    soc_margin: float = 0.10,
    blackout_margin_fraction: float = 0.10,
    sunlit_margin: float = 0.05,
) -> Tuple[str, str, Dict[str, Any]]:
    """Determine operational verdict and limiting factor.

    Returns:
        (verdict, limiting_factor, margins_detail)
        verdict is one of 'fails', 'marginal', 'survives'.
    """
    # 1. Hard limits (FAILS)
    if min_soc < min_soc_fraction:
        return "fails", "battery_reserve", {
            "reason": f"Minimum SoC ({min_soc*100:.1f}%) dropped below reserve threshold ({min_soc_fraction*100:.1f}%)"
        }

    if max_blackout_constraint_h is not None and longest_blackout_h > max_blackout_constraint_h:
        return "fails", "earth_blackout", {
            "reason": f"Longest Earth blackout ({longest_blackout_h:.1f}h) exceeded constraint ({max_blackout_constraint_h:.1f}h)"
        }

    if min_sunlit_constraint is not None and sunlit_fraction < min_sunlit_constraint:
        return "fails", "sunlit_fraction", {
            "reason": f"Sunlit fraction ({sunlit_fraction*100:.1f}%) fell below constraint ({min_sunlit_constraint*100:.1f}%)"
        }

    # 2. Configurable margins (MARGINAL)
    # SoC within 10 percentage points of reserve limit (e.g. 0.20 reserve -> marginal if < 0.30)
    soc_threshold_marginal = min_soc_fraction + soc_margin
    if min_soc < soc_threshold_marginal:
        return "marginal", "battery_reserve", {
            "reason": f"Minimum SoC ({min_soc*100:.1f}%) is within {soc_margin*100:.0f}% margin of reserve ({min_soc_fraction*100:.1f}%)"
        }

    if max_blackout_constraint_h is not None:
        blackout_threshold_marginal = max_blackout_constraint_h * (1.0 - blackout_margin_fraction)
        if longest_blackout_h >= blackout_threshold_marginal:
            return "marginal", "earth_blackout", {
                "reason": f"Earth blackout ({longest_blackout_h:.1f}h) is within {blackout_margin_fraction*100:.0f}% of constraint ({max_blackout_constraint_h:.1f}h)"
            }

    if min_sunlit_constraint is not None:
        sunlit_threshold_marginal = min_sunlit_constraint + sunlit_margin
        if sunlit_fraction < sunlit_threshold_marginal:
            return "marginal", "sunlit_fraction", {
                "reason": f"Sunlit fraction ({sunlit_fraction*100:.1f}%) is within {sunlit_margin*100:.0f}% of constraint ({min_sunlit_constraint*100:.1f}%)"
            }

    # 3. SURVIVES
    return "survives", "none", {"reason": "All battery SoC and visibility constraints satisfied with safe margin."}


def evaluate_surface(
    site_id: str,
    landing_t: Union[str, datetime],
    surface_days: float,
    hardware: Dict[str, Any],
    constraints: Optional[Dict[str, Any]] = None,
    step_s: float = 600.0,
    soc_margin: float = 0.10,
    blackout_margin_fraction: float = 0.10,
    sunlit_margin: float = 0.05,
    celestial_engine: Optional[CelestialEngine] = None,
    engine_stub: Optional[Any] = None,
) -> Dict[str, Any]:
    """Execute physical evaluation of the surface phase.

    Args:
        site_id: Target lunar landing site ID from library.
        landing_t: Touchdown timestamp (ISO-8601 string or datetime).
        surface_days: Duration of surface stay in days (1..30).
        hardware: Hardware parameters (panel_m2, panel_efficiency, battery_wh, base_load_w, min_soc_fraction).
        constraints: User constraints (max_earth_blackout_h, min_sunlit_fraction).
        step_s: Ephemeris time step in seconds (default 600.0s = 10 min).
        soc_margin: Margin above min_soc_fraction for marginal classification (default 0.10).
        blackout_margin_fraction: Margin below max_blackout for marginal classification (default 0.10).
        sunlit_margin: Margin above min_sunlit_fraction for marginal classification (default 0.05).
        celestial_engine: Optional CelestialEngine instance.
        engine_stub: Optional deterministic stub for unit test pass/fail pattern verification.

    Returns:
        Structured evaluation dictionary containing time_series, metrics, verdict, limiting_factor,
        censored flags, and full provenance block.
    """
    if engine_stub is not None:
        return engine_stub.evaluate(
            site_id=site_id,
            landing_t=landing_t,
            surface_days=surface_days,
            hardware=hardware,
            constraints=constraints or {},
            soc_margin=soc_margin,
            blackout_margin_fraction=blackout_margin_fraction,
            sunlit_margin=sunlit_margin,
        )

    landing_dt = parse_utc_dt(landing_t)
    surface_days_flt = float(surface_days)
    surface_end_dt = landing_dt + timedelta(days=surface_days_flt)
    total_surface_s = surface_days_flt * 86400.0

    site = _load_site_metadata(site_id)
    lat_deg = float(site.get("lat_deg", 0.0))
    lon_deg = float(site.get("lon_deg", 0.0))
    elev_m = float(site.get("elevation_m", 0.0))

    # Load 360-deg horizon profile
    _, horizon_el_arr = _load_site_horizon(site_id)

    # 1. SPICE Ephemeris computation
    if celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    landing_utc_str = format_utc_iso(landing_dt)
    surface_end_utc_str = format_utc_iso(surface_end_dt)

    t_start_et = celestial_engine.utc_to_et(landing_utc_str)
    t_end_et = celestial_engine.utc_to_et(surface_end_utc_str)

    times_et = np.arange(t_start_et, t_end_et + (step_s * 0.5), step_s, dtype=np.float64)
    n_samples = len(times_et)

    ephem = celestial_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        surface_elevation_m=elev_m,
    )

    sun_az = ephem["sun_az_deg"]
    sun_el = ephem["sun_el_deg"]
    earth_az = ephem["earth_az_deg"]
    earth_el = ephem["earth_el_deg"]

    # 2. Line-of-sight & solar upper limb visibility
    sun_visible = np.zeros(n_samples, dtype=bool)
    earth_visible = np.zeros(n_samples, dtype=bool)

    for i in range(n_samples):
        h_sun = interpolate_horizon_elevation(sun_az[i], horizon_el_arr)
        sun_visible[i] = (sun_el[i] + SOLAR_UPPER_LIMB_OFFSET_DEG) > h_sun

        h_earth = interpolate_horizon_elevation(earth_az[i], horizon_el_arr)
        earth_visible[i] = earth_el[i] > h_earth

    times_s = times_et.copy()

    # 3. Solar Generation & Battery Storage Simulation
    panel_area = float(hardware.get("panel_m2", 2.5))
    panel_eff = float(hardware.get("panel_efficiency", 0.28))
    battery_wh = float(hardware.get("battery_wh", 1200.0))
    base_load_w = float(hardware.get("base_load_w", 65.0))
    min_soc_fraction = float(hardware.get("min_soc_fraction", 0.20))

    solar_power_w = compute_solar_power(
        elevation_deg=sun_el,
        azimuth_deg=sun_az,
        sun_visible=sun_visible,
        panel_area_m2=panel_area,
        panel_efficiency=panel_eff,
        orientation_mode="horizontal",
    )

    battery_sim = simulate_battery(
        solar_power_w=solar_power_w,
        times_s=times_s,
        battery_capacity_wh=battery_wh,
        initial_soc=1.0,
        p_load_w=base_load_w,
        eta_c=0.92,
        eta_d=0.92,
        soc_min=min_soc_fraction,
    )

    # 4. Extract Interval Metrics
    sun_metrics = compute_metrics(times_s, sun_visible, sun_el)
    earth_metrics = compute_metrics(times_s, earth_visible, earth_el)

    sun_tot = sun_metrics.get("total_visible_s", 0.0) + sun_metrics.get("total_dark_s", 0.0)
    sunlit_hours = round(float(sun_metrics.get("total_sunlight_s", sun_metrics.get("total_visible_s", 0.0))) / 3600.0, 2)
    longest_dark_run_h = round(float(sun_metrics.get("longest_dark_run_s", sun_metrics.get("longest_dark_s", 0.0))) / 3600.0, 2)
    sunlit_fraction = round(float(sun_metrics.get("sunlight_fraction", (sun_metrics.get("total_visible_s", 0.0) / sun_tot) if sun_tot > 0 else 0.0)), 4)

    earth_tot = earth_metrics.get("total_visible_s", 0.0) + earth_metrics.get("total_dark_s", 0.0)
    earth_visible_hours = round(float(earth_metrics.get("total_visibility_s", earth_metrics.get("total_visible_s", 0.0))) / 3600.0, 2)
    longest_earth_blackout_h = round(float(earth_metrics.get("longest_earth_blackout_s", earth_metrics.get("longest_dark_s", 0.0))) / 3600.0, 2)
    earth_visibility_fraction = round(float(earth_metrics.get("visibility_fraction", (earth_metrics.get("total_visible_s", 0.0) / earth_tot) if earth_tot > 0 else 0.0)), 4)

    min_soc = round(float(battery_sim["min_soc"]), 4)
    time_below_reserve_h = round(float(battery_sim["time_below_reserve_s"]) / 3600.0, 2)

    # First deficit time (first time SoC dips below reserve threshold)
    first_deficit_utc: Optional[str] = None
    deficit_intervals = battery_sim.get("deficit_intervals", [])
    if deficit_intervals:
        first_deficit_et = deficit_intervals[0]["start_s"]
        first_deficit_utc = celestial_engine.et_to_utc(first_deficit_et)

    # 5. Censoring flags (intervals touching boundary)
    dark_intervals = intervals_from_mask(~sun_visible, times_s)
    blackout_intervals = intervals_from_mask(~earth_visible, times_s)

    dark_touches_boundary = any(
        it.get("censored", False) or it["start_s"] == times_s[0] or it["end_s"] == times_s[-1]
        for it in dark_intervals
    )
    blackout_touches_boundary = any(
        it.get("censored", False) or it["start_s"] == times_s[0] or it["end_s"] == times_s[-1]
        for it in blackout_intervals
    )
    deficit_touches_boundary = any(
        it.get("censored", False) or it["start_s"] == times_s[0] or it["end_s"] == times_s[-1]
        for it in deficit_intervals
    )

    # 6. Verdict and Limiting Factor Evaluation
    constraints = constraints or {}
    max_blackout_c = constraints.get("max_earth_blackout_h")
    min_sunlit_c = constraints.get("min_sunlit_fraction")

    verdict, limiting_factor, verdict_details = evaluate_verdict(
        min_soc=min_soc,
        min_soc_fraction=min_soc_fraction,
        longest_blackout_h=longest_earth_blackout_h,
        max_blackout_constraint_h=float(max_blackout_c) if max_blackout_c is not None else None,
        sunlit_fraction=sunlit_fraction,
        min_sunlit_constraint=float(min_sunlit_c) if min_sunlit_c is not None else None,
        soc_margin=soc_margin,
        blackout_margin_fraction=blackout_margin_fraction,
        sunlit_margin=sunlit_margin,
    )

    # Subsample time series for reasonable payload size (max 2000 points)
    stride = max(1, n_samples // 1000)
    times_utc_sub = [
        format_utc_iso(landing_dt + timedelta(seconds=float(times_s[i] - times_s[0])))
        for i in range(0, n_samples, stride)
    ]
    sun_el_sub = [round(float(sun_el[i]), 2) for i in range(0, n_samples, stride)]
    earth_el_sub = [round(float(earth_el[i]), 2) for i in range(0, n_samples, stride)]
    sun_vis_sub = [bool(sun_visible[i]) for i in range(0, n_samples, stride)]
    earth_vis_sub = [bool(earth_visible[i]) for i in range(0, n_samples, stride)]

    soc_hist = battery_sim.get("soc_history")
    if soc_hist is not None and len(soc_hist) > 0:
        soc_sub = [round(float(soc_hist[i]), 4) for i in range(0, min(len(soc_hist), n_samples), stride)]
    else:
        soc_sub = []

    return {
        "verdict": verdict,
        "limiting_factor": limiting_factor,
        "verdict_details": verdict_details,
        "metrics": {
            "sunlit_hours": sunlit_hours,
            "sunlit_fraction": round(sunlit_fraction, 4),
            "earth_visible_hours": earth_visible_hours,
            "earth_visibility_fraction": round(earth_visibility_fraction, 4),
            "longest_dark_run_h": longest_dark_run_h,
            "longest_earth_blackout_h": longest_earth_blackout_h,
            "minimum_soc": min_soc,
            "time_below_reserve_h": time_below_reserve_h,
            "first_deficit_utc": first_deficit_utc,
            "generated_wh": round(float(battery_sim.get("generated_wh", 0.0)), 1),
            "consumed_wh": round(float(battery_sim.get("consumed_wh", 0.0)), 1),
            "final_soc": round(float(battery_sim.get("final_soc", 0.0)), 4),
        },
        "censored": {
            "darkness_touches_boundary": dark_touches_boundary,
            "blackout_touches_boundary": blackout_touches_boundary,
            "battery_deficit_touches_boundary": deficit_touches_boundary,
        },
        "time_series": {
            "times_utc": times_utc_sub,
            "sun_elevation_deg": sun_el_sub,
            "earth_elevation_deg": earth_el_sub,
            "sun_visible": sun_vis_sub,
            "earth_visible": earth_vis_sub,
            "soc": soc_sub,
        },
        "provenance": {
            "model_version": "STELLARON-2.0",
            "ephemeris_kernel": "de421.bsp",
            "orientation_pck": "moon_pa_de421_1900-2050.bpc",
            "site_id": site_id,
            "site_name": site.get("name", site_id),
            "coordinates": {"lat_deg": lat_deg, "lon_deg": lon_deg, "elevation_m": elev_m},
            "dem_product": site.get("dem_product", "LOLA_5mpp_SouthPole"),
            "limb_convention": "upper_limb (+0.265 deg)",
            "step_s": step_s,
            "thresholds_used": {
                "min_soc_fraction": min_soc_fraction,
                "max_earth_blackout_h": max_blackout_c,
                "min_sunlit_fraction": min_sunlit_c,
                "soc_margin": soc_margin,
                "blackout_margin_fraction": blackout_margin_fraction,
                "sunlit_margin": sunlit_margin,
            },
            "hardware_assumptions": {
                "panel_m2": panel_area,
                "panel_efficiency": panel_eff,
                "battery_wh": battery_wh,
                "base_load_w": base_load_w,
                "min_soc_fraction": min_soc_fraction,
            },
            "claims_policy": "All values modelled. Trajectory schematic and illustrative only. Zero fabricated data.",
        },
    }
