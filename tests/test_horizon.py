"""Tests for DEM ray-marching horizon profile computation."""

import time
import numpy as np
import pytest

from engine.horizon import horizon_profile, R_MOON_M


def test_flat_terrain_with_lunar_curvature():
    """On flat ground (z = 0), lunar curvature causes terrain to drop below the tangent plane."""
    H, W = 101, 101
    dem = np.zeros((H, W), dtype=np.float64)
    pixel_m = 20.0
    center = 50

    az_deg, el_deg, limited = horizon_profile(
        dem=dem,
        pixel_m=pixel_m,
        row=center,
        col=center,
        n_az=36,
        max_d=1000.0,
        radius_m=R_MOON_M,
        observer_height_m=0.0,
    )

    # All horizon angles on a flat sphere with no obstacle must be negative or zero (due to drop)
    assert np.all(el_deg <= 0.0)


def test_known_ridge_analytical_elevation():
    """Verify horizon elevation matches analytical trigonometry for an obstacle of known height and distance."""
    H, W = 201, 201
    dem = np.zeros((H, W), dtype=np.float64)
    pixel_m = 10.0
    row_obs, col_obs = 100, 100

    # Place a 50m high ridge 50 pixels due North (row 50, col 100)
    # Distance d = 50 * 10 = 500 m
    ridge_row = 50
    ridge_h = 50.0
    dem[ridge_row, :] = ridge_h

    d_m = 500.0
    curv_drop_m = (d_m ** 2) / (2.0 * R_MOON_M)
    h_eff_m = ridge_h - curv_drop_m
    expected_el_deg = np.degrees(np.arctan(h_eff_m / d_m))

    az_deg, el_deg, limited = horizon_profile(
        dem=dem,
        pixel_m=pixel_m,
        row=row_obs,
        col=col_obs,
        n_az=360,
        max_d=1000.0,
        radius_m=R_MOON_M,
        observer_height_m=0.0,
        step_m=10.0,
    )

    # Azimuth 0 is due North
    north_idx = 0
    assert np.isclose(az_deg[north_idx], 0.0)
    # Measured elevation angle should match analytical calculation to within 0.02 degrees
    assert np.isclose(el_deg[north_idx], expected_el_deg, atol=0.02)


def test_observer_height_lowers_horizon():
    """Raising the observer instrument height (z0) must strictly decrease or maintain the horizon angle."""
    H, W = 101, 101
    dem = np.zeros((H, W), dtype=np.float64)
    dem[20, :] = 30.0  # obstacle to the North

    az_0, el_0, _ = horizon_profile(dem, 10.0, 50, 50, n_az=36, max_d=600.0, observer_height_m=0.0)
    az_2, el_2, _ = horizon_profile(dem, 10.0, 50, 50, n_az=36, max_d=600.0, observer_height_m=2.0)

    assert np.all(el_2 <= el_0 + 1e-9)
    # The obstacle to the North must have a strictly lower apparent angle
    assert el_2[0] < el_0[0]


def test_tile_boundary_limited_flag():
    """Rays that exit the DEM before reaching max_d must be flagged as limited."""
    H, W = 50, 50
    dem = np.zeros((H, W), dtype=np.float64)
    # Observer placed right near the top-left edge (row 2, col 2)
    # max_d = 2000m while DEM is only 500m wide (50 * 10m)
    az_deg, el_deg, limited = horizon_profile(dem, 10.0, 2, 2, n_az=36, max_d=2000.0)

    # Ray to the North (0 deg) and West (270 deg) should immediately exit
    assert limited[0] is True  # North exits immediately


def test_dem_nan_holes_handled_gracefully():
    """NaN / NoData cells in DEM must not crash the calculation."""
    H, W = 81, 81
    dem = np.zeros((H, W), dtype=np.float64)
    # Inject NaN hole
    dem[30:35, 30:35] = np.nan

    az_deg, el_deg, limited = horizon_profile(dem, 10.0, 40, 40, n_az=72, max_d=500.0)
    assert not np.any(np.isnan(el_deg))


def test_horizon_execution_performance():
    """Verify that ray-marching 360 azimuths completes in < 0.5s."""
    H, W = 256, 256
    dem = np.random.uniform(0.0, 100.0, size=(H, W))

    t0 = time.perf_counter()
    az_deg, el_deg, limited = horizon_profile(dem, 20.0, 128, 128, n_az=360, max_d=10000.0)
    dt = time.perf_counter() - t0

    assert len(az_deg) == 360
    assert len(el_deg) == 360
    assert dt < 0.5, f"Horizon calculation took {dt:.3f}s, expected < 0.5s"
