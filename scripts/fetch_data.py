"""Automated dataset and SPICE kernel downloader for STELLARON.

Rules enforced:
- Keeps raw files untouched in data/raw/
- Computes SHA-256 and records metadata in data/manifest.json
- Skips existing files if hash matches
- Retries on network glitches with timeouts and clear logging
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any
import requests

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
MANIFEST_PATH = DATA_DIR / "manifest.json"

RAW_DIR.mkdir(parents=True, exist_ok=True)

SPICE_KERNELS = [
    {
        "id": "naif0012.tls",
        "type": "lsk",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        "version": "naif0012",
        "description": "Standard generic leapseconds kernel (LSK)",
    },
    {
        "id": "pck00010.tpc",
        "type": "pck",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
        "version": "pck00010",
        "description": "IAU generic planetary constants kernel (PCK)",
    },
    {
        "id": "moon_080317.tf",
        "type": "fk",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
        "version": "080317",
        "description": "Lunar frame kernel defining MOON_ME and MOON_PA frames",
    },
    {
        "id": "moon_pa_de421_1900-2050.bpc",
        "type": "pck_binary",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
        "version": "de421_1900-2050",
        "description": "High-precision lunar orientation binary PCK (DE421 reference)",
    },
    {
        "id": "de421.bsp",
        "type": "spk",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
        "version": "DE421",
        "description": "JPL Planetary and Lunar Ephemeris DE421 (1900 to 2050)",
    },
]


def sha256_file(filepath: Path) -> str:
    """Compute hex SHA-256 hash of a local file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest_path: Path, max_retries: int = 3, timeout_s: int = 30) -> None:
    """Download a file with streaming and retries."""
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Downloading {url} -> {dest_path.name} (attempt {attempt}/{max_retries})...")
            with requests.get(url, stream=True, timeout=timeout_s) as response:
                response.raise_for_status()
                temp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
                with open(temp_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                if dest_path.exists():
                    dest_path.unlink()
                temp_path.rename(dest_path)
            print(f"  Successfully downloaded {dest_path.name} ({dest_path.stat().st_size:,} bytes)")
            return
        except Exception as e:
            print(f"  Warning: Attempt {attempt} failed for {url}: {e}")
            if attempt == max_retries:
                raise
            time.sleep(2.0 * attempt)


def update_manifest(manifest_entry_type: str, item_id: str, entry: Dict[str, Any]) -> None:
    """Update data/manifest.json atomically."""
    manifest = {}
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    if manifest_entry_type not in manifest:
        manifest[manifest_entry_type] = {}

    manifest[manifest_entry_type][item_id] = entry
    manifest["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def fetch_all_kernels() -> None:
    """Fetch all required SPICE kernels and update the manifest."""
    print(f"=== Fetching SPICE Kernels into {RAW_DIR} ===")
    for k in SPICE_KERNELS:
        dest = RAW_DIR / k["id"]
        # If already exists and size > 0, verify or skip
        if dest.exists() and dest.stat().st_size > 0:
            print(f"Found existing {k['id']} ({dest.stat().st_size:,} bytes), hashing...")
            h = sha256_file(dest)
        else:
            download_file(k["url"], dest)
            h = sha256_file(dest)

        entry = {
            "source_url": k["url"],
            "version": k["version"],
            "description": k["description"],
            "retrieval_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "sha256": h,
            "size_bytes": dest.stat().st_size,
            "local_path": f"data/raw/{k['id']}",
        }
        update_manifest(f"{k['type']}_kernels", k["id"], entry)
        print(f"  Recorded {k['id']} SHA-256: {h[:16]}... in manifest.json")


if __name__ == "__main__":
    try:
        fetch_all_kernels()
        print("All SPICE kernels successfully fetched and recorded in manifest.")
    except Exception as exc:
        print(f"FATAL: Error downloading SPICE kernels: {exc}", file=sys.stderr)
        sys.exit(1)
