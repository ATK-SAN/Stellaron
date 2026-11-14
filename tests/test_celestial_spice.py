"""Gate 2: SPICE celestial sanity tests.

Verifies:
- Solar elevation at lunar south pole remains < ~2.0° across a synodic month.
- Solar elevation at equator swings between ~ -90° and ~ +90°.
- Synodic month (lunar day) period is ~ 29.53 days.
- Earth elevation at lunar south pole librates near the horizon (< ~10°).
- Observer topocentric surface subtraction vs Moon centre parallax matches physical limits.
"""

from pathlib import Path
import numpy as np
import pytest

from engine.celestial import CelestialEngine

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


@pytest.fixture(scope="module")
def spice_engine():
    """Initializes and furnishes SPICE kernels."""
    engine = CelestialEngine(kernel_dir=RAW_DIR)
    engine.load_kernels()
    yield engine
    engine.unload_kernels()


def test_south_pole_solar_elevation(spice_engine):
    """At lunar south pole (-90 deg), solar elevation must remain < ~2.0 deg due to 1.54 deg obliquity."""
    t_start = spice_engine.utc_to_et("2026-01-01T00:00:00")
    t_end = spice_engine.utc_to_et("2026-02-01T00:00:00")
    times_et = np.linspace(t_start, t_end, 745)  # 1 hour steps over 31 days

    res = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=-90.0,
        lon_deg=0.0,
        use_surface_observer=False,
    )

    sun_el = res["sun_el_deg"]
    # Lunar equator-to-ecliptic tilt is ~1.543 deg, so polar sun elevation stays strictly within +/-2.0 deg
    assert np.max(sun_el) < 2.0, f"Max solar elevation at pole exceeded 2.0 deg: {np.max(sun_el):.3f}"
    assert np.min(sun_el) > -2.0, f"Min solar elevation at pole below -2.0 deg: {np.min(sun_el):.3f}"


def test_equator_solar_swing(spice_engine):
    """At lunar equator (0 deg lat, 0 deg lon), solar elevation swings from ~ -90 deg to ~ +90 deg."""
    t_start = spice_engine.utc_to_et("2026-01-01T00:00:00")
    t_end = spice_engine.utc_to_et("2026-02-01T00:00:00")
    times_et = np.linspace(t_start, t_end, 745)

    res = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=0.0,
        lon_deg=0.0,
        use_surface_observer=False,
    )

    sun_el = res["sun_el_deg"]
    assert np.max(sun_el) > 85.0, f"Equatorial solar noon did not reach zenith: {np.max(sun_el):.2f}"
    assert np.min(sun_el) < -85.0, f"Equatorial solar nadir did not reach nadir: {np.min(sun_el):.2f}"


def test_synodic_month_period(spice_engine):
    """Time between successive solar noons at lunar equator is approximately 29.53 days."""
    t_start = spice_engine.utc_to_et("2026-01-01T00:00:00")
    t_end = spice_engine.utc_to_et("2026-03-05T00:00:00")  # > 2 full lunar days
    times_et = np.linspace(t_start, t_end, 3000)

    res = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=0.0,
        lon_deg=0.0,
        use_surface_observer=False,
    )

    sun_el = res["sun_el_deg"]

    # Locate peak solar elevation indices
    peak_indices = []
    for i in range(1, len(sun_el) - 1):
        if sun_el[i] > 80.0 and sun_el[i] > sun_el[i - 1] and sun_el[i] >= sun_el[i + 1]:
            peak_indices.append(i)

    assert len(peak_indices) >= 2, "Failed to identify at least two solar noon peaks"

    period_s = times_et[peak_indices[1]] - times_et[peak_indices[0]]
    period_days = period_s / 86400.0

    # Synodic period of Moon is approximately 29.53059 days
    assert 29.0 < period_days < 30.1, f"Measured synodic period {period_days:.3f} days outside expected range [29.0, 30.1]"


def test_south_pole_earth_elevation(spice_engine):
    """From lunar south pole, Earth remains near the horizon and librates within < ~10 deg."""
    t_start = spice_engine.utc_to_et("2026-01-01T00:00:00")
    t_end = spice_engine.utc_to_et("2026-02-01T00:00:00")
    times_et = np.linspace(t_start, t_end, 745)

    res = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=-90.0,
        lon_deg=0.0,
        use_surface_observer=False,
    )

    earth_el = res["earth_el_deg"]
    assert np.all(np.abs(earth_el) < 10.0), f"Earth elevation at pole exceeded 10 deg: max {np.max(np.abs(earth_el)):.2f}"


def test_observer_surface_vs_centre_parallax(spice_engine):
    """Verify topocentric site parallax differences: negligible for Sun, ~0.26 deg for Earth."""
    t = spice_engine.utc_to_et("2026-06-21T12:00:00")
    times_et = np.array([t])

    res_centre = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=-89.54,
        lon_deg=116.7,
        use_surface_observer=False,
    )
    res_surface = spice_engine.compute_ephemeris_series(
        times_et=times_et,
        lat_deg=-89.54,
        lon_deg=116.7,
        surface_elevation_m=1250.0,
        use_surface_observer=True,
    )

    # Parallax for Sun at 1 AU should be < 0.01 deg
    sun_el_diff = abs(res_centre["sun_el_deg"][0] - res_surface["sun_el_deg"][0])
    assert sun_el_diff < 0.01, f"Solar topocentric parallax unexpectedly large: {sun_el_diff} deg"

    # Parallax for Earth at ~384,400 km should be <= 0.35 deg
    earth_el_diff = abs(res_centre["earth_el_deg"][0] - res_surface["earth_el_deg"][0])
    assert earth_el_diff < 0.35, f"Earth topocentric parallax unexpectedly large: {earth_el_diff} deg"
