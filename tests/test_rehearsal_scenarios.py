"""Unit tests for rehearsal/scenarios.py (Section 4)."""

import pytest
from rehearsal.scenarios import apply_scenario, apply_all_scenarios


@pytest.fixture
def base_plan():
    return {
        "centre": "ISRO",
        "mission": "SCENARIO-TEST",
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


def test_launch_slip_shifts_launch_utc(base_plan):
    scenario = {"type": "launch_slip", "days": 3.0}
    modified, sentence = apply_scenario(base_plan, scenario)

    assert modified["launch_utc"] == "2026-04-04T00:00:00Z"
    assert "3.0 day" in sentence
    # Original plan unchanged
    assert base_plan["launch_utc"] == "2026-04-01T00:00:00Z"


def test_transit_extension_adds_days(base_plan):
    scenario = {"type": "transit_extension", "days": 2.0}
    modified, sentence = apply_scenario(base_plan, scenario)

    assert modified["transit_days"] == 6.0
    assert "Transit extended" in sentence


def test_orbit_hold_extension_adds_days(base_plan):
    scenario = {"type": "orbit_hold_extension", "days": 1.5}
    modified, sentence = apply_scenario(base_plan, scenario)

    assert modified["orbit_hold_days"] == 2.5
    assert "Orbit hold" in sentence


def test_reduced_power_scales_efficiency(base_plan):
    scenario = {"type": "reduced_power", "power_factor": 0.5}
    modified, sentence = apply_scenario(base_plan, scenario)

    assert modified["hardware"]["panel_efficiency"] == pytest.approx(0.14, abs=0.001)
    assert "50%" in sentence


def test_comms_outage_adds_metadata(base_plan):
    scenario = {
        "type": "comms_outage",
        "outage_start_utc": "2026-04-10T06:00:00Z",
        "outage_hours": 8.0,
    }
    modified, sentence = apply_scenario(base_plan, scenario)

    assert "scenario_metadata" in modified
    assert modified["scenario_metadata"]["comms_outage"]["outage_hours"] == 8.0
    assert "8.0h" in sentence


def test_apply_all_scenarios_includes_baseline(base_plan):
    scenarios = [
        {"type": "launch_slip", "days": 2.0},
        {"type": "transit_extension", "days": 1.0},
    ]
    results = apply_all_scenarios(base_plan, scenarios)

    assert len(results) == 3  # baseline + 2 scenarios
    assert results[0]["label"] == "Baseline (nominal)"
    assert results[0]["scenario"] is None
    assert "Scenario 1" in results[1]["label"]
    assert "Scenario 2" in results[2]["label"]


def test_apply_all_no_scenarios_returns_baseline_only(base_plan):
    results = apply_all_scenarios(base_plan, [])
    assert len(results) == 1
    assert results[0]["label"] == "Baseline (nominal)"


def test_no_banned_words_in_sentences(base_plan):
    """Ensure change sentences never use banned language."""
    banned = ["recommended", "best", "optimal", "predicted", "guaranteed"]
    scenarios = [
        {"type": "launch_slip", "days": 1.0},
        {"type": "transit_extension", "days": 2.0},
        {"type": "orbit_hold_extension", "days": 0.5},
        {"type": "reduced_power", "power_factor": 0.7},
        {"type": "comms_outage", "outage_hours": 4.0, "outage_start_utc": "2026-04-10T00:00:00Z"},
    ]
    for sc in scenarios:
        _, sentence = apply_scenario(base_plan, sc)
        lower = sentence.lower()
        for word in banned:
            assert word not in lower, f"Banned word '{word}' found in: {sentence}"
