"""Tests for solar power generation models and battery energy simulation."""

import numpy as np
import pytest

from engine.energy import (
    SOLAR_CONSTANT_W_M2,
    compute_solar_power,
    simulate_battery,
)


def test_horizontal_panel_power_analytical():
    """Verify horizontal panel solar generation matches analytical P = A * eta * G * sin(el)."""
    el = np.array([30.0, 90.0, -5.0, 30.0])
    az = np.zeros(4)
    # 4th sample is terrain blocked
    sun_vis = np.array([True, True, True, False])

    area = 2.0
    eta = 0.28
    g = 1361.0

    power = compute_solar_power(
        elevation_deg=el,
        azimuth_deg=az,
        sun_visible=sun_vis,
        panel_area_m2=area,
        panel_efficiency=eta,
        orientation_mode="horizontal",
        solar_irradiance_w_m2=g,
    )

    # At 30 deg elevation: sin(30) = 0.5
    expected_30 = area * eta * g * 0.5
    assert np.isclose(power[0], expected_30, atol=1e-6)

    # At 90 deg elevation: sin(90) = 1.0
    expected_90 = area * eta * g * 1.0
    assert np.isclose(power[1], expected_90, atol=1e-6)

    # Below horizon: 0.0 W
    assert power[2] == 0.0

    # Terrain blocked: 0.0 W
    assert power[3] == 0.0


def test_tracking_panel_mode():
    """Tracking panel generates full perpendicular power when Sun is above horizon."""
    el = np.array([10.0, -2.0])
    az = np.zeros(2)
    sun_vis = np.array([True, True])

    area = 1.0
    eta = 0.30
    g = 1000.0

    power = compute_solar_power(
        elevation_deg=el,
        azimuth_deg=az,
        sun_visible=sun_vis,
        panel_area_m2=area,
        panel_efficiency=eta,
        orientation_mode="tracking",
        solar_irradiance_w_m2=g,
    )

    assert np.isclose(power[0], 300.0)
    assert power[1] == 0.0


def test_battery_charge_and_cap():
    """Battery charges with surplus solar generation and caps at 100% (1.0)."""
    times_s = np.array([0.0, 3600.0, 7200.0])  # 2 hours
    solar_w = np.array([200.0, 200.0, 200.0])
    load_w = 50.0  # Surplus = 150 W

    sim = simulate_battery(
        solar_power_w=solar_w,
        times_s=times_s,
        battery_capacity_wh=200.0,
        initial_soc=0.5,  # 100 Wh stored
        p_load_w=load_w,
        eta_c=1.0,
        eta_d=1.0,
    )

    # Hour 1: adds 150 Wh -> 250 Wh, but capped at 200 Wh (1.0 SOC)
    assert sim["soc_history"][1] == 1.0
    assert sim["energy_stored_wh"][1] == 200.0
    assert sim["soc_history"][2] == 1.0


def test_battery_deficit_intervals_and_soc_min():
    """Verify that dropping below soc_min triggers deficit intervals and accumulates duration."""
    times_s = np.linspace(0.0, 10800.0, 4)  # 0, 1h, 2h, 3h (dt = 3600s)
    solar_w = np.zeros(4)  # Complete darkness
    load_w = 50.0  # 50 W load
    cap_wh = 100.0

    sim = simulate_battery(
        solar_power_w=solar_w,
        times_s=times_s,
        battery_capacity_wh=cap_wh,
        initial_soc=1.0,  # 100 Wh stored
        p_load_w=load_w,
        eta_c=1.0,
        eta_d=1.0,
        soc_min=0.20,  # 20 Wh reserve threshold
    )

    # t=0: 100 Wh (SOC=1.0)
    # t=1h: 50 Wh (SOC=0.5)
    # t=2h: 0 Wh (SOC=0.0) -> below 0.20 reserve!
    # t=3h: 0 Wh (SOC=0.0)
    assert sim["soc_history"][0] == 1.0
    assert sim["soc_history"][1] == 0.5
    assert sim["soc_history"][2] == 0.0
    assert sim["soc_history"][3] == 0.0

    assert sim["min_soc"] == 0.0
    assert len(sim["deficit_intervals"]) > 0
    assert sim["time_below_reserve_s"] > 0.0


def test_battery_empty_floor():
    """Battery energy stored cannot drop below 0.0."""
    times_s = np.array([0.0, 3600.0])
    solar_w = np.array([0.0, 0.0])
    load_w = 500.0  # Exceeds total stored capacity

    sim = simulate_battery(
        solar_power_w=solar_w,
        times_s=times_s,
        battery_capacity_wh=50.0,
        initial_soc=0.2,  # 10 Wh
        p_load_w=load_w,
    )

    assert sim["energy_stored_wh"][1] == 0.0
    assert sim["soc_history"][1] == 0.0
