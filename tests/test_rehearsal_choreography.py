"""Unit tests for rehearsal/choreography.py (Section 4 & Section 6)."""

import pytest
from rehearsal.choreography import generate_choreography, DISCLAIMER_TEXT


@pytest.fixture
def base_plan():
    return {
        "schema_version": 1,
        "centre": "ESOC",
        "mission": "CHOREO-TEST",
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


def test_choreography_generates_frames(base_plan):
    res = generate_choreography(base_plan)

    assert "frames" in res
    assert len(res["frames"]) > 50
    assert res["total_frames"] == len(res["frames"])
    assert res["schematic_disclaimer"] == DISCLAIMER_TEXT


def test_schematic_flag_strictness(base_plan):
    """All non-surface phases MUST be flagged schematic: True with disclaimer."""
    res = generate_choreography(base_plan)

    for f in res["frames"]:
        phase = f["phase"]
        if phase in {"PRELAUNCH_HOLD", "TRANSIT", "LUNAR_ORBIT", "DESCENT"}:
            assert f["schematic"] is True, f"Phase {phase} must be marked schematic: True"
            assert f["disclaimer"] == DISCLAIMER_TEXT
        elif phase == "SURFACE":
            assert f["schematic"] is False, "Surface phase must be marked schematic: False"


def test_monotonic_timestamps(base_plan):
    """Frame timestamps must be strictly non-decreasing."""
    res = generate_choreography(base_plan)
    times = [f["t_sec"] for f in res["frames"]]

    for i in range(1, len(times)):
        assert times[i] >= times[i - 1], f"Frame {i} timestamp decreased: {times[i]} < {times[i-1]}"


def test_key_events_present(base_plan):
    """Key mission milestones must be tagged on the trajectory."""
    res = generate_choreography(base_plan)
    events = {f["event"] for f in res["frames"] if f.get("event") is not None}

    expected_events = {"COUNTDOWN_START", "LIFTOFF", "TLI_BURN", "LOI_INSERTION", "PDI_BURN", "TOUCHDOWN", "SURFACE_OPS"}
    assert expected_events.issubset(events), f"Missing events: {expected_events - events}"


def test_no_banned_words_in_choreography(base_plan):
    """Ensure neutral language compliance."""
    res = generate_choreography(base_plan)
    banned = ["recommended", "best", "optimal", "predicted", "guaranteed"]

    text = str(res).lower()
    for word in banned:
        assert word not in text, f"Banned word '{word}' found in choreography output"
