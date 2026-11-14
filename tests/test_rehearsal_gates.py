"""Unit tests for rehearsal/gates.py (Section 4)."""

import pytest

from rehearsal.gates import evaluate_decision_gates


@pytest.fixture
def base_plan():
    return {
        "centre": "DLR",
        "mission": "GATES-REHEARSAL",
        "launch_utc": "2026-04-01T12:00:00Z",
        "transit_days": 4.5,
        "orbit_hold_days": 1.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 5.0,
        "hardware": {
            "panel_m2": 2.5,
            "panel_efficiency": 0.28,
            "battery_wh": 1200.0,
            "base_load_w": 65.0,
            "min_soc_fraction": 0.20,
        },
    }


@pytest.fixture
def mock_slip_calendar():
    # Calendar where offsets 0..5 pass and offset 6 fails
    cells = []
    for off in range(-2, 15):
        verdict = "fails" if off == 6 else "survives"
        cells.append({
            "offset_days": off,
            "date_utc": f"2026-04-{off+7:02d}T00:00:00Z",
            "verdict": verdict,
            "min_soc": 0.15 if verdict == "fails" else 0.70,
            "sunlit_hours": 80.0,
            "blackout_hours": 10.0,
            "limiting_factor": "battery_reserve" if verdict == "fails" else "none",
        })

    return {
        "baseline_landing_utc": "2026-04-07T00:00:00Z",
        "cells": cells,
    }


def test_gates_baseline_nominal(base_plan, mock_slip_calendar):
    gates = evaluate_decision_gates(
        plan=base_plan,
        slip_calendar=mock_slip_calendar,
    )

    assert len(gates) == 4
    gate_names = [g["gate"] for g in gates]
    assert gate_names == ["PRE_LAUNCH", "POST_LAUNCH", "LUNAR_ORBIT_ARRIVAL", "PRE_DESCENT"]

    # In baseline, slip_so_far_days is 0 across all gates
    for g in gates:
        assert g["slip_so_far_days"] == 0.0
        # Offset 0 to failure at offset 6: can absorb 5 days of further slip (offsets 1..5)
        assert g["remaining_tolerance_days"] == 5
        assert g["first_failing_landing_utc"] == "2026-04-13T00:00:00Z"


def test_gates_with_transit_extension(base_plan, mock_slip_calendar):
    # 2 days delay in transit
    scenario = {
        "type": "transit_extension",
        "days": 2.0,
    }

    gates = evaluate_decision_gates(
        plan=base_plan,
        slip_calendar=mock_slip_calendar,
        scenario=scenario,
    )

    gate_map = {g["gate"]: g for g in gates}

    # At PRE_LAUNCH, transit extension hasn't happened yet
    assert gate_map["PRE_LAUNCH"]["slip_so_far_days"] == 0.0
    assert gate_map["PRE_LAUNCH"]["remaining_tolerance_days"] == 5

    # At POST_LAUNCH, 2 days of transit slip have occurred
    assert gate_map["POST_LAUNCH"]["slip_so_far_days"] == 2.0
    # From offset 2 to failure at offset 6: remaining tolerance = 6 - 2 - 1 = 3 days
    assert gate_map["POST_LAUNCH"]["remaining_tolerance_days"] == 3

    # At LUNAR_ORBIT_ARRIVAL and PRE_DESCENT, still 2 days slip
    assert gate_map["LUNAR_ORBIT_ARRIVAL"]["slip_so_far_days"] == 2.0
    assert gate_map["LUNAR_ORBIT_ARRIVAL"]["remaining_tolerance_days"] == 3

    assert gate_map["PRE_DESCENT"]["slip_so_far_days"] == 2.0
    assert gate_map["PRE_DESCENT"]["remaining_tolerance_days"] == 3


def test_gates_with_orbit_hold_extension(base_plan, mock_slip_calendar):
    # 3 days delay in orbit hold
    scenario = {
        "type": "orbit_hold_extension",
        "days": 3.0,
    }

    gates = evaluate_decision_gates(
        plan=base_plan,
        slip_calendar=mock_slip_calendar,
        scenario=scenario,
    )

    gate_map = {g["gate"]: g for g in gates}

    # Delay only occurs during orbit hold, so PRE_LAUNCH and POST_LAUNCH and LUNAR_ORBIT_ARRIVAL have 0 slip
    assert gate_map["PRE_LAUNCH"]["slip_so_far_days"] == 0.0
    assert gate_map["POST_LAUNCH"]["slip_so_far_days"] == 0.0
    assert gate_map["LUNAR_ORBIT_ARRIVAL"]["slip_so_far_days"] == 0.0

    # At PRE_DESCENT, orbit hold slip has accumulated
    assert gate_map["PRE_DESCENT"]["slip_so_far_days"] == 3.0
    # From offset 3 to failure at offset 6: remaining tolerance = 6 - 3 - 1 = 2 days
    assert gate_map["PRE_DESCENT"]["remaining_tolerance_days"] == 2
