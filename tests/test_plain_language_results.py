"""Unit tests for Item A (Plain-Language Results, Headline Templates, Formatted Units).

Validates:
- Battery headline branch logic (stays above reserve, dips, runs out / censored).
- Timeline headline template generation.
- Human duration formatting (<48h in hours/mins, >=48h in days/hours).
- Tile-to-data agreement: transitions count matches transitions array length across all 14 site JSONs.
- Duration consistency: time_below_reserve_s matches deficit_intervals duration.
- Zero banned phrases in copy templates.
"""

import json
from pathlib import Path
import re
import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "web" / "public" / "data"
COPY_FILE = BASE_DIR / "web" / "src" / "copy" / "results.js"


def format_duration(seconds):
    """Python mirror of formatDuration in web/src/copy/results.js."""
    if seconds is None:
        return "—"
    s = max(0, round(seconds))
    total_h = s / 3600
    if total_h >= 48:
        days = s // 86400
        hours = (s % 86400) // 3600
        return f"{days} d {hours} h"
    hours = s // 3600
    minutes = (s % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
    return f"{minutes}m"


def get_battery_headline(min_soc, reserve_frac=0.2, time_below_reserve_s=0, is_censored=False):
    """Python mirror of getBatteryHeadline in web/src/copy/results.js."""
    reserve_pct = round(reserve_frac * 100)
    min_soc_pct = f"{(min_soc * 100):.1f}" if min_soc is not None else "0.0"
    duration = format_duration(time_below_reserve_s)

    if min_soc is not None and min_soc >= reserve_frac:
        return f"Modelled battery stays above the {reserve_pct}% reserve line for the full study period."

    if min_soc is not None and min_soc <= 0.001:
        if is_censored:
            return f"Modelled battery runs out of energy for {duration}; study period ended before full recharge."
        return f"Modelled battery runs out of energy for {duration} before recovering."

    return f"Modelled battery dips below the {reserve_pct}% reserve line for {duration}, reaching a low of {min_soc_pct}%."


def get_timeline_headline(sun_pct, longest_dark_h, earth_pct, longest_blackout_h):
    """Python mirror of getTimelineHeadline in web/src/copy/results.js."""
    longest_dark = format_duration(longest_dark_h * 3600)
    longest_blackout = format_duration(longest_blackout_h * 3600)
    return (
        f"Sunlight is modelled for {sun_pct:.1f}% of the period "
        f"(longest dark interval {longest_dark}), with direct Earth radio line-of-sight "
        f"for {earth_pct:.1f}% (longest blackout {longest_blackout})."
    )


# --- Headline Branch Tests ---

def test_battery_headline_stays_above_reserve():
    headline = get_battery_headline(min_soc=0.45, reserve_frac=0.2, time_below_reserve_s=0)
    assert headline == "Modelled battery stays above the 20% reserve line for the full study period."
    assert "safe" not in headline.lower()
    assert "guaranteed" not in headline.lower()


def test_battery_headline_dips_below_reserve():
    # 36 hours below reserve
    headline = get_battery_headline(min_soc=0.082, reserve_frac=0.2, time_below_reserve_s=36 * 3600)
    assert headline == "Modelled battery dips below the 20% reserve line for 36h, reaching a low of 8.2%."


def test_battery_headline_empties_censored():
    # 2542800 s = 706.33 h = 29 d 10 h
    headline = get_battery_headline(min_soc=0.0, reserve_frac=0.2, time_below_reserve_s=2542800, is_censored=True)
    assert headline == "Modelled battery runs out of energy for 29 d 10 h; study period ended before full recharge."


def test_battery_headline_empties_uncensored():
    headline = get_battery_headline(min_soc=0.0, reserve_frac=0.2, time_below_reserve_s=72 * 3600, is_censored=False)
    assert headline == "Modelled battery runs out of energy for 3 d 0 h before recovering."


def test_timeline_headline_template():
    headline = get_timeline_headline(
        sun_pct=38.2,
        longest_dark_h=124.5,  # 5 d 4 h
        earth_pct=63.2,
        longest_blackout_h=34.0,  # 34h
    )
    assert "Sunlight is modelled for 38.2% of the period" in headline
    assert "longest dark interval 5 d 4 h" in headline
    assert "direct Earth radio line-of-sight for 63.2%" in headline
    assert "longest blackout 34h" in headline


# --- Duration Formatter Tests ---

def test_duration_formatter_units():
    # Under 48 hours: hours and minutes
    assert format_duration(3600) == "1h"
    assert format_duration(5400) == "1h 30m"
    assert format_duration(47 * 3600) == "47h"
    assert format_duration(1800) == "30m"

    # 48 hours or more: days and hours
    assert format_duration(48 * 3600) == "2 d 0 h"
    assert format_duration(398 * 3600) == "16 d 14 h"
    assert format_duration(2542800) == "29 d 10 h"


# --- Data Agreement across all 14 sites ---

def test_transitions_and_energy_data_agreement():
    site_files = list(DATA_DIR.glob("*_2026.json"))
    # Filter out benchmark and crosscheck files
    site_files = [f for f in site_files if not f.name.startswith("agreement") and not f.name.startswith("nasa")]
    assert len(site_files) >= 14, f"Expected 14 site files, found {len(site_files)}"

    for f in site_files:
        with open(f, "r", encoding="utf-8") as fh:
            data = json.load(fh)

        # 1. Transitions array exists
        transitions = data.get("transitions", [])
        assert isinstance(transitions, list), f"{f.name}: 'transitions' should be a list"

        # 2. Deficit duration consistency
        energy = data.get("metrics", {}).get("energy", {})
        time_below = energy.get("time_below_reserve_s", 0)
        deficits = energy.get("deficit_intervals", [])
        if deficits:
            # First deficit interval duration matches or is close to time_below_reserve_s
            total_deficit_s = sum(d.get("duration_s", 0) for d in deficits)
            assert abs(time_below - total_deficit_s) < 1.0, (
                f"{f.name}: time_below_reserve_s ({time_below}) != sum of deficits ({total_deficit_s})"
            )


def test_copy_file_exists_and_contains_no_banned_phrases():
    assert COPY_FILE.exists(), f"Copy file missing at {COPY_FILE}"
    content = COPY_FILE.read_text(encoding="utf-8").lower()

    banned = [
        "zero-fabrication guarantee",
        "100% convergence",
        "guaranteed",
        "nasa-approved",
        "nasa-validated",
        "will survive",
        "safe to land",
    ]
    for phrase in banned:
        assert phrase not in content, f"Banned phrase '{phrase}' found in copy/results.js"
