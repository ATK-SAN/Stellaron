"""Time-series state transitions, bisection refinement, and interval metric computations.

Scientific conventions:
- Transitions: Refined by bisection to <= 1 s precision.
- Boundary handling: Intervals touching start or end of observation are flagged 'censored'.
- Metrics: Total active seconds, longest active interval, longest dark/blackout run,
  max/mean elevation, time to next state transition.
"""

from typing import Callable, Dict, List, Optional, Tuple, Any
import numpy as np


def refine_transition(
    eval_fn: Callable[[float], bool],
    t_before: float,
    t_after: float,
    tol_s: float = 1.0,
    max_iter: int = 64,
) -> float:
    """Refine a boolean state transition between t_before and t_after via bisection.

    Inputs:
        eval_fn: Function returning boolean state (True/False) at epoch seconds t
        t_before: Epoch second of state before transition
        t_after: Epoch second of state after transition
        tol_s: Convergence tolerance in seconds (default <= 1.0 s)
        max_iter: Maximum bisection iterations

    Outputs:
        Refined transition epoch seconds to within tol_s.
    """
    v_start = eval_fn(t_before)
    v_end = eval_fn(t_after)

    if v_start == v_end:
        # No transition detected between endpoints
        return (t_before + t_after) * 0.5

    t_low = float(min(t_before, t_after))
    t_high = float(max(t_before, t_after))
    v_low = eval_fn(t_low)

    for _ in range(max_iter):
        if (t_high - t_low) <= tol_s:
            break
        t_mid = (t_low + t_high) * 0.5
        v_mid = eval_fn(t_mid)
        if v_mid == v_low:
            t_low = t_mid
        else:
            t_high = t_mid

    return (t_low + t_high) * 0.5


def intervals_from_mask(
    mask: np.ndarray,
    times_s: np.ndarray,
) -> List[Dict[str, Any]]:
    """Extract contiguous True intervals from a sampled boolean mask.

    Handles boundary runs by explicitly flagging them as 'censored'.

    Inputs:
        mask: 1D boolean numpy array of states
        times_s: 1D float numpy array of corresponding epoch seconds

    Outputs:
        List of dicts: [
            {
                "start_s": float,
                "end_s": float,
                "duration_s": float,
                "censored": bool,
                "start_idx": int,
                "end_idx": int
            }, ...
        ]
    """
    if len(mask) == 0:
        return []
    if len(mask) != len(times_s):
        raise ValueError("mask and times_s must have identical length")

    intervals: List[Dict[str, Any]] = []
    n = len(mask)

    in_run = False
    start_idx = 0

    for i in range(n):
        if mask[i] and not in_run:
            in_run = True
            start_idx = i
        elif not mask[i] and in_run:
            in_run = False
            end_idx = i - 1
            t_start = float(times_s[start_idx])
            t_end = float(times_s[end_idx])
            censored = (start_idx == 0)
            intervals.append({
                "start_s": t_start,
                "end_s": t_end,
                "duration_s": max(0.0, t_end - t_start),
                "censored": censored,
                "start_idx": int(start_idx),
                "end_idx": int(end_idx),
            })

    if in_run:
        end_idx = n - 1
        t_start = float(times_s[start_idx])
        t_end = float(times_s[end_idx])
        censored = True  # Touches the end boundary
        intervals.append({
            "start_s": t_start,
            "end_s": t_end,
            "duration_s": max(0.0, t_end - t_start),
            "censored": censored,
            "start_idx": int(start_idx),
            "end_idx": int(end_idx),
        })

    return intervals


def compute_metrics(
    times_s: np.ndarray,
    visible_mask: np.ndarray,
    elevation_deg: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """Compute summary metrics for an illumination or geometric visibility time-series.

    Outputs:
        total_visible_s: Total seconds where visible_mask is True
        total_dark_s: Total seconds where visible_mask is False
        longest_visible_s: Longest contiguous visible interval (flagged if censored)
        longest_dark_s: Longest contiguous dark interval (flagged if censored)
        max_elevation_deg: Maximum elevation when visible (or None)
        mean_elevation_deg: Mean elevation when visible (or None)
        visible_intervals: List of visible interval records
        dark_intervals: List of dark/blackout interval records
    """
    if len(times_s) < 2:
        return {
            "total_visible_s": 0.0,
            "total_dark_s": 0.0,
            "longest_visible_s": 0.0,
            "longest_dark_s": 0.0,
            "max_elevation_deg": None,
            "mean_elevation_deg": None,
            "visible_intervals": [],
            "dark_intervals": [],
        }

    dt = float(np.mean(np.diff(times_s)))
    num_visible = int(np.sum(visible_mask))
    total_visible_s = float(num_visible * dt)
    total_dark_s = float((len(visible_mask) - num_visible) * dt)

    vis_intervals = intervals_from_mask(visible_mask, times_s)
    dark_intervals = intervals_from_mask(~visible_mask, times_s)

    longest_vis_s = max([inv["duration_s"] for inv in vis_intervals], default=0.0)
    longest_dark_s = max([inv["duration_s"] for inv in dark_intervals], default=0.0)

    max_el = None
    mean_el = None
    if elevation_deg is not None and np.any(visible_mask):
        vis_elevations = elevation_deg[visible_mask]
        max_el = float(np.max(vis_elevations))
        mean_el = float(np.mean(vis_elevations))

    return {
        "total_visible_s": total_visible_s,
        "total_dark_s": total_dark_s,
        "longest_visible_s": longest_vis_s,
        "longest_dark_s": longest_dark_s,
        "max_elevation_deg": max_el,
        "mean_elevation_deg": mean_el,
        "visible_intervals": vis_intervals,
        "dark_intervals": dark_intervals,
    }


def time_to_next_change(current_t: float, transition_times: List[float]) -> Optional[float]:
    """Calculate seconds from current_t until the next state transition."""
    for t in sorted(transition_times):
        if t > current_t:
            return float(t - current_t)
    return None
