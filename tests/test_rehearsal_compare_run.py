"""Unit and integration tests for rehearsal/compare.py and rehearsal/run.py (Section 4)."""

import pytest
from datetime import datetime, timezone

from rehearsal.compare import compare_scenarios, compare_dates
from rehearsal.scenarios import apply_all_scenarios
from rehearsal.run import run_rehearsal, _compute_sha256
from rehearsal.surface import format_utc_iso


# ──── Stub for fast compare testing ──────────────────────────────────────────

class CompareEngineStub:
    """Deterministic stub returning different verdicts based on panel_efficiency."""

    def evaluate(
        self, site_id, landing_t, surface_days, hardware, constraints,
        soc_margin=0.10, blackout_margin_fraction=0.10, sunlit_margin=0.05,
    ):
        eff = float(hardware.get("panel_efficiency", 0.28))
        if eff < 0.15:
            verdict, lf, soc = "fails", "battery_reserve", 0.10
        elif eff < 0.22:
            verdict, lf, soc = "marginal", "battery_reserve", 0.25
        else:
            verdict, lf, soc = "survives", "none", 0.70

        return {
            "verdict": verdict,
            "limiting_factor": lf,
            "verdict_details": {},
            "metrics": {
                "sunlit_hours": 100.0,
                "sunlit_fraction": 0.85,
                "earth_visible_hours": 80.0,
                "earth_visibility_fraction": 0.75,
                "longest_dark_run_h": 12.0,
                "longest_earth_blackout_h": 6.0,
                "minimum_soc": soc,
                "time_below_reserve_h": 0.0,
                "first_deficit_utc": None,
            },
            "censored": {},
            "time_series": {
                "times_utc": ["2026-04-06T00:00:00Z"],
                "sun_elevation_deg": [2.0],
                "earth_elevation_deg": [6.0],
                "sun_visible": [True],
                "earth_visible": [True],
                "soc": [soc],
            },
            "provenance": {"site_id": site_id},
        }


@pytest.fixture
def base_plan():
    return {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "COMPARE-TEST",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 7.0,
        "hardware": {
            "panel_m2": 2.5,
            "panel_efficiency": 0.28,
            "battery_wh": 1200.0,
            "base_load_w": 65.0,
            "min_soc_fraction": 0.20,
        },
    }


# ──── Compare scenarios tests ───────────────────────────────────────────────

def test_compare_scenarios_baseline_and_reduced_power(base_plan):
    scenarios = [{"type": "reduced_power", "power_factor": 0.5}]
    scenario_results = apply_all_scenarios(base_plan, scenarios)

    stub = CompareEngineStub()
    result = compare_scenarios(
        plan=base_plan,
        scenario_results=scenario_results,
        engine_stub=stub,
    )

    assert result["compared_count"] == 2
    assert len(result["summary_table"]) == 2
    # Baseline survives, reduced power fails
    verdicts = {s["label"]: s["verdict"] for s in result["summary_table"]}
    assert verdicts["Baseline (nominal)"] == "survives"


def test_compare_max_three_entries(base_plan):
    scenarios = [
        {"type": "launch_slip", "days": 1.0},
        {"type": "transit_extension", "days": 2.0},
        {"type": "orbit_hold_extension", "days": 3.0},
        {"type": "reduced_power", "power_factor": 0.8},
    ]
    scenario_results = apply_all_scenarios(base_plan, scenarios)
    assert len(scenario_results) == 5  # baseline + 4

    stub = CompareEngineStub()
    result = compare_scenarios(
        plan=base_plan,
        scenario_results=scenario_results,
        engine_stub=stub,
    )

    # Capped at 3
    assert result["compared_count"] == 3


def test_compare_results_sorted_by_date(base_plan):
    scenarios = [{"type": "launch_slip", "days": -1.0}]  # negative slip (earlier)
    scenario_results = apply_all_scenarios(base_plan, scenarios)
    stub = CompareEngineStub()

    result = compare_scenarios(
        plan=base_plan,
        scenario_results=scenario_results,
        engine_stub=stub,
    )

    dates = [c["landing_utc"] for c in result["comparisons"]]
    assert dates == sorted(dates)


# ──── Run pipeline tests ────────────────────────────────────────────────────

def test_run_rehearsal_validation_error():
    bad_plan = {"centre": "X"}  # missing required fields
    result = run_rehearsal(bad_plan)

    assert result["status"] == "validation_error"
    assert len(result["errors"]) > 0


def test_run_rehearsal_full_pipeline(base_plan):
    stub = CompareEngineStub()
    result = run_rehearsal(
        plan_input=base_plan,
        back_days=2,
        forward_days=3,
        engine_stub=stub,
    )

    assert result["status"] == "complete"
    assert result["verdict"] in {"survives", "marginal", "fails"}
    assert "result_sha256" in result
    assert len(result["result_sha256"]) == 64
    assert "run_id" in result
    assert "provenance" in result
    assert result["provenance"]["ephemeris_kernel"] == "de421.bsp"
    assert "Illustrative path" in result["provenance"]["model_note"]


def test_run_rehearsal_with_scenarios(base_plan):
    base_plan["delay_scenarios"] = [
        {"type": "launch_slip", "days": 2.0, "probability": 0.3},
        {"type": "reduced_power", "power_factor": 0.6, "probability": 0.1},
    ]

    stub = CompareEngineStub()
    result = run_rehearsal(
        plan_input=base_plan,
        back_days=1,
        forward_days=2,
        engine_stub=stub,
    )

    assert result["status"] == "complete"
    assert result["comparison"] is not None
    assert result["probability_view"] is not None
    assert result["probability_view"]["total_specified"] == pytest.approx(0.4)
    assert result["probability_view"]["unspecified_remainder"] == pytest.approx(0.6)
    assert "conditional on your inputs" in result["probability_view"]["note"]


def test_sha256_deterministic():
    data = {"a": 1, "b": [2, 3]}
    h1 = _compute_sha256(data)
    h2 = _compute_sha256(data)
    assert h1 == h2
    assert len(h1) == 64
