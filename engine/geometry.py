"""Coordinate frames, basis vectors, and celestial azimuth/elevation transformations.

Scientific conventions:
- Frame: East-North-Up (ENU) local topocentric frame.
- Azimuth: Degrees clockwise from North (0° = North, 90° = East, 180° = South, 270° = West).
- Elevation: Degrees above the local horizontal tangent plane (-90° to +90°).
- Latitude: Positive North, range [-90.0, 90.0].
- Longitude: Positive East, range [-180.0, 180.0].
- Mean lunar radius: R_MOON = 1737400.0 m (1737.4 km).
"""

from typing import Tuple, Union
import numpy as np

R_MOON_M: float = 1737400.0


def normalize_vector(v: np.ndarray) -> np.ndarray:
    """Normalize a 3D vector or batch of vectors to unit norm."""
    norm = np.linalg.norm(v, axis=-1, keepdims=True)
    if np.any(norm == 0):
        raise ValueError("Cannot normalize a zero vector.")
    return v / norm


def enu_basis(lat_deg: float, lon_deg: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute orthonormal East-North-Up (ENU) basis vectors in Moon body-fixed frame (MOON_ME).

    Inputs:
        lat_deg: Lunar latitude in degrees, [-90.0, 90.0]
        lon_deg: Lunar longitude in degrees, [-180.0, 180.0]

    Outputs:
        (E, N, U): Tuple of 3-element unit numpy vectors forming a right-handed basis (E x N = U).
    """
    if not (-90.0 <= lat_deg <= 90.0):
        raise ValueError(f"Latitude out of range [-90, 90]: {lat_deg}")

    # Wrap longitude into [-180, 180]
    lon_deg_wrapped = ((lon_deg + 180.0) % 360.0) - 180.0

    phi = np.radians(lat_deg)
    lam = np.radians(lon_deg_wrapped)

    cos_phi = np.cos(phi)
    sin_phi = np.sin(phi)
    cos_lam = np.cos(lam)
    sin_lam = np.sin(lam)

    # Up vector (radial outward)
    u = np.array([cos_phi * cos_lam, cos_phi * sin_lam, sin_phi], dtype=np.float64)

    # East vector (along increasing longitude)
    e = np.array([-sin_lam, cos_lam, 0.0], dtype=np.float64)

    # North vector (along increasing latitude)
    # At poles, cos_phi = 0, but sin_phi = +/-1 retains a well-defined direction pointing along meridian
    n = np.array([-sin_phi * cos_lam, -sin_phi * sin_lam, cos_phi], dtype=np.float64)

    # Ensure exact unit length and orthogonality
    e = e / np.linalg.norm(e)
    n = n / np.linalg.norm(n)
    u = u / np.linalg.norm(u)

    return (e, n, u)


def surface_site_vector(
    lat_deg: float,
    lon_deg: float,
    elevation_m: float = 0.0,
    radius_m: float = R_MOON_M,
) -> np.ndarray:
    """Compute 3D position of surface site in Moon body-fixed frame (metres).

    Inputs:
        lat_deg: Lunar latitude in degrees [-90.0, 90.0]
        lon_deg: Lunar longitude in degrees [-180.0, 180.0]
        elevation_m: Elevation above mean reference sphere in metres (default 0.0)
        radius_m: Reference lunar radius in metres (default 1737400.0)

    Outputs:
        3-element numpy array [x, y, z] in metres
    """
    _, _, u = enu_basis(lat_deg, lon_deg)
    return (radius_m + elevation_m) * u


def body_az_el(
    target_vector: np.ndarray,
    enu: Tuple[np.ndarray, np.ndarray, np.ndarray],
) -> Tuple[float, float]:
    """Compute local topocentric azimuth and elevation of a target from ENU basis.

    Azimuth is measured clockwise from North:
        0° = North, 90° = East, 180° = South, 270° = West.
    Elevation is measured above the horizontal tangent plane:
        [-90°, +90°].

    Inputs:
        target_vector: 3D vector pointing from observer to target (or Moon centre if using centre approx)
        enu: Tuple of (East, North, Up) basis vectors

    Outputs:
        (az_deg, el_deg): Azimuth in [0, 360) and Elevation in [-90, +90]
    """
    e_unit, n_unit, u_unit = enu
    v = target_vector / np.linalg.norm(target_vector)

    v_e = float(np.dot(v, e_unit))
    v_n = float(np.dot(v, n_unit))
    v_u = float(np.dot(v, u_unit))

    # Elevation: arcsin(dot(v, U))
    v_u_clipped = np.clip(v_u, -1.0, 1.0)
    el_deg = float(np.degrees(np.arcsin(v_u_clipped)))

    # Azimuth: clockwise from North (0° = N, 90° = E)
    # atan2(East, North) gives 0 at North, +pi/2 at East, +/-pi at South, -pi/2 at West
    az_deg = float(np.degrees(np.arctan2(v_e, v_n)) % 360.0)

    return (az_deg, el_deg)
