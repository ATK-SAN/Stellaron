"""Unit and integration tests for rehearsal/surface.py (Section 3.3 and Section 5)."""

from datetime import datetime, timezone
import pytest

from rehearsal.surface import evaluate_verdict, evaluate_surface


class DeterministicEngineStub:
    """Deterministic stub for fast testing of pass/fail/marginal verdict patterns without SPICE."""

    def __init__(
        self,
        min_soc: float = 0.50,
        longest_blackout_h: float = 12.0,
        sunlit_fraction: float = 0.80,
        sunlit_hours: float = 100.0,
        earth_visible_hours: float = 80.0,
        longest_dark_run_h: float = 10.0,
        time_below_reserve_h: float = 0.0,
        first_deficit_utc=None,
        censored=None,
    ):
        self.min_soc = min_soc
        self.longest_blackout_h = longest_blackout_h
        self.sunlit_fraction = sunlit_fraction
        self.sunlit_hours = sunlit_hours
        self.earth_visible_hours = earth_visible_hours
        self.longest_dark_run_h = longest_dark_run_h
        self.time_below_reserve_h = time_below_reserve_h
        self.first_deficit_utc = first_deficit_utc
        self.censored = censored or {
            "darkness_touches_boundary": False,
            "blackout_touches_boundary": False,
            "battery_deficit_touches_boundary": False,
        }

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
        min_soc_fraction = hardware.get("min_soc_fraction", 0.20)
        max_blackout_c = constraints.get("max_earth_blackout_h")
        min_sunlit_c = constraints.get("min_sunlit_fraction")

        verdict, limiting_factor, details = evaluate_verdict(
            min_soc=self.min_soc,
            min_soc_fraction=min_soc_fraction,
            longest_blackout_h=self.longest_blackout_h,
            max_blackout_constraint_h=float(max_blackout_c) if max_blackout_c is not None else None,
            sunlit_fraction=self.sunlit_fraction,
            min_sunlit_constraint=float(min_sunlit_c) if min_sunlit_c is not None else None,
            soc_margin=soc_margin,
            blackout_margin_fraction=blackout_margin_fraction,
            sunlit_margin=sunlit_margin,
        )

        return {
            "verdict": verdict,
            "limiting_factor": limiting_factor,
            "verdict_details": details,
            "metrics": {
                "sunlit_hours": self.sunlit_hours,
                "sunlit_fraction": self.sunlit_fraction,
                "earth_visible_hours": self.earth_visible_hours,
                "earth_visibility_fraction": 0.85,
                "longest_dark_run_h": self.longest_dark_run_h,
                "longest_earth_blackout_h": self.longest_blackout_h,
                "minimum_soc": self.min_soc,
                "time_below_reserve_h": self.time_below_reserve_h,
                "first_deficit_utc": self.first_deficit_utc,
            },
            "censored": self.censored,
            "time_series": {
                "times_utc": ["2026-04-01T00:00:00Z", "2026-04-01T01:00:00Z"],
                "sun_elevation_deg": [1.5, 1.2],
                "earth_elevation_deg": [5.0, 5.1],
                "sun_visible": [True, True],
                "earth_visible": [True, True],
                "soc": [1.0, 0.95],
            },
            "provenance": {
                "site_id": site_id,
                "thresholds_used": {
                    "min_soc_fraction": min_soc_fraction,
                    "max_earth_blackout_h": max_blackout_c,
                    "min_sunlit_fraction": min_sunlit_c,
                },
            },
        }


# ─── Verdict Boundary Tests ────────────────────────────────────────────────

def test_verdict_fails_when_soc_below_reserve():
    v, limit, _ = evaluate_verdict(min_soc=0.19, min_soc_fraction=0.20, longest_blackout_h=10.0)
    assert v == "fails"
    assert limit == "battery_reserve"


def test_verdict_marginal_when_soc_within_margin_of_reserve():
    # Reserve = 0.20, margin = 0.10 -> marginal between 0.20 and 0.30
    v, limit, _ = evaluate_verdict(min_soc=0.25, min_soc_fraction=0.20, longest_blackout_h=10.0)
    assert v == "marginal"
    assert limit == "battery_reserve"


def test_verdict_survives_when_soc_well_above_reserve():
    v, limit, _ = evaluate_verdict(min_soc=0.45, min_soc_fraction=0.20, longest_blackout_h=10.0)
    assert v == "survives"
    assert limit == "none"


def test_verdict_fails_when_blackout_exceeds_constraint():
    v, limit, _ = evaluate_verdict(
        min_soc=0.80, min_soc_fraction=0.20,
        longest_blackout_h=52.0, max_blackout_constraint_h=48.0
    )
    assert v == "fails"
    assert limit == "earth_blackout"


def test_verdict_marginal_when_blackout_near_constraint():
    # Limit = 50.0h, margin = 10% (5h) -> marginal between 45h and 50h
    v, limit, _ = evaluate_verdict(
        min_soc=0.80, min_soc_fraction=0.20,
        longest_blackout_h=47.0, max_blackout_constraint_h=50.0
    )
    assert v == "marginal"
    assert limit == "earth_blackout"


def test_verdict_fails_when_sunlit_below_constraint():
    v, limit, _ = evaluate_verdict(
        min_soc=0.80, min_soc_fraction=0.20, longest_blackout_h=5.0,
        sunlit_fraction=0.30, min_sunlit_constraint=0.40
    )
    assert v == "fails"
    assert limit == "sunlit_fraction"


def test_verdict_marginal_when_sunlit_near_constraint():
    # Min = 0.40, margin = 0.05 -> marginal between 0.40 and 0.45
    v, limit, _ = evaluate_verdict(
        min_soc=0.80, min_soc_fraction=0.20, longest_blackout_h=5.0,
        sunlit_fraction=0.42, min_sunlit_constraint=0.40
    )
    assert v == "marginal"
    assert limit == "sunlit_fraction"


# ─── Stub Engine Tests ─────────────────────────────────────────────────────

def test_surface_evaluation_with_stub():
    stub = DeterministicEngineStub(min_soc=0.15)
    res = evaluate_surface(
        site_id="shackleton_connecting_ridge",
        landing_t="2026-04-01T00:00:00Z",
        surface_days=14.0,
        hardware={"min_soc_fraction": 0.20},
        engine_stub=stub,
    )
    assert res["verdict"] == "fails"
    assert res["limiting_factor"] == "battery_reserve"
    assert res["metrics"]["minimum_soc"] == 0.15


# ─── Real SPICE Integration Tests (Section 5) ──────────────────────────────

def test_real_spice_integration_shackleton():
    """Integration Test 1: Real SPICE ephemeris on Shackleton Connecting Ridge."""
    hardware = {
        "panel_m2": 2.5,
        "panel_efficiency": 0.28,
        "battery_wh": 1200.0,
        "base_load_w": 65.0,
        "min_soc_fraction": 0.20,
    }
    constraints = {"max_earth_blackout_h": 100.0}

    # Evaluate 2-day surface interval
    res = evaluate_surface(
        site_id="shackleton_connecting_ridge",
        landing_t="2026-04-01T00:00:00Z",
        surface_days=2.0,
        hardware=hardware,
        constraints=constraints,
        step_s=1800.0,  # 30-min step for fast test execution
    )

    assert "verdict" in res
    assert res["verdict"] in {"survives", "marginal", "fails"}
    assert "metrics" in res
    assert "minimum_soc" in res["metrics"]
    assert "time_series" in res
    assert len(res["time_series"]["times_utc"]) > 0
    assert "provenance" in res
    assert res["provenance"]["site_id"] == "shackleton_connecting_ridge"
    assert res["provenance"]["ephemeris_kernel"] == "de421.bsp"


def test_real_spice_integration_apollo11():
    """Integration Test 2: Real SPICE ephemeris on Apollo 11 (high Earth visibility)."""
    hardware = {
        "panel_m2": 2.5,
        "panel_efficiency": 0.28,
        "battery_wh": 1200.0,
        "base_load_w": 65.0,
        "min_soc_fraction": 0.20,
    }

    res = evaluate_surface(
        site_id="apollo_11",
        landing_t="2026-04-01T00:00:00Z",
        surface_days=2.0,
        hardware=hardware,
        step_s=1800.0,
    )

    assert res["verdict"] in {"survives", "marginal", "fails"}
    # Apollo 11 has permanent 100% Earth visibility
    assert res["metrics"]["longest_earth_blackout_h"] == 0.0
    assert res["provenance"]["site_id"] == "apollo_11"
