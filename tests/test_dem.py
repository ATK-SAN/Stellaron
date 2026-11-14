"""Gate 3: DEM metadata, slope, aspect, roughness, and landing footprint hazard tests."""

import numpy as np
import pytest

from engine.terrain import (
    compute_slope_aspect,
    compute_roughness,
    assess_landing_footprint,
)


def test_slope_analytical_45_degree_ramp():
    """Verify slope returns exactly 45 degrees on a 1:1 ramp (dz/dx = 1.0)."""
    H, W = 51, 51
    pixel_m = 10.0
    # Elevation increases by 10m per column (10m / 10m = 1.0 grade)
    dem = np.tile(np.arange(W, dtype=np.float64) * pixel_m, (H, 1))

    slope, aspect = compute_slope_aspect(dem, pixel_m)

    # In the interior (away from edge boundary finite differences)
    interior_slope = slope[5:-5, 5:-5]
    np.testing.assert_allclose(interior_slope, 45.0, atol=1e-5)


def test_aspect_cardinal_directions():
    """Verify aspect angle clockwise from North for pure cardinal descent."""
    H, W = 41, 41
    pixel_m = 10.0

    # 1. Ramp descending towards South: row index increases Southwards, so elevation decreases with increasing row
    dem_south = np.repeat(-np.arange(H, dtype=np.float64)[:, None] * 10.0, W, axis=1)
    _, aspect_s = compute_slope_aspect(dem_south, pixel_m)
    np.testing.assert_allclose(aspect_s[5:-5, 5:-5], 180.0, atol=1e-5)

    # 2. Ramp descending towards North: elevation decreases with decreasing row
    dem_north = np.repeat(np.arange(H, dtype=np.float64)[:, None] * 10.0, W, axis=1)
    _, aspect_n = compute_slope_aspect(dem_north, pixel_m)
    np.testing.assert_allclose(aspect_n[5:-5, 5:-5], 0.0, atol=1e-5)

    # 3. Ramp descending towards East: col increases Eastwards, elevation decreases with increasing col
    dem_east = np.tile(-np.arange(W, dtype=np.float64) * 10.0, (H, 1))
    _, aspect_e = compute_slope_aspect(dem_east, pixel_m)
    np.testing.assert_allclose(aspect_e[5:-5, 5:-5], 90.0, atol=1e-5)

    # 4. Ramp descending towards West: elevation increases with increasing col
    dem_west = np.tile(np.arange(W, dtype=np.float64) * 10.0, (H, 1))
    _, aspect_w = compute_slope_aspect(dem_west, pixel_m)
    np.testing.assert_allclose(aspect_w[5:-5, 5:-5], 270.0, atol=1e-5)


def test_flat_surface_zero_roughness():
    """On flat surface, roughness must be exactly 0.0."""
    dem = np.full((31, 31), 1250.0, dtype=np.float64)
    rough = compute_roughness(dem, window_size=3)
    np.testing.assert_allclose(rough, 0.0, atol=1e-10)


def test_assess_landing_footprint_circular_metrics():
    """Verify statistical metrics over a known circular landing footprint."""
    H, W = 61, 61
    pixel_m = 5.0
    center = 30  # center pixel
    dem = np.full((H, W), 1000.0, dtype=np.float64)

    # Add a 5m mound in the center
    dem[center, center] = 1005.0

    res = assess_landing_footprint(dem, pixel_m=pixel_m, row=center, col=center, radius_m=20.0)

    assert res["valid_data_fraction"] == 1.0
    assert res["center_elevation_m"] == 1005.0
    assert res["max_elevation_m"] == 1005.0
    assert res["min_elevation_m"] == 1000.0
    assert res["relief_m"] == 5.0
    assert res["mean_slope_deg"] > 0.0


def test_assess_landing_footprint_with_nan_nodata():
    """Footprint containing NaN values reports correct reduced valid_data_fraction."""
    H, W = 51, 51
    pixel_m = 10.0
    dem = np.full((H, W), 500.0, dtype=np.float64)

    # Inject NaNs in one quadrant
    dem[20:30, 20:30] = np.nan

    res = assess_landing_footprint(dem, pixel_m=pixel_m, row=25, col=25, radius_m=100.0)

    assert 0.0 < res["valid_data_fraction"] < 1.0
    assert res["mean_elevation_m"] == 500.0
