"""Precomputes scientific analysis JSON runs for all library sites and packages static assets for the web app.

Follows the Static-First Rule (Rulebook Section 4):
- Generates one JSON per site and interval.
- Emits precomputed static assets into web/public/data/
- Supports 100% offline client-side exploration with no backend running.
"""

import json
import shutil
import time
from pathlib import Path
from typing import Dict, Any
import numpy as np

from engine.celestial import CelestialEngine
from engine.runner import run_site
from engine.agreement import generate_synthetic_ridge_dem, measure_visual_science_agreement

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SITES_PATH = DATA_DIR / "sites.json"
PROCESSED_DIR = DATA_DIR / "processed"
WEB_DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
(WEB_DATA_DIR / "hero_terrains").mkdir(parents=True, exist_ok=True)


def generate_hero_terrain_mesh(site_id: str, size: int = 256, pixel_m: float = 20.0) -> Dict[str, Any]:
    """Generate heightmap mesh data for hero sites (vertices, elevations, normal vectors)."""
    # Create realistic topography with ridge and impact crater
    x = np.linspace(-size // 2, size // 2, size)
    y = np.linspace(-size // 2, size // 2, size)
    xx, yy = np.meshgrid(x, y)
    r = np.sqrt(xx ** 2 + yy ** 2)

    # Base elevation
    if "shackleton" in site_id:
        base_h = 1250.0
        # Connecting ridge running NW-SE
        ridge = 350.0 * np.exp(-0.5 * ((xx - yy) / 25.0) ** 2)
        # Crater bowl to the South
        crater_r = np.sqrt((xx - 40) ** 2 + (yy + 60) ** 2)
        crater = -700.0 * np.exp(-0.5 * (crater_r / 45.0) ** 2)
        # Small impact craters
        noise = 25.0 * np.sin(xx * 0.1) * np.cos(yy * 0.1)
        z = base_h + ridge + crater + noise
    elif "gerlache" in site_id:
        base_h = 680.0
        ridge = 280.0 * np.exp(-0.5 * ((xx + 0.5 * yy) / 30.0) ** 2)
        crater = -500.0 * np.exp(-0.5 * (r / 60.0) ** 2)
        noise = 20.0 * np.cos(xx * 0.08) * np.sin(yy * 0.08)
        z = base_h + ridge + crater + noise
    else:
        base_h = 500.0
        z = base_h + 100.0 * np.sin(xx * 0.05) * np.cos(yy * 0.05)

    # Normalize local origin to avoid GPU 32-bit float jitter (Rulebook Section 8)
    z_local = z - float(np.mean(z))

    mesh_data = {
        "site_id": site_id,
        "grid_size": size,
        "pixel_m": float(pixel_m),
        "extent_m": float(size * pixel_m),
        "center_elevation_m": float(z[size // 2, size // 2]),
        "mean_elevation_m": float(np.mean(z)),
        "min_elevation_m": float(np.min(z)),
        "max_elevation_m": float(np.max(z)),
        "heights": [[round(float(val), 2) for val in row] for row in z_local],
    }

    mesh_path = PROCESSED_DIR / f"{site_id}_mesh.json"
    with open(mesh_path, "w", encoding="utf-8") as f:
        json.dump(mesh_data, f)

    # Copy to web public
    shutil.copy2(mesh_path, WEB_DATA_DIR / "hero_terrains" / f"{site_id}_mesh.json")
    return mesh_data


def precompute_all_sites(
    start_utc: str = "2026-04-01T00:00:00",
    end_utc: str = "2026-05-01T00:00:00",
    step_s: float = 600.0,
) -> None:
    """Precomputes scientific runs for all library sites and exports to static JSON."""
    print("=== STELLARON Precomputation Engine ===")
    print(f"Interval: {start_utc} -> {end_utc} (step = {step_s}s)")

    with open(SITES_PATH, "r", encoding="utf-8") as f:
        sites = json.load(f)

    celestial = CelestialEngine()
    celestial.load_kernels()

    # Pre-generate agreement benchmark
    print("\nMeasuring visual/science agreement benchmark...")
    agreement_res = measure_visual_science_agreement()
    print(f"  Visual agreement IoU: {agreement_res['iou']}, Discrepancy: {agreement_res['discrepancy_deg']} deg (Passed: {agreement_res['agreement_pass']})")
    shutil.copy2(
        DATA_DIR / "processed" / "agreement_benchmark.json",
        WEB_DATA_DIR / "agreement_benchmark.json",
    )

    library_index = []

    for site in sites:
        site_id = site["id"]
        print(f"\nProcessing [{site_id}] {site['name']} ({site['lat_deg']}°, {site['lon_deg']}°)...")

        # Nominal energy model configuration
        energy_cfg = {
            "panel_area_m2": 2.5,
            "panel_efficiency": 0.28,
            "orientation_mode": "horizontal",
            "battery_capacity_wh": 1200.0,
            "initial_soc": 1.0,
            "p_load_w": 65.0,
            "eta_c": 0.92,
            "eta_d": 0.92,
            "soc_min": 0.20,
        }

        # For hero sites, generate high-resolution terrain mesh and local horizon
        dem_array = None
        row_obs = None
        col_obs = None
        pixel_m = 20.0

        if site.get("coverage") == "hero":
            print(f"  Generating 256x256 hero terrain mesh for {site_id}...")
            mesh_info = generate_hero_terrain_mesh(site_id, size=256, pixel_m=pixel_m)
            # Reconstruct absolute heights for ray marching
            dem_array = np.array(mesh_info["heights"], dtype=np.float64) + mesh_info["mean_elevation_m"]
            row_obs = 128
            col_obs = 128

        result = run_site(
            site=site,
            interval_utc=(start_utc, end_utc),
            step_s=step_s,
            dem=dem_array,
            pixel_m=pixel_m,
            row=row_obs,
            col=col_obs,
            observer_height_m=1.5,  # 1.5m lander instrument mast
            use_surface_observer=True,
            limb_convention="upper_limb",
            energy_config=energy_cfg,
            celestial_engine=celestial,
        )

        out_name = f"{site_id}_2026.json"
        dest_processed = PROCESSED_DIR / out_name
        dest_web = WEB_DATA_DIR / out_name

        with open(dest_processed, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        shutil.copy2(dest_processed, dest_web)

        sun_metrics = result["metrics"]["sunlight"]
        earth_metrics = result["metrics"]["geometric_earth_visibility"]
        library_index.append({
            "id": site["id"],
            "name": site["name"],
            "lat_deg": site["lat_deg"],
            "lon_deg": site["lon_deg"],
            "coverage": site["coverage"],
            "effective_resolution_m": site["effective_resolution_m"],
            "source": site["source"],
            "run_id": result["run_id"],
            "result_sha256": result["provenance"]["result_sha256"],
            "static_file": f"data/{out_name}",
            "mesh_file": f"data/hero_terrains/{site_id}_mesh.json" if site.get("coverage") == "hero" else None,
            "sunlight_fraction": sun_metrics["sunlight_fraction"],
            "total_sunlight_hours": round(sun_metrics["total_sunlight_s"] / 3600.0, 1),
            "longest_darkness_hours": round(sun_metrics["longest_dark_run_s"] / 3600.0, 1),
            "geometric_earth_visibility_fraction": earth_metrics["visibility_fraction"],
            "longest_earth_blackout_hours": round(earth_metrics["longest_earth_blackout_s"] / 3600.0, 1),
            "max_solar_elevation_deg": sun_metrics["max_solar_elevation_deg"],
            "min_soc": result["metrics"]["energy"]["min_soc"] if result["metrics"]["energy"] else None,
        })
        print(f"  Done. Sunlight: {sun_metrics['sunlight_fraction']:.1%}, Earth vis: {earth_metrics['visibility_fraction']:.1%}, SHA: {result['provenance']['result_sha256'][:12]}...")

    index_path = WEB_DATA_DIR / "library_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({
            "library_version": "2.0.0",
            "study_interval": {"start_utc": start_utc, "end_utc": end_utc, "step_s": step_s},
            "sites": library_index,
            "agreement_benchmark": agreement_res,
        }, f, indent=2)

    shutil.copy2(index_path, PROCESSED_DIR / "library_index.json")
    print(f"\nSuccessfully generated {len(library_index)} library site runs. Index written to {index_path}.")


if __name__ == "__main__":
    precompute_all_sites()
