"""Unit and integration tests for rehearsal/slip.py (Section 4)."""

from datetime import datetime, timezone
import pytest

from rehearsal.slip import compute_slip_calendar
from rehearsal.surface import parse_utc_dt, format_utc_iso


class PatternEngineStub:
    """Deterministic engine stub returning verdict based on landing offset days."""

    def __init__(self, fail_offsets=None, marginal_offsets=None):
        self.fail_offsets = set(fail_offsets or [])
        self.marginal_offsets = set(marginal_offsets or [])
        self.call_count = 0

    def evaluate(
        self,
        site_id: str,
        landing_t,
        surface_days: float,
        hardware,
        constraints,
        soc_margin: float = 0.10,
        blackout_margin_fraction: float = 0.10,
        sunlit_margin: float = 0.05,
    ):
        self.call_count += 1
        landing_dt = parse_utc_dt(landing_t)
        # Determine offset relative to baseline 2026-04-06
        baseline_dt = datetime(2026, 4, 6, 0, 0, tzinfo=timezone.utc)
        offset = int(round((landing_dt - baseline_dt).total_seconds() / 86400.0))

        if offset in self.fail_offsets:
            verdict = "fails"
            min_soc = 0.10
            limiting_factor = "battery_reserve"
        elif offset in self.marginal_offsets:
            verdict = "marginal"
            min_soc = 0.25
            limiting_factor = "battery_reserve"
        else:
            verdict = "survives"
            min_soc = 0.70
            limiting_factor = "none"

        return {
            "verdict": verdict,
            "limiting_factor": limiting_factor,
            "verdict_details": {},
            "metrics": {
                "sunlit_hours": 100.0,
                "sunlit_fraction": 0.85,
                "earth_visible_hours": 80.0,
                "earth_visibility_fraction": 0.75,
                "longest_dark_run_h": 12.0,
                "longest_earth_blackout_h": 6.0,
                "minimum_soc": min_soc,
                "time_below_reserve_h": 0.0 if verdict != "fails" else 10.0,
                "first_deficit_utc": None,
            },
            "censored": {},
            "time_series": {
                "times_utc": [format_utc_iso(landing_dt)],
                "sun_elevation_deg": [2.0],
                "earth_elevation_deg": [6.0],
                "sun_visible": [True],
                "earth_visible": [True],
                "soc": [min_soc],
            },
            "provenance": {"site_id": site_id},
        }


@pytest.fixture
def base_plan():
    return {
        "centre": "ESOC",
        "mission": "LUNAR-SWEEP",
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


def test_slip_calendar_cell_count_and_offsets(base_plan):
    stub = PatternEngineStub()
    res = compute_slip_calendar(
        plan=base_plan,
        back_days=3,
        forward_days=5,
        step_days=1,
        engine_stub=stub,
    )

    # Offsets should be -3, -2, -1, 0, 1, 2, 3, 4, 5 (9 cells total)
    assert len(res["cells"]) == 9
    assert res["cells"][0]["offset_days"] == -3
    assert res["cells"][-1]["offset_days"] == 5
    assert stub.call_count == 9


def test_tolerance_days_forward_calculation(base_plan):
    # Days 0..3 survive, day 4 fails
    stub = PatternEngineStub(fail_offsets=[4])
    res = compute_slip_calendar(
        plan=base_plan,
        back_days=2,
        forward_days=10,
        engine_stub=stub,
    )

    # If day 4 fails, consecutive non-failing forward days are 0, 1, 2, 3 -> tolerance = 3 days
    assert res["tolerance_days_forward"] == 3
    assert res["first_failing_offset_days"] == 4
    assert res["first_failing_landing_utc"] is not None


def test_tolerance_zero_when_baseline_fails(base_plan):
    # Day 0 fails immediately
    stub = PatternEngineStub(fail_offsets=[0])
    res = compute_slip_calendar(
        plan=base_plan,
        back_days=1,
        forward_days=5,
        engine_stub=stub,
    )

    assert res["tolerance_days_forward"] == 0
    assert res["first_failing_offset_days"] == 0


def test_next_pass_window_recovery(base_plan):
    # Days 0..2 pass, days 3 and 4 fail, day 5 recovers to survives
    stub = PatternEngineStub(fail_offsets=[3, 4])
    res = compute_slip_calendar(
        plan=base_plan,
        back_days=0,
        forward_days=10,
        engine_stub=stub,
    )

    assert res["tolerance_days_forward"] == 2
    assert res["first_failing_offset_days"] == 3
    assert res["next_pass_window_offset_days"] == 5
    assert res["next_pass_window_utc"] is not None


def test_real_spice_slip_calendar_sweep(base_plan):
    """Integration test running real SPICE on a short sweep (-1..+2 days)."""
    res = compute_slip_calendar(
        plan=base_plan,
        back_days=1,
        forward_days=2,
        step_days=1,
        step_s=3600.0,  # 1-hour step for rapid sweep
    )

    assert len(res["cells"]) == 4
    assert res["sweep_range_days"] == [-1, 2]
    assert all("verdict" in c for c in res["cells"])
    assert all(c["verdict"] in {"survives", "marginal", "fails"} for c in res["cells"])
