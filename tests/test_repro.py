"""Gate 5: Reproducibility, provenance integrity, and visual/science agreement tests."""

import json
from pathlib import Path
import pytest

from engine.runner import run_site
from engine.agreement import measure_visual_science_agreement


@pytest.fixture(scope="module")
def sample_site():
    return {
        "id": "shackleton_connecting_ridge",
        "name": "Shackleton Connecting Ridge",
        "lat_deg": -89.54,
        "lon_deg": 116.7,
        "elevation_m": 1250.0,
        "coverage": "hero",
        "source": "NASA Artemis III Candidate Landing Regions (2022)",
    }


def test_reproducibility_identical_inputs_identical_sha256(sample_site):
    """Running identical inputs produces identical result dictionaries and identical SHA-256 hashes."""
    interval = ("2026-01-01T00:00:00", "2026-01-02T00:00:00")

    run_1 = run_site(sample_site, interval_utc=interval, step_s=1800.0)
    run_2 = run_site(sample_site, interval_utc=interval, step_s=1800.0)

    assert run_1["status"] == "Processed"
    assert run_2["status"] == "Processed"
    assert run_1["run_id"] == run_2["run_id"]

    sha_1 = run_1["provenance"]["result_sha256"]
    sha_2 = run_2["provenance"]["result_sha256"]

    assert sha_1 == sha_2, f"SHA-256 mismatch across identical runs: {sha_1} vs {sha_2}"


def test_run_id_and_sha_differ_on_parameter_change(sample_site):
    """A changed parameter must produce a distinct run_id and a distinct SHA-256."""
    interval_1 = ("2026-01-01T00:00:00", "2026-01-02T00:00:00")
    interval_2 = ("2026-01-02T00:00:00", "2026-01-03T00:00:00")

    run_1 = run_site(sample_site, interval_utc=interval_1, step_s=1800.0)
    run_2 = run_site(sample_site, interval_utc=interval_2, step_s=1800.0)

    assert run_1["run_id"] != run_2["run_id"]
    assert run_1["provenance"]["result_sha256"] != run_2["provenance"]["result_sha256"]


def test_provenance_schema_and_completeness(sample_site):
    """Result must contain complete provenance records without placeholder or missing fields."""
    interval = ("2026-01-01T00:00:00", "2026-01-01T12:00:00")
    result = run_site(sample_site, interval_utc=interval, step_s=1800.0)

    prov = result["provenance"]
    assert len(prov["kernel_versions"]) >= 5
    assert prov["model_version"] == "STELLARON_v2.0"
    assert prov["limb_convention"] in ["upper_limb", "disc_centre"]
    assert prov["observer_model"] in ["moon_centre", "surface_site topocentric"]
    assert isinstance(prov["assumptions"], list)
    assert len(prov["assumptions"]) > 0
    assert isinstance(prov["limitations"], list)
    assert len(prov["result_sha256"]) == 64  # valid hex SHA-256


def test_visual_science_agreement():
    """Verify synthetic ridge visual/science agreement achieves IoU >= 0.95 and discrepancy <= 0.10 deg."""
    agreement = measure_visual_science_agreement()

    assert agreement["status"] == "Validated"
    assert agreement["agreement_pass"] is True
    # Verify measured values meet documented tolerance
    assert agreement["iou"] >= 0.95, f"Measured IoU {agreement['iou']} below threshold 0.95"
    assert agreement["discrepancy_deg"] <= 0.10, f"Discrepancy {agreement['discrepancy_deg']} deg exceeds 0.10 deg"

    # Confirm benchmark file was persisted
    bench_file = Path(__file__).resolve().parent.parent / "data" / "processed" / "agreement_benchmark.json"
    assert bench_file.exists()
