"""Tests for state transition refinement, interval extraction, and censorship flagging."""

import numpy as np
import pytest

from engine.intervals import (
    refine_transition,
    intervals_from_mask,
    compute_metrics,
    time_to_next_change,
)


def test_refine_transition_exact_bisection():
    """Verify bisection locates a step transition to <= 1s tolerance."""
    target_transition_s = 1532.4

    def eval_fn(t: float) -> bool:
        return t >= target_transition_s

    refined_s = refine_transition(eval_fn, t_before=1000.0, t_after=2000.0, tol_s=1.0)
    assert abs(refined_s - target_transition_s) <= 1.0


def test_refine_transition_no_transition():
    """If endpoints have identical state, bisection returns midpoint without loop error."""
    def eval_always_true(t: float) -> bool:
        return True

    refined_s = refine_transition(eval_always_true, 100.0, 200.0, tol_s=1.0)
    assert np.isclose(refined_s, 150.0)


def test_intervals_from_mask_all_lit():
    """All-lit mask has 1 interval spanning full range, flagged as censored (touches both boundaries)."""
    times_s = np.linspace(0.0, 3600.0, 37)  # 100s steps
    mask = np.ones(37, dtype=bool)

    intervals = intervals_from_mask(mask, times_s)
    assert len(intervals) == 1
    assert intervals[0]["start_s"] == 0.0
    assert intervals[0]["end_s"] == 3600.0
    assert intervals[0]["duration_s"] == 3600.0
    assert intervals[0]["censored"] is True


def test_intervals_from_mask_all_dark():
    """All-dark mask has 0 lit intervals."""
    times_s = np.linspace(0.0, 3600.0, 37)
    mask = np.zeros(37, dtype=bool)

    intervals = intervals_from_mask(mask, times_s)
    assert len(intervals) == 0


def test_intervals_from_mask_touching_start_and_end():
    """Intervals touching the start and end of observation must be flagged as censored."""
    times_s = np.array([0, 10, 20, 30, 40, 50, 60], dtype=float)
    # Lit at start (0, 10), dark (20), lit in middle (30), dark (40), lit at end (50, 60)
    mask = np.array([True, True, False, True, False, True, True])

    intervals = intervals_from_mask(mask, times_s)
    assert len(intervals) == 3

    # First interval touches t=0 -> censored
    assert intervals[0]["start_s"] == 0.0
    assert intervals[0]["end_s"] == 10.0
    assert intervals[0]["censored"] is True

    # Middle interval (30) does not touch boundaries -> not censored
    assert intervals[1]["start_s"] == 30.0
    assert intervals[1]["end_s"] == 30.0
    assert intervals[1]["censored"] is False

    # Last interval touches t=60 -> censored
    assert intervals[2]["start_s"] == 50.0
    assert intervals[2]["end_s"] == 60.0
    assert intervals[2]["censored"] is True


def test_compute_metrics_summary():
    """Verify aggregation of total seconds, dark runs, and elevation statistics."""
    times_s = np.linspace(0.0, 1000.0, 11)  # 0, 100, 200... 1000 (dt = 100s)
    mask = np.array([True, True, True, False, False, True, True, False, False, False, False])
    elevations = np.array([1.0, 2.0, 3.0, 0.0, -1.0, 4.0, 5.0, -2.0, -3.0, -4.0, -5.0])

    metrics = compute_metrics(times_s, mask, elevations)

    assert metrics["total_visible_s"] == 500.0
    assert metrics["total_dark_s"] == 600.0
    assert metrics["max_elevation_deg"] == 5.0
    assert np.isclose(metrics["mean_elevation_deg"], (1 + 2 + 3 + 4 + 5) / 5.0)


def test_time_to_next_change():
    """Verify time_to_next_change returns the delta to the next transition."""
    transitions = [100.0, 250.0, 400.0]

    assert time_to_next_change(50.0, transitions) == 50.0
    assert time_to_next_change(100.0, transitions) == 150.0
    assert time_to_next_change(260.0, transitions) == 140.0
    assert time_to_next_change(500.0, transitions) is None
