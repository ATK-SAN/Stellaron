"""Celestial geometry engine using NAIF SPICE / SpiceyPy for Sun and Earth positions.

Scientific conventions:
- Target bodies: SUN (10), EARTH (399), relative to MOON (301).
- Reference frame: MOON_ME (Moon Mean Earth / Polar Axis body-fixed frame).
- Aberration correction: LT+S (Light-Time + Stellar Aberration).
- Observer model:
    - Default: "moon_centre" (direction vectors originating from Moon centre).
    - Optional: "surface_site" (subtracts surface topocentric site vector from Moon centre).
- Time standard: UTC inputs converted to Ephemeris Time (ET / TDB) using leapseconds kernel.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union, Any
import numpy as np
import spiceypy as spice

from engine.geometry import enu_basis, body_az_el, surface_site_vector

DEFAULT_FRAME: str = "MOON_ME"
DEFAULT_ABCORR: str = "LT+S"
DEFAULT_OBSERVER: str = "MOON"


class CelestialEngine:
    """Manages SPICE kernel pool and provides high-precision celestial positions."""

    def __init__(self, kernel_dir: Optional[Union[str, Path]] = None):
        if kernel_dir is None:
            self.kernel_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
        else:
            self.kernel_dir = Path(kernel_dir)
        self.loaded_kernels: List[str] = []

    def load_kernels(self) -> List[str]:
        """Furnish required SPICE kernels into the SPICE kernel pool."""
        required = [
            "naif0012.tls",
            "pck00010.tpc",
            "moon_080317.tf",
            "moon_pa_de421_1900-2050.bpc",
            "de421.bsp",
        ]
        loaded = []
        for kname in required:
            kpath = self.kernel_dir / kname
            if kpath.exists() and kpath.stat().st_size > 0:
                spice.furnsh(str(kpath))
                loaded.append(str(kname))
            else:
                raise FileNotFoundError(
                    f"Required SPICE kernel missing: {kpath}. Run scripts/fetch_data.py to download."
                )
        self.loaded_kernels = loaded
        return loaded

    def unload_kernels(self) -> None:
        """Clear all loaded kernels from the SPICE pool."""
        spice.kclear()
        self.loaded_kernels = []

    def utc_to_et(self, utc_str: str) -> float:
        """Convert ISO-8601 UTC string to Ephemeris Time (TDB seconds past J2000)."""
        return float(spice.str2et(utc_str))

    def et_to_utc(self, et: float, precision: int = 3) -> str:
        """Convert Ephemeris Time to ISO-8601 UTC string."""
        return str(spice.et2utc(et, "ISOC", precision))

    def get_body_position_m(
        self,
        target: str,
        et: float,
        frame: str = DEFAULT_FRAME,
        abcorr: str = DEFAULT_ABCORR,
    ) -> np.ndarray:
        """Retrieve 3D position vector of target relative to Moon in metres.

        Returns vector in Moon body-fixed frame (MOON_ME).
        """
        # spice.spkpos returns position in km
        pos_km, _ = spice.spkpos(targ=target, et=et, ref=frame, abcorr=abcorr, obs=DEFAULT_OBSERVER)
        return np.asarray(pos_km, dtype=np.float64) * 1000.0  # Convert to metres

    def compute_ephemeris_series(
        self,
        times_et: np.ndarray,
        lat_deg: float,
        lon_deg: float,
        surface_elevation_m: float = 0.0,
        use_surface_observer: bool = False,
        frame: str = DEFAULT_FRAME,
        abcorr: str = DEFAULT_ABCORR,
    ) -> Dict[str, Any]:
        """Compute Sun and Earth directions, azimuths, and elevations for a time series.

        Inputs:
            times_et: 1D numpy array of Ephemeris Times (ET seconds past J2000)
            lat_deg: Site latitude in degrees [-90, +90]
            lon_deg: Site longitude in degrees [-180, +180]
            surface_elevation_m: Site elevation in metres
            use_surface_observer: False for Moon centre approximation, True for surface topocentric site
            frame: SPICE reference frame (default: "MOON_ME")
            abcorr: SPICE aberration correction (default: "LT+S")

        Outputs:
            Dict containing arrays for sun_az_deg, sun_el_deg, earth_az_deg, earth_el_deg,
            sun_dist_m, earth_dist_m, and provenance metadata.
        """
        enu = enu_basis(lat_deg, lon_deg)
        site_vec_m = (
            surface_site_vector(lat_deg, lon_deg, surface_elevation_m)
            if use_surface_observer
            else np.zeros(3, dtype=np.float64)
        )

        n = len(times_et)
        sun_az_deg = np.zeros(n, dtype=np.float64)
        sun_el_deg = np.zeros(n, dtype=np.float64)
        sun_dist_m = np.zeros(n, dtype=np.float64)

        earth_az_deg = np.zeros(n, dtype=np.float64)
        earth_el_deg = np.zeros(n, dtype=np.float64)
        earth_dist_m = np.zeros(n, dtype=np.float64)

        for i in range(n):
            et = float(times_et[i])

            # Sun position relative to observer
            sun_pos_m = self.get_body_position_m("SUN", et, frame=frame, abcorr=abcorr) - site_vec_m
            sun_dist_m[i] = float(np.linalg.norm(sun_pos_m))
            az_s, el_s = body_az_el(sun_pos_m, enu)
            sun_az_deg[i] = az_s
            sun_el_deg[i] = el_s

            # Earth position relative to observer
            earth_pos_m = self.get_body_position_m("EARTH", et, frame=frame, abcorr=abcorr) - site_vec_m
            earth_dist_m[i] = float(np.linalg.norm(earth_pos_m))
            az_e, el_e = body_az_el(earth_pos_m, enu)
            earth_az_deg[i] = az_e
            earth_el_deg[i] = el_e

        observer_model = "surface_site" if use_surface_observer else "moon_centre"

        return {
            "times_et": times_et,
            "sun_az_deg": sun_az_deg,
            "sun_el_deg": sun_el_deg,
            "sun_dist_m": sun_dist_m,
            "earth_az_deg": earth_az_deg,
            "earth_el_deg": earth_el_deg,
            "earth_dist_m": earth_dist_m,
            "frame": frame,
            "abcorr": abcorr,
            "observer_model": observer_model,
            "kernel_versions": list(self.loaded_kernels),
        }
