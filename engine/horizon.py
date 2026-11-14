"""Terrain horizon profile calculation via DEM ray-marching with lunar curvature.

Scientific conventions:
- Frame: Topocentric horizontal tangent plane at observer location.
- Azimuth: Degrees clockwise from North (0° = N, 90° = E, 180° = S, 270° = W).
- Lunar curvature drop: delta_z = d^2 / (2 * R_MOON), with R_MOON = 1737400.0 m.
- Ray step: Vectorized sampling along each azimuth up to max_d.
- Edge condition: If a ray hits the DEM boundary before max_d, flag azimuth as limited.
"""

from typing import Tuple, Optional
import numpy as np

R_MOON_M: float = 1737400.0


def horizon_profile(
    dem: np.ndarray,
    pixel_m: float,
    row: int,
    col: int,
    n_az: int = 360,
    max_d: float = 30000.0,
    radius_m: float = R_MOON_M,
    observer_height_m: float = 0.0,
    step_m: Optional[float] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute terrain horizon elevation angles around an observer on a DEM.

    Inputs:
        dem: 2D numpy array [H, W] of surface elevations in metres
        pixel_m: Pixel resolution in metres (must be positive)
        row: Observer row index (0 <= row < H)
        col: Observer column index (0 <= col < W)
        n_az: Number of azimuth samples (>= 4, e.g. 360 for 1°, 720 for 0.5°)
        max_d: Maximum ray distance in metres (default 30,000 m = 30 km)
        radius_m: Mean lunar sphere radius in metres (default 1,737,400 m)
        observer_height_m: Observer instrument height above terrain in metres
        step_m: Sampling distance step along ray in metres (default: 1.0 * pixel_m)

    Outputs:
        az_deg_array: 1D array of azimuths [0, 360) in degrees
        elevation_deg_array: 1D array of horizon elevation angles in degrees
        limited_flags: 1D boolean array, True where ray reached DEM tile edge before max_d
    """
    if dem.ndim != 2:
        raise ValueError(f"DEM must be a 2D array, got shape {dem.shape}")
    H, W = dem.shape

    if not (0 <= row < H and 0 <= col < W):
        raise ValueError(f"Observer position ({row}, {col}) is outside DEM dimensions ({H}, {W})")
    if pixel_m <= 0:
        raise ValueError(f"pixel_m must be positive, got {pixel_m}")
    if n_az < 4:
        raise ValueError(f"n_az must be >= 4, got {n_az}")
    if max_d <= 0:
        raise ValueError(f"max_d must be positive, got {max_d}")

    z_ground = float(dem[row, col])
    if np.isnan(z_ground):
        raise ValueError(f"Observer elevation at ({row}, {col}) is NaN / NoData")
    z_obs = z_ground + observer_height_m

    if step_m is None or step_m <= 0:
        step_m = max(pixel_m, 10.0)

    radii = np.arange(step_m, max_d + (step_m * 0.5), step_m, dtype=np.float64)
    if len(radii) == 0:
        radii = np.array([max_d], dtype=np.float64)
    num_steps = len(radii)

    az_deg_array = np.linspace(0.0, 360.0, n_az, endpoint=False, dtype=np.float64)
    az_rad = np.radians(az_deg_array)

    # Standard North-up raster convention:
    # North is -row, South is +row, East is +col, West is -col.
    # delta_east = d * sin(az), delta_north = d * cos(az)
    delta_col = radii[None, :] * np.sin(az_rad)[:, None] / pixel_m  # shape (n_az, num_steps)
    delta_row = -radii[None, :] * np.cos(az_rad)[:, None] / pixel_m  # shape (n_az, num_steps)

    sample_rows = np.round(row + delta_row).astype(np.int64)
    sample_cols = np.round(col + delta_col).astype(np.int64)

    # In-bounds mask
    valid_mask = (
        (sample_rows >= 0)
        & (sample_rows < H)
        & (sample_cols >= 0)
        & (sample_cols < W)
    )

    # Safe indexing for in-bounds coordinates
    safe_rows = np.clip(sample_rows, 0, H - 1)
    safe_cols = np.clip(sample_cols, 0, W - 1)
    z_sampled = dem[safe_rows, safe_cols]

    # Exclude NoData or NaN
    valid_mask = valid_mask & (~np.isnan(z_sampled))

    # Curvature drop: delta_z = d^2 / (2 * R)
    curv_drop = (radii ** 2) / (2.0 * radius_m)  # shape (num_steps,)

    # Effective height above observer horizontal plane
    h_eff = z_sampled - z_obs - curv_drop[None, :]

    # Elevation angle in degrees
    angles = np.degrees(np.arctan2(h_eff, radii[None, :]))

    # Set invalid (out of bounds or NaN) sample angles to -inf
    angles[~valid_mask] = -np.inf

    # Check limited condition: ray reached DEM edge before max_d
    # If the last step is not valid, or if all steps are invalid, it reached the edge
    last_step_valid = valid_mask[:, -1]
    raw_limited = ~last_step_valid

    # Maximum elevation angle along each ray
    # Handle rays where all samples were out of bounds
    any_valid = np.any(valid_mask, axis=1)
    elevation_deg_array = np.zeros(n_az, dtype=np.float64)
    limited_list = [False] * n_az

    for i in range(n_az):
        if any_valid[i]:
            elevation_deg_array[i] = float(np.max(angles[i, valid_mask[i]]))
            limited_list[i] = bool(raw_limited[i])
        else:
            elevation_deg_array[i] = 0.0
            limited_list[i] = True

    limited_flags = np.array(limited_list, dtype=object)
    return (az_deg_array, elevation_deg_array, limited_flags)
