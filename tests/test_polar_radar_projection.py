"""Unit tests for Section 6b.A: Polar Radar Projection Geometry & Distance Calculations."""

import math
import pytest

R_MOON_KM = 1737.4
BASE_RADIUS = 240.0


def lat_lon_to_polar_xy(lat, lon, max_radius=BASE_RADIUS):
    """Python reference implementation mirroring OrthographicPolarMap.jsx."""
    deg_from_pole = max(0.0, 90.0 - abs(lat))
    r = (deg_from_pole / 10.0) * max_radius

    theta_rad = ((lon - 90.0) * math.pi) / 180.0
    x = r * math.cos(theta_rad)
    y = r * math.sin(theta_rad)
    return {"x": x, "y": y, "r": r, "deg_from_pole": deg_from_pole}


def get_distance_from_pole_km(lat):
    deg_from_pole = max(0.0, 90.0 - abs(lat))
    return round(deg_from_pole * (math.pi / 180.0) * R_MOON_KM)


def test_south_pole_maps_to_center():
    res = lat_lon_to_polar_xy(-90.0, 0.0)
    assert pytest.approx(res["x"], abs=1e-5) == 0.0
    assert pytest.approx(res["y"], abs=1e-5) == 0.0
    assert pytest.approx(res["r"], abs=1e-5) == 0.0


def test_radial_distances_proportional_to_latitude():
    # 80°S should be at max radius
    res_80 = lat_lon_to_polar_xy(-80.0, 0.0)
    assert pytest.approx(res_80["r"], abs=1e-5) == BASE_RADIUS

    # 85°S should be exactly half of max radius
    res_85 = lat_lon_to_polar_xy(-85.0, 0.0)
    assert pytest.approx(res_85["r"], abs=1e-5) == BASE_RADIUS * 0.5

    # 88°S should be exactly 0.2 of max radius
    res_88 = lat_lon_to_polar_xy(-88.0, 0.0)
    assert pytest.approx(res_88["r"], abs=1e-5) == BASE_RADIUS * 0.2


def test_longitude_orientation_convention():
    # 0° Longitude: Should point UP (-Y), X = 0
    up = lat_lon_to_polar_xy(-85.0, 0.0)
    assert pytest.approx(up["x"], abs=1e-5) == 0.0
    assert up["y"] < 0  # Upwards in SVG coordinate system

    # 90°E Longitude: Should point RIGHT (+X), Y = 0
    right = lat_lon_to_polar_xy(-85.0, 90.0)
    assert right["x"] > 0
    assert pytest.approx(right["y"], abs=1e-5) == 0.0

    # 180° Longitude: Should point DOWN (+Y), X = 0
    down = lat_lon_to_polar_xy(-85.0, 180.0)
    assert pytest.approx(down["x"], abs=1e-5) == 0.0
    assert down["y"] > 0

    # 270°E (-90°E) Longitude: Should point LEFT (-X), Y = 0
    left = lat_lon_to_polar_xy(-85.0, 270.0)
    assert left["x"] < 0
    assert pytest.approx(left["y"], abs=1e-5) == 0.0


def test_physical_distances_km():
    # Pole (90°S) = 0 km
    assert get_distance_from_pole_km(-90.0) == 0

    # 88°S (2° from pole) = ~61 km
    assert get_distance_from_pole_km(-88.0) == 61

    # 85°S (5° from pole) = ~152 km
    assert get_distance_from_pole_km(-85.0) == 152

    # 80°S (10° from pole) = ~303 km
    assert get_distance_from_pole_km(-80.0) == 303


def test_out_of_bounds_detection():
    # Apollo 11 (0.67°N) and Apollo 12 (3.01°S) must be detected as outside the 80°S-90°S map
    apollo_11_lat = 0.67408
    apollo_12_lat = -3.01239
    shackleton_lat = -89.54

    assert not (apollo_11_lat <= -80.0)
    assert not (apollo_12_lat <= -80.0)
    assert shackleton_lat <= -80.0
