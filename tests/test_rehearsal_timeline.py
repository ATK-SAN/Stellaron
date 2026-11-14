"""Unit tests for rehearsal/timeline.py."""

from datetime import datetime, timedelta, timezone
import pytest
from rehearsal.timeline import compute_timeline, parse_utc_dt


def test_zero_delay_reproduces_baseline_exactly():
    plan = {
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "surface_days": 14.0,
    }

    baseline = compute_timeline(plan, perturbation=None)
    with_zeros = compute_timeline(
        plan,
        perturbation=[
            {"type": "launch_slip", "days": 0.0},
            {"type": "transit_extension", "days": 0.0},
            {"type": "orbit_hold_extension", "days": 0.0},
            {"type": "landing_retry", "days": 0.0},
        ],
    )

    assert baseline["milestones"] == with_zeros["milestones"]
    assert baseline["phases"] == with_zeros["phases"]
    assert baseline["delays"]["total_slip_days"] == 0.0


def test_launch_slip_shifts_all_subsequent_phases():
    plan = {
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "surface_days": 14.0,
    }

    base = compute_timeline(plan)
    slipped = compute_timeline(plan, perturbation={"type": "launch_slip", "days": 3.0})

    base_launch = parse_utc_dt(base["milestones"]["launch_utc"])
    slip_launch = parse_utc_dt(slipped["milestones"]["launch_utc"])
    assert (slip_launch - base_launch).total_seconds() == pytest.approx(3.0 * 86400.0)

    base_landing = parse_utc_dt(base["milestones"]["landing_utc"])
    slip_landing = parse_utc_dt(slipped["milestones"]["landing_utc"])
    assert (slip_landing - base_landing).total_seconds() == pytest.approx(3.0 * 86400.0)

    base_surface_end = parse_utc_dt(base["milestones"]["surface_end_utc"])
    slip_surface_end = parse_utc_dt(slipped["milestones"]["surface_end_utc"])
    assert (slip_surface_end - base_surface_end).total_seconds() == pytest.approx(3.0 * 86400.0)


def test_transit_extension_shifts_orbit_and_landing():
    plan = {
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "surface_days": 14.0,
    }

    base = compute_timeline(plan)
    ext = compute_timeline(plan, perturbation={"type": "transit_extension", "days": 2.0})

    # Launch should not change
    assert ext["milestones"]["launch_utc"] == base["milestones"]["launch_utc"]

    # Orbit arrival, landing, and surface end shift by 2 days
    base_arr = parse_utc_dt(base["milestones"]["orbit_arrival_utc"])
    ext_arr = parse_utc_dt(ext["milestones"]["orbit_arrival_utc"])
    assert (ext_arr - base_arr).total_seconds() == pytest.approx(2.0 * 86400.0)

    base_land = parse_utc_dt(base["milestones"]["landing_utc"])
    ext_land = parse_utc_dt(ext["milestones"]["landing_utc"])
    assert (ext_land - base_land).total_seconds() == pytest.approx(2.0 * 86400.0)


def test_orbit_hold_extension_shifts_descent_and_landing():
    plan = {
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "surface_days": 14.0,
    }

    base = compute_timeline(plan)
    ext = compute_timeline(plan, perturbation={"type": "orbit_hold_extension", "days": 1.5})

    # Launch & orbit arrival should not change
    assert ext["milestones"]["launch_utc"] == base["milestones"]["launch_utc"]
    assert ext["milestones"]["orbit_arrival_utc"] == base["milestones"]["orbit_arrival_utc"]

    # Descent and landing shift by 1.5 days
    base_desc = parse_utc_dt(base["milestones"]["descent_utc"])
    ext_desc = parse_utc_dt(ext["milestones"]["descent_utc"])
    assert (ext_desc - base_desc).total_seconds() == pytest.approx(1.5 * 86400.0)


def test_landing_retry_shifts_touchdown_only():
    plan = {
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.0,
        "orbit_hold_days": 1.0,
        "surface_days": 14.0,
    }

    base = compute_timeline(plan)
    retry = compute_timeline(plan, perturbation={"type": "landing_retry", "days": 1.0})

    assert retry["milestones"]["launch_utc"] == base["milestones"]["launch_utc"]
    assert retry["milestones"]["orbit_arrival_utc"] == base["milestones"]["orbit_arrival_utc"]
    assert retry["milestones"]["descent_utc"] == base["milestones"]["descent_utc"]

    base_land = parse_utc_dt(base["milestones"]["landing_utc"])
    retry_land = parse_utc_dt(retry["milestones"]["landing_utc"])
    assert (retry_land - base_land).total_seconds() == pytest.approx(1.0 * 86400.0)


def test_phase_boundaries_are_contiguous_and_monotonic():
    plan = {
        "launch_utc": "2026-04-01T12:00:00Z",
        "transit_days": 3.5,
        "orbit_hold_days": 2.0,
        "surface_days": 10.0,
    }
    tl = compute_timeline(plan)
    phases = tl["phases"]

    assert len(phases) == 5
    for i in range(len(phases) - 1):
        assert phases[i]["t1_utc"] == phases[i + 1]["t0_utc"]
        t0 = parse_utc_dt(phases[i]["t0_utc"])
        t1 = parse_utc_dt(phases[i]["t1_utc"])
        assert t1 > t0
        duration_s = (t1 - t0).total_seconds()
        assert phases[i]["duration_seconds"] == pytest.approx(duration_s)
