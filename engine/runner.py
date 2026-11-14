"""Full-pipeline runner: computes celestial vectors, horizon occlusion, intervals, energy, and canonical JSON.

Adheres strictly to the STELLARON Output Contract (Rulebook Section 7):
- Immutable result records with deterministic result_sha256.
- Explicit status, error, and provenance fields.
- Full traceability of kernels, models, and assumptions.
"""

import hashlib
import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
import numpy as np

from engine.geometry import R_MOON_M, enu_basis, body_az_el, surface_site_vector
from engine.celestial import CelestialEngine
from engine.horizon import horizon_profile
from engine.intervals import (
    refine_transition,
    intervals_from_mask,
    compute_metrics,
    time_to_next_change,
)
from engine.energy import compute_solar_power, simulate_battery

SOLAR_UPPER_LIMB_OFFSET_DEG: float = 0.265
DISC_CENTRE_OFFSET_DEG: float = 0.0


def canonical_json_dumps(obj: Any) -> str:
    """Format dict into deterministic canonical JSON (sorted keys, fixed separators)."""
    return json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=True)


def run_site(
    site: Dict[str, Any],
    interval_utc: Tuple[str, str],
    step_s: float = 600.0,
    dem: Optional[np.ndarray] = None,
    pixel_m: float = 20.0,
    row: Optional[int] = None,
    col: Optional[int] = None,
    observer_height_m: float = 0.0,
    use_surface_observer: bool = False,
    limb_convention: str = "upper_limb",
    energy_config: Optional[Dict[str, Any]] = None,
    celestial_engine: Optional[CelestialEngine] = None,
) -> Dict[str, Any]:
    """Execute end-to-end scientific analysis for a lunar site over a specified interval.

    Inputs:
        site: Dict with keys {"id", "name", "lat_deg", "lon_deg", "source", "coverage"}
        interval_utc: (start_utc, end_utc) ISO strings (e.g. ("2026-01-01T00:00:00", "2026-01-15T00:00:00"))
        step_s: Primary grid sampling time in seconds (default: 600.0 s = 10 min)
        dem: Optional 2D array of elevation values in metres
        pixel_m: DEM pixel resolution in metres
        row, col: Observer coordinates on DEM
        observer_height_m: Instrument elevation above ground (default 0.0)
        use_surface_observer: Subtraction of surface site topocentric vector
        limb_convention: "upper_limb" (+0.265°) or "disc_centre" (0.0°)
        energy_config: Optional power/battery configuration
        celestial_engine: Optional loaded CelestialEngine instance

    Outputs:
        Result dictionary matching Rulebook Section 7 contract.
    """
    lat_deg = float(site.get("lat_deg", 0.0))
    lon_deg = float(site.get("lon_deg", 0.0))

    if not (-90.0 <= lat_deg <= 90.0):
        return {
            "status": "error",
            "error": f"Invalid latitude: {lat_deg}. Must be within [-90.0, 90.0].",
            "run_id": f"err_{uuid.uuid4().hex[:8]}",
            "site": site,
        }

    start_utc, end_utc = interval_utc
    if celestial_engine is None:
        celestial_engine = CelestialEngine()
        celestial_engine.load_kernels()

    try:
        t_start_et = celestial_engine.utc_to_et(start_utc)
        t_end_et = celestial_engine.utc_to_et(end_utc)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Invalid UTC interval string: {e}",
            "run_id": f"err_{uuid.uuid4().hex[:8]}",
            "site": site,
        }

    if t_end_et <= t_start_et:
        return {
            "status": "error",
            "error": f"End time must be strictly after start time: {start_utc} to {end_utc}",
            "run_id": f"err_{uuid.uuid4().hex[:8]}",
            "site": site,
        }

    # Generate sampling grid
    times_et = np.arange(t_start_et, t_end_et + (step_s * 0.5), step_s, dtype=np.float64)
    n_samples = len(times_et)

    # 1. Terrain Horizon Profile
    if dem is not None and row is not None and col is not None:
        az_deg_arr, el_deg_arr, limited_flags = horizon_profile(
            dem=dem,
            pixel_m=pixel_m,
            row=row,
            col=col,
            n_az=360,
            max_d=30000.0,
            radius_m=R_MOON_M,
            observer_height_m=observer_height_m,
        )
    else:
        # Coarse / flat horizon fallback for sites without loaded local DEM
        az_deg_arr = np.linspace(0.0, 360.0, 360, endpoint=False, dtype=np.float64)
        el_deg_arr = np.zeros(360, dtype=np.float64)
        limited_flags = np.array([True] * 360, dtype=object)

    # Interpolator for horizon elevation as function of azimuth
    def get_horizon_el(az: float) -> float:
        az_mod = az % 360.0
        idx = int(np.floor(az_mod)) % 360
        idx_next = (idx + 1) % 360
        frac = az_mod - np.floor(az_mod)
        return float((1.0 - frac) * el_deg_arr[idx] + frac * el_deg_arr[idx_next])

    # 2. Celestial positions from SPICE
    ephem = celestial_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        surface_elevation_m=float(site.get("elevation_m", 0.0)),
        use_surface_observer=use_surface_observer,
    )

    sun_az = ephem["sun_az_deg"]
    sun_el = ephem["sun_el_deg"]
    earth_az = ephem["earth_az_deg"]
    earth_el = ephem["earth_el_deg"]

    # 3. Visibility determination
    r_sun = SOLAR_UPPER_LIMB_OFFSET_DEG if limb_convention == "upper_limb" else DISC_CENTRE_OFFSET_DEG

    sun_visible = np.zeros(n_samples, dtype=bool)
    earth_visible = np.zeros(n_samples, dtype=bool)

    for i in range(n_samples):
        h_sun = get_horizon_el(sun_az[i])
        sun_visible[i] = (sun_el[i] + r_sun) > h_sun

        h_earth = get_horizon_el(earth_az[i])
        earth_visible[i] = earth_el[i] > h_earth

    # Convert ET times to epoch seconds for output interval metrics
    # ET is approx UTC + ~69s in 2026. Store exact epoch seconds.
    times_s = times_et.copy()

    # 4. Transitions & Bisection Refinement (<= 1s precision)
    def sun_visibility_eval(et: float) -> bool:
        enu = enu_basis(lat_deg, lon_deg)
        site_vec = (
            surface_site_vector(lat_deg, lon_deg, float(site.get("elevation_m", 0.0)))
            if use_surface_observer
            else np.zeros(3)
        )
        pos = celestial_engine.get_body_position_m("SUN", et) - site_vec
        az, el = body_az_el(pos, enu)
        return (el + r_sun) > get_horizon_el(az)

    refined_transitions: List[Dict[str, Any]] = []
    for i in range(n_samples - 1):
        if sun_visible[i] != sun_visible[i + 1]:
            t_refined = refine_transition(
                eval_fn=sun_visibility_eval,
                t_before=times_et[i],
                t_after=times_et[i + 1],
                tol_s=1.0,
            )
            refined_transitions.append({
                "type": "sunrise" if sun_visible[i + 1] else "sunset",
                "epoch_et": float(t_refined),
                "utc": celestial_engine.et_to_utc(t_refined),
                "precision_s": 1.0,
            })

    # 5. Core Metrics
    sun_metrics = compute_metrics(times_s, sun_visible, sun_el)
    earth_metrics = compute_metrics(times_s, earth_visible, earth_el)

    # 6. Energy simulation (if configured)
    energy_results = None
    if energy_config:
        power_w = compute_solar_power(
            elevation_deg=sun_el,
            azimuth_deg=sun_az,
            sun_visible=sun_visible,
            panel_area_m2=float(energy_config.get("panel_area_m2", 2.0)),
            panel_efficiency=float(energy_config.get("panel_efficiency", 0.28)),
            orientation_mode=energy_config.get("orientation_mode", "horizontal"),
        )
        batt_sim = simulate_battery(
            solar_power_w=power_w,
            times_s=times_s,
            battery_capacity_wh=float(energy_config.get("battery_capacity_wh", 1000.0)),
            initial_soc=float(energy_config.get("initial_soc", 1.0)),
            p_load_w=float(energy_config.get("p_load_w", 50.0)),
            eta_c=float(energy_config.get("eta_c", 0.92)),
            eta_d=float(energy_config.get("eta_d", 0.92)),
            soc_min=float(energy_config.get("soc_min", 0.20)),
        )
        # Downsample soc_history to max 2000 points for static JSON size
        full_soc = batt_sim["soc_history"]
        soc_step = max(1, len(full_soc) // 2000)
        energy_results = {
            "generated_wh": batt_sim["generated_wh"],
            "consumed_wh": batt_sim["consumed_wh"],
            "min_soc": batt_sim["min_soc"],
            "time_below_reserve_s": batt_sim["time_below_reserve_s"],
            "deficit_intervals": batt_sim["deficit_intervals"],
            "final_soc": float(full_soc[-1]),
            "soc_history": [round(float(v), 4) for v in full_soc[::soc_step]],
            "soc_history_step": soc_step,
        }

    # 7. Limitations and Assumptions
    limitations = []
    assumptions = [
        "Solar constant assumed constant at 1361.0 W/m² (1 AU)",
        f"Limb convention: {limb_convention} (solar radius offset: {r_sun}°)",
        f"Observer model: {'surface_site topocentric' if use_surface_observer else 'moon_centre reference'}",
    ]
    if dem is None or site.get("coverage") == "limited":
        limitations.append("Horizon computed without high-resolution polar DEM (coarse/limited terrain coverage)")
    if np.any(np.asarray(limited_flags, dtype=bool)):
        limitations.append("Some horizon azimuth rays reached tile boundary before max distance")

    run_id = f"run_{site['id']}_{start_utc[:10]}_{end_utc[:10]}_{int(step_s)}s"

    result_data = {
        "status": "Processed",
        "error": None,
        "run_id": run_id,
        "site": {
            "id": site["id"],
            "name": site["name"],
            "lat_deg": lat_deg,
            "lon_deg": lon_deg,
            "coverage": site.get("coverage", "verified"),
            "effective_resolution_m": site.get("effective_resolution_m", 30.0),
            "source": site["source"],
        },
        "interval": {
            "start_utc": start_utc,
            "end_utc": end_utc,
            "step_s": float(step_s),
            "n_samples": n_samples,
        },
        "time_series": {
            "times_utc": [celestial_engine.et_to_utc(t) for t in times_et],
            "sun_az_deg": [round(float(x), 3) for x in sun_az],
            "sun_el_deg": [round(float(x), 3) for x in sun_el],
            "earth_az_deg": [round(float(x), 3) for x in earth_az],
            "earth_el_deg": [round(float(x), 3) for x in earth_el],
            "sun_visible": [bool(x) for x in sun_visible],
            "earth_visible": [bool(x) for x in earth_visible],
        },
        "horizon": {
            "az_deg": [round(float(x), 2) for x in az_deg_arr],
            "elevation_deg": [round(float(x), 3) for x in el_deg_arr],
            "limited_flags": [bool(x) for x in limited_flags],
        },
        "metrics": {
            "sunlight": {
                "total_sunlight_s": sun_metrics["total_visible_s"],
                "total_darkness_s": sun_metrics["total_dark_s"],
                "longest_sunlight_run_s": sun_metrics["longest_visible_s"],
                "longest_dark_run_s": sun_metrics["longest_dark_s"],
                "max_solar_elevation_deg": sun_metrics["max_elevation_deg"],
                "mean_solar_elevation_deg": sun_metrics["mean_elevation_deg"],
                "sunlight_fraction": float(sun_metrics["total_visible_s"] / max(1.0, sun_metrics["total_visible_s"] + sun_metrics["total_dark_s"])),
            },
            "geometric_earth_visibility": {
                "total_visibility_s": earth_metrics["total_visible_s"],
                "total_blackout_s": earth_metrics["total_dark_s"],
                "longest_visibility_run_s": earth_metrics["longest_visible_s"],
                "longest_earth_blackout_s": earth_metrics["longest_dark_s"],
                "visibility_fraction": float(earth_metrics["total_visible_s"] / max(1.0, earth_metrics["total_visible_s"] + earth_metrics["total_dark_s"])),
            },
            "energy": energy_results,
        },
        "transitions": refined_transitions,
        "provenance": {
            "kernel_versions": ephem["kernel_versions"],
            "dataset_versions": [site.get("dem_product", "LOLA_5mpp_SouthPole")],
            "model_version": "STELLARON_v2.0",
            "sampling_s": float(step_s),
            "limb_convention": limb_convention,
            "observer_model": ephem["observer_model"],
            "frame": ephem["frame"],
            "abcorr": ephem["abcorr"],
            "assumptions": assumptions,
            "limitations": limitations,
        },
    }

    # Compute deterministic SHA-256 of canonical JSON payload
    canonical_str = canonical_json_dumps(result_data)
    result_sha256 = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
    result_data["provenance"]["result_sha256"] = result_sha256

    return result_data
