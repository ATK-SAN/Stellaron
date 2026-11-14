"""Mission-level power generation and battery energy storage simulation.

Scientific conventions:
- Solar irradiance at 1 AU: G = 1361.0 W/m² (assumed nominal lunar surface insolation).
- Horizontal panel (default): P = A * eta * G * max(0, sin(elevation)) when Sun is visible.
- Tracking panel (assumption): P = A * eta * G when Sun is visible.
- Vertical panel (assumption): P = A * eta * G * max(0, cos(el) * cos(az - az_panel)) when Sun is visible.
- Battery energy: Discretized integration with charge efficiency (eta_c) and discharge efficiency (eta_d).
- Reserve threshold: soc_min defines the minimum allowable State-of-Charge (0.0 to 1.0).
  Intervals where SOC < soc_min are recorded as deficit intervals.
"""

from typing import Dict, List, Literal, Optional, Union, Any
import numpy as np

SOLAR_CONSTANT_W_M2: float = 1361.0


def compute_solar_power(
    elevation_deg: np.ndarray,
    azimuth_deg: np.ndarray,
    sun_visible: np.ndarray,
    panel_area_m2: float = 2.0,
    panel_efficiency: float = 0.28,
    orientation_mode: Literal["horizontal", "tracking", "vertical"] = "horizontal",
    panel_azimuth_deg: float = 0.0,
    solar_irradiance_w_m2: float = SOLAR_CONSTANT_W_M2,
) -> np.ndarray:
    """Compute generated solar electric power (Watts) across a time-series.

    Inputs:
        elevation_deg: Array of solar elevation angles in degrees
        azimuth_deg: Array of solar azimuth angles in degrees
        sun_visible: Boolean array indicating whether terrain permits direct sunlight
        panel_area_m2: Effective solar array area in square metres
        panel_efficiency: Solar cell conversion efficiency (e.g. 0.28 = 28%)
        orientation_mode: "horizontal", "tracking", or "vertical"
        panel_azimuth_deg: Azimuth of fixed vertical panel (degrees from North)
        solar_irradiance_w_m2: Solar constant at 1 AU (W/m²)

    Outputs:
        power_w: 1D numpy array of electrical power output (Watts)
    """
    el_rad = np.radians(elevation_deg)
    p_peak = panel_area_m2 * panel_efficiency * solar_irradiance_w_m2

    if orientation_mode == "horizontal":
        cos_theta = np.maximum(0.0, np.sin(el_rad))
    elif orientation_mode == "tracking":
        # Tracks the Sun directly as long as it is above the local horizontal
        cos_theta = np.where(elevation_deg > 0.0, 1.0, 0.0)
    elif orientation_mode == "vertical":
        az_diff_rad = np.radians(azimuth_deg - panel_azimuth_deg)
        cos_theta = np.maximum(0.0, np.cos(el_rad) * np.cos(az_diff_rad))
    else:
        raise ValueError(f"Unknown orientation_mode: {orientation_mode}")

    # Power is only generated when the Sun is visible (unblocked by terrain)
    power_w = p_peak * cos_theta * sun_visible.astype(np.float64)
    return np.maximum(0.0, power_w)


def simulate_battery(
    solar_power_w: np.ndarray,
    times_s: np.ndarray,
    battery_capacity_wh: float = 1000.0,
    initial_soc: float = 1.0,
    p_load_w: Union[float, np.ndarray] = 50.0,
    eta_c: float = 0.92,
    eta_d: float = 0.92,
    soc_min: float = 0.20,
) -> Dict[str, Any]:
    """Simulate battery State-of-Charge (SOC) timeline and energy deficit intervals.

    Inputs:
        solar_power_w: Array of solar generation power (Watts)
        times_s: Array of epoch seconds corresponding to each sample
        battery_capacity_wh: Total battery storage capacity in Watt-hours
        initial_soc: Initial State-of-Charge [0.0, 1.0]
        p_load_w: Constant load in Watts, or array of load in Watts matching times_s
        eta_c: Charging efficiency factor [0.0, 1.0]
        eta_d: Discharging efficiency factor [0.0, 1.0]
        soc_min: Minimum reserve SOC threshold [0.0, 1.0]

    Outputs:
        Dict containing:
            soc_history: Array of SOC values [0.0, 1.0] over time
            energy_stored_wh: Array of stored energy in Watt-hours
            generated_wh: Total energy generated (Wh)
            consumed_wh: Total energy consumed by load (Wh)
            min_soc: Minimum SOC reached
            time_below_reserve_s: Total duration (seconds) spent below soc_min
            deficit_intervals: List of contiguous intervals below soc_min
    """
    n = len(times_s)
    if n == 0:
        raise ValueError("times_s must not be empty")
    if len(solar_power_w) != n:
        raise ValueError("solar_power_w and times_s must have the same length")
    if battery_capacity_wh <= 0.0:
        raise ValueError("battery_capacity_wh must be positive")

    if np.isscalar(p_load_w):
        load_array = np.full(n, float(p_load_w), dtype=np.float64)
    else:
        load_array = np.asarray(p_load_w, dtype=np.float64)
        if len(load_array) != n:
            raise ValueError("p_load_w array length must match times_s")

    soc_history = np.zeros(n, dtype=np.float64)
    energy_stored_wh = np.zeros(n, dtype=np.float64)

    current_energy_wh = float(np.clip(initial_soc, 0.0, 1.0) * battery_capacity_wh)
    soc_history[0] = current_energy_wh / battery_capacity_wh
    energy_stored_wh[0] = current_energy_wh

    total_generated_wh = 0.0
    total_consumed_wh = 0.0

    for i in range(n - 1):
        dt_s = float(times_s[i + 1] - times_s[i])
        dt_h = dt_s / 3600.0

        p_gen = float(solar_power_w[i])
        p_load = float(load_array[i])

        total_generated_wh += p_gen * dt_h
        total_consumed_wh += p_load * dt_h

        p_net = p_gen - p_load

        if p_net > 0.0:
            # Net charging
            added_energy = p_net * dt_h * eta_c
            current_energy_wh = min(battery_capacity_wh, current_energy_wh + added_energy)
        elif p_net < 0.0:
            # Net discharging
            required_energy = (abs(p_net) * dt_h) / eta_d
            current_energy_wh = max(0.0, current_energy_wh - required_energy)

        energy_stored_wh[i + 1] = current_energy_wh
        soc_history[i + 1] = current_energy_wh / battery_capacity_wh

    # Energy deficit intervals (where SOC < soc_min)
    deficit_mask = soc_history < soc_min
    time_below_reserve_s = 0.0
    deficit_intervals: List[Dict[str, Any]] = []

    if np.any(deficit_mask):
        in_deficit = False
        start_idx = 0
        for i in range(n):
            if deficit_mask[i] and not in_deficit:
                in_deficit = True
                start_idx = i
            elif not deficit_mask[i] and in_deficit:
                in_deficit = False
                end_idx = i - 1
                t_start = float(times_s[start_idx])
                t_end = float(times_s[end_idx])
                dur = max(0.0, t_end - t_start)
                time_below_reserve_s += dur
                deficit_intervals.append({
                    "start_s": t_start,
                    "end_s": t_end,
                    "duration_s": dur,
                    "censored": (start_idx == 0),
                    "min_soc_in_interval": float(np.min(soc_history[start_idx : end_idx + 1])),
                })

        if in_deficit:
            end_idx = n - 1
            t_start = float(times_s[start_idx])
            t_end = float(times_s[end_idx])
            dur = max(0.0, t_end - t_start)
            time_below_reserve_s += dur
            deficit_intervals.append({
                "start_s": t_start,
                "end_s": t_end,
                "duration_s": dur,
                "censored": True,
                "min_soc_in_interval": float(np.min(soc_history[start_idx : end_idx + 1])),
            })

    return {
        "soc_history": soc_history,
        "energy_stored_wh": energy_stored_wh,
        "generated_wh": total_generated_wh,
        "consumed_wh": total_consumed_wh,
        "min_soc": float(np.min(soc_history)),
        "time_below_reserve_s": time_below_reserve_s,
        "deficit_intervals": deficit_intervals,
    }
