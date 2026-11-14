"""Tests for coordinate frames, ENU basis, and celestial azimuth/elevation geometry."""

import numpy as np
import pytest

from engine.geometry import (
    R_MOON_M,
    enu_basis,
    surface_site_vector,
    body_az_el,
    normalize_vector,
)


def test_enu_basis_equator():
    """Verify ENU basis at prime meridian equator (0 deg lat, 0 deg lon)."""
    e, n, u = enu_basis(0.0, 0.0)

    # At (0, 0): U is along +X, E is along +Y, N is along +Z
    np.testing.assert_allclose(u, [1.0, 0.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(e, [0.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(n, [0.0, 0.0, 1.0], atol=1e-12)

    # Orthonormality check
    assert np.isclose(np.linalg.norm(e), 1.0)
    assert np.isclose(np.linalg.norm(n), 1.0)
    assert np.isclose(np.linalg.norm(u), 1.0)
    assert np.isclose(np.dot(e, n), 0.0, atol=1e-12)
    assert np.isclose(np.dot(e, u), 0.0, atol=1e-12)
    assert np.isclose(np.dot(n, u), 0.0, atol=1e-12)

    # Right-handedness: E x N = U
    np.testing.assert_allclose(np.cross(e, n), u, atol=1e-12)


def test_enu_basis_poles():
    """Verify ENU basis at North (+90) and South (-90) poles."""
    # North Pole
    e_np, n_np, u_np = enu_basis(90.0, 0.0)
    np.testing.assert_allclose(u_np, [0.0, 0.0, 1.0], atol=1e-12)
    assert np.isclose(np.linalg.norm(e_np), 1.0)
    assert np.isclose(np.linalg.norm(n_np), 1.0)
    np.testing.assert_allclose(np.cross(e_np, n_np), u_np, atol=1e-12)

    # South Pole (vital for Shackleton / Artemis)
    e_sp, n_sp, u_sp = enu_basis(-90.0, 0.0)
    np.testing.assert_allclose(u_sp, [0.0, 0.0, -1.0], atol=1e-12)
    assert np.isclose(np.linalg.norm(e_sp), 1.0)
    assert np.isclose(np.linalg.norm(n_sp), 1.0)
    np.testing.assert_allclose(np.cross(e_sp, n_sp), u_sp, atol=1e-12)


def test_enu_basis_lon_wraparound():
    """Verify longitude wraparound at +/-180 and beyond."""
    e1, n1, u1 = enu_basis(10.0, 180.0)
    e2, n2, u2 = enu_basis(10.0, -180.0)
    np.testing.assert_allclose(e1, e2, atol=1e-12)
    np.testing.assert_allclose(n1, n2, atol=1e-12)
    np.testing.assert_allclose(u1, u2, atol=1e-12)

    # Arbitrary multiple of 360
    e3, n3, u3 = enu_basis(10.0, 540.0)
    np.testing.assert_allclose(e1, e3, atol=1e-12)


def test_enu_basis_out_of_bounds_latitude():
    """Verify that invalid latitudes raise ValueError."""
    with pytest.raises(ValueError):
        enu_basis(91.0, 0.0)
    with pytest.raises(ValueError):
        enu_basis(-90.01, 0.0)


def test_surface_site_vector():
    """Verify surface site position vector calculation with elevation."""
    pos = surface_site_vector(0.0, 0.0, elevation_m=1000.0, radius_m=R_MOON_M)
    expected_radius = R_MOON_M + 1000.0
    np.testing.assert_allclose(pos, [expected_radius, 0.0, 0.0], atol=1e-6)


def test_body_az_el_cardinal_directions():
    """Verify azimuth and elevation for cardinal ENU directions."""
    enu = enu_basis(0.0, 0.0)
    e, n, u = enu

    # Zenith: Elevation = 90 deg
    az, el = body_az_el(u, enu)
    assert np.isclose(el, 90.0, atol=1e-6)

    # Due North: Azimuth = 0 deg, Elevation = 0 deg
    az, el = body_az_el(n, enu)
    assert np.isclose(az, 0.0, atol=1e-6)
    assert np.isclose(el, 0.0, atol=1e-6)

    # Due East: Azimuth = 90 deg, Elevation = 0 deg
    az, el = body_az_el(e, enu)
    assert np.isclose(az, 90.0, atol=1e-6)
    assert np.isclose(el, 0.0, atol=1e-6)

    # Due South: Azimuth = 180 deg, Elevation = 0 deg
    az, el = body_az_el(-n, enu)
    assert np.isclose(az, 180.0, atol=1e-6)
    assert np.isclose(el, 0.0, atol=1e-6)

    # Due West: Azimuth = 270 deg, Elevation = 0 deg
    az, el = body_az_el(-e, enu)
    assert np.isclose(az, 270.0, atol=1e-6)
    assert np.isclose(el, 0.0, atol=1e-6)


def test_body_az_el_diagonal():
    """Verify azimuth and elevation for an arbitrary diagonal 45° angle."""
    enu = enu_basis(0.0, 0.0)
    e, n, u = enu

    # 45 deg elevation towards North-East (azimuth = 45 deg)
    diag = (e / np.sqrt(2.0)) + (n / np.sqrt(2.0)) + u
    az, el = body_az_el(diag, enu)
    assert np.isclose(az, 45.0, atol=1e-6)
    assert np.isclose(el, 45.0, atol=1e-6)
