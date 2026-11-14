"""Gate 6 — End-to-end integration test.

Verifies that the full precompute pipeline produces deterministic, schema-valid output
for two sites over a 1-day interval, and that result_sha256 is reproducible.
"""

import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from precompute.generate_library import precompute_all_sites
from engine.runner import canonical_json_dumps


PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
SITES_PATH = Path(__file__).resolve().parent.parent / "data" / "sites.json"

# Short interval: 1 day, 10-minute steps
_SHORT_START = "2026-04-01T00:00:00"
_SHORT_END   = "2026-04-02T00:00:00"
_SHORT_STEP  = 600.0

_EXPECTED_SCHEMA_KEYS = {
    "run_id", "site", "interval", "time_series",
    "transitions", "metrics", "provenance", "status", "horizon",
}


@pytest.fixture(scope="module")
def short_library(tmp_path_factory):
    """Run precomputation for a 1-day window and return results for first 2 sites."""
    import shutil
    from engine.celestial import CelestialEngine
    from engine.runner import run_site

    with open(SITES_PATH, encoding="utf-8") as f:
        sites = json.load(f)

    celestial = CelestialEngine()
    celestial.load_kernels()

    results = {}
    for site in sites[:2]:
        result = run_site(
            site=site,
            interval_utc=(_SHORT_START, _SHORT_END),
            step_s=_SHORT_STEP,
            dem=None,
            pixel_m=20.0,
            row=None,
            col=None,
            observer_height_m=1.5,
            use_surface_observer=True,
            limb_convention="upper_limb",
            energy_config={
                "panel_area_m2": 2.5,
                "panel_efficiency": 0.28,
                "orientation_mode": "horizontal",
                "battery_capacity_wh": 1200.0,
                "initial_soc": 1.0,
                "p_load_w": 65.0,
                "eta_c": 0.92,
                "eta_d": 0.92,
                "soc_min": 0.20,
            },
            celestial_engine=celestial,
        )
        results[site["id"]] = result
    return results


class TestG6Schema:
    """Gate 6-A — Output matches Rulebook Section 7 schema."""

    def test_top_level_keys_present(self, short_library):
        for site_id, result in short_library.items():
            missing = _EXPECTED_SCHEMA_KEYS - set(result.keys())
            assert not missing, f"[{site_id}] Missing schema keys: {missing}"

    def test_status_ok(self, short_library):
        for site_id, result in short_library.items():
            assert result["status"] == "Processed", f"[{site_id}] status != Processed: {result.get('error')}"

    def test_metrics_subkeys(self, short_library):
        for site_id, result in short_library.items():
            m = result["metrics"]
            assert "sunlight" in m, f"[{site_id}] missing metrics.sunlight"
            assert "geometric_earth_visibility" in m, f"[{site_id}] missing metrics.geometric_earth_visibility"
            assert "energy" in m, f"[{site_id}] missing metrics.energy"

    def test_sunlight_fraction_range(self, short_library):
        for site_id, result in short_library.items():
            sf = result["metrics"]["sunlight"]["sunlight_fraction"]
            assert 0.0 <= sf <= 1.0, f"[{site_id}] sunlight_fraction out of range: {sf}"

    def test_provenance_sha256_present(self, short_library):
        for site_id, result in short_library.items():
            sha = result["provenance"].get("result_sha256", "")
            assert len(sha) == 64, f"[{site_id}] Invalid SHA-256: {sha!r}"

    def test_time_series_lengths_consistent(self, short_library):
        for site_id, result in short_library.items():
            ts = result["time_series"]
            n = len(ts["times_utc"])
            assert len(ts["sun_visible"]) == n, f"[{site_id}] sun_visible length mismatch"
            assert len(ts["earth_visible"]) == n, f"[{site_id}] earth_visible length mismatch"
            assert len(ts["sun_el_deg"]) == n, f"[{site_id}] sun_el_deg length mismatch"


class TestG6Reproducibility:
    """Gate 6-B — Identical inputs produce identical SHA-256."""

    def test_sha256_deterministic(self, short_library):
        """Re-hash each result independently and confirm SHA matches stored value."""
        for site_id, result in short_library.items():
            stored_sha = result["provenance"]["result_sha256"]
            # Re-derive payload (everything except the sha field itself, same as runner)
            payload = {k: v for k, v in result.items() if k != "provenance"}
            payload["provenance"] = {k: v for k, v in result["provenance"].items() if k != "result_sha256"}
            recomputed_sha = hashlib.sha256(canonical_json_dumps(payload).encode("utf-8")).hexdigest()
            assert recomputed_sha == stored_sha, (
                f"[{site_id}] SHA-256 mismatch: stored={stored_sha[:12]}... recomputed={recomputed_sha[:12]}..."
            )

    def test_run_twice_same_sha(self, short_library):
        """Run one site a second time and check the hash matches the first run's hash."""
        from engine.celestial import CelestialEngine
        from engine.runner import run_site
        import json as _json

        with open(SITES_PATH, encoding="utf-8") as f:
            sites = _json.load(f)
        site = sites[0]

        celestial = CelestialEngine()
        celestial.load_kernels()

        run2 = run_site(
            site=site,
            interval_utc=(_SHORT_START, _SHORT_END),
            step_s=_SHORT_STEP,
            dem=None,
            pixel_m=20.0,
            row=None,
            col=None,
            observer_height_m=1.5,
            use_surface_observer=True,
            limb_convention="upper_limb",
            energy_config={
                "panel_area_m2": 2.5,
                "panel_efficiency": 0.28,
                "orientation_mode": "horizontal",
                "battery_capacity_wh": 1200.0,
                "initial_soc": 1.0,
                "p_load_w": 65.0,
                "eta_c": 0.92,
                "eta_d": 0.92,
                "soc_min": 0.20,
            },
            celestial_engine=celestial,
        )

        sha1 = short_library[site["id"]]["provenance"]["result_sha256"]
        sha2 = run2["provenance"]["result_sha256"]
        assert sha1 == sha2, (
            f"Non-deterministic: run1={sha1[:12]}... run2={sha2[:12]}..."
        )
