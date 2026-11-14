"""Terrain engine for lunar Digital Elevation Models (DEMs).

Computes:
- Slope (degrees) via gradient analysis with pixel spacing.
- Aspect (degrees clockwise from North) of steepest downslope.
- Terrain roughness (local elevation standard deviation).
- Local relief (max - min elevation in neighbourhood).
- Landing footprint statistical hazard assessment.
"""

from typing import Dict, Tuple, Optional, Any
import numpy as np
from scipy import ndimage


def compute_slope_aspect(
    dem: np.ndarray,
    pixel_m: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute terrain slope and aspect arrays from a 2D DEM.

    Inputs:
        dem: 2D numpy array [H, W] of elevations in metres
        pixel_m: Pixel resolution in metres (must be positive)

    Outputs:
        (slope_deg, aspect_deg):
            slope_deg: Elevation slope angle in degrees [0, 90]
            aspect_deg: Azimuth of steepest descent in degrees clockwise from North [0, 360)
    """
    if dem.ndim != 2:
        raise ValueError(f"dem must be 2D, got shape {dem.shape}")
    if pixel_m <= 0:
        raise ValueError(f"pixel_m must be positive, got {pixel_m}")

    # Standard North-up raster convention:
    # row index increases Southwards (+row -> -y)
    # col index increases Eastwards (+col -> +x)
    # dy = -d_row * pixel_m, dx = d_col * pixel_m
    dz_drow, dz_dcol = np.gradient(dem, pixel_m, pixel_m)

    dz_dx = dz_dcol
    dz_dy = -dz_drow

    grad_mag = np.sqrt(dz_dx ** 2 + dz_dy ** 2)
    slope_deg = np.degrees(np.arctan(grad_mag))

    # Aspect is direction of steepest downslope (-grad z):
    # -dz_dx points Eastwards, -dz_dy points Northwards
    # Azimuth clockwise from North: atan2(East, North) = atan2(-dz_dx, -dz_dy)
    aspect_deg = np.degrees(np.arctan2(-dz_dx, -dz_dy)) % 360.0

    return (slope_deg, aspect_deg)


def compute_roughness(
    dem: np.ndarray,
    window_size: int = 3,
) -> np.ndarray:
    """Compute local terrain roughness as the local standard deviation of elevation.

    Inputs:
        dem: 2D numpy array [H, W] of elevations in metres
        window_size: Integer size of moving window (e.g. 3 for 3x3)

    Outputs:
        roughness_m: 2D array of local elevation standard deviation in metres
    """
    if window_size < 3 or window_size % 2 == 0:
        raise ValueError(f"window_size must be an odd integer >= 3, got {window_size}")

    # E[X^2] - (E[X])^2
    mean = ndimage.uniform_filter(dem, size=window_size, mode="reflect")
    sq_mean = ndimage.uniform_filter(dem ** 2, size=window_size, mode="reflect")
    variance = np.maximum(0.0, sq_mean - (mean ** 2))
    return np.sqrt(variance)


def assess_landing_footprint(
    dem: np.ndarray,
    pixel_m: float,
    row: int,
    col: int,
    radius_m: float = 50.0,
) -> Dict[str, Any]:
    """Evaluate terrain metrics and hazard indicators over a circular landing footprint.

    Inputs:
        dem: 2D numpy array [H, W] of elevations in metres
        pixel_m: Pixel resolution in metres
        row: Center row index
        col: Center col index
        radius_m: Footprint radius in metres (default 50m)

    Outputs:
        Dict containing elevation, slope, roughness, relief, and coverage quality metrics.
    """
    H, W = dem.shape
    if not (0 <= row < H and 0 <= col < W):
        raise ValueError(f"Center position ({row}, {col}) is outside DEM ({H}, {W})")

    radius_pix = max(1, int(np.ceil(radius_m / pixel_m)))
    r_min = max(0, row - radius_pix)
    r_max = min(H, row + radius_pix + 1)
    c_min = max(0, col - radius_pix)
    c_max = min(W, col + radius_pix + 1)

    sub_dem = dem[r_min:r_max, c_min:c_max]
    sub_rows, sub_cols = np.ogrid[r_min:r_max, c_min:c_max]
    dist_m = np.sqrt(((sub_rows - row) * pixel_m) ** 2 + ((sub_cols - col) * pixel_m) ** 2)
    circle_mask = dist_m <= radius_m

    valid_cells = circle_mask & (~np.isnan(sub_dem))
    total_cells = int(np.sum(circle_mask))
    valid_count = int(np.sum(valid_cells))

    if total_cells == 0 or valid_count == 0:
        return {
            "valid_data_fraction": 0.0,
            "center_elevation_m": float(dem[row, col]) if not np.isnan(dem[row, col]) else None,
            "mean_elevation_m": None,
            "relief_m": None,
            "mean_slope_deg": None,
            "max_slope_deg": None,
            "roughness_m": None,
        }

    elevations = sub_dem[valid_cells]
    slope_sub, _ = compute_slope_aspect(sub_dem, pixel_m)
    slopes = slope_sub[valid_cells]
    rough_sub = compute_roughness(sub_dem, window_size=3)
    roughnesses = rough_sub[valid_cells]

    return {
        "valid_data_fraction": float(valid_count / total_cells),
        "center_elevation_m": float(dem[row, col]),
        "mean_elevation_m": float(np.mean(elevations)),
        "min_elevation_m": float(np.min(elevations)),
        "max_elevation_m": float(np.max(elevations)),
        "relief_m": float(np.max(elevations) - np.min(elevations)),
        "mean_slope_deg": float(np.mean(slopes)),
        "max_slope_deg": float(np.max(slopes)),
        "std_slope_deg": float(np.std(slopes)),
        "roughness_m": float(np.mean(roughnesses)),
        "footprint_radius_m": float(radius_m),
    }
