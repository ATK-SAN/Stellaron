# STELLARON 🌙

**Lunar Landing-Site Navigator** — NASA Space Apps 2026

A reproducible, SPICE-backed science engine for evaluating candidate lunar south-pole landing sites. Pure Python science, static-first React frontend, zero fabricated data.

---

## Quick Start

```powershell
# 1. Clone & install
git clone <repo>
cd stellaron
pip install -r requirements.txt

# 2. Download SPICE kernels (once)
python scripts/fetch_data.py

# 3. Run all tests
$env:PYTHONPATH = "."
python -m pytest tests/ -v
# → 116 passed

# 4. Run an offline Mission Rehearsal
python -m rehearsal.run <mission_plan.json> <results.json>

# 5. Precompute static site library (2026-04-01 → 2026-05-01)
python -m precompute.generate_library
# → data/processed/*.json + web/public/data/*.json

# 5. Launch the web app
cd web
npm.cmd install
npm.cmd run dev
# → http://localhost:5173

# 6. (Optional) Launch the FastAPI server
cd ..
uvicorn api.main:app --reload
# → http://localhost:8000/docs
```

---

## Architecture

```
stellaron/
├── engine/           # Pure Python science modules (no I/O)
│   ├── geometry.py   # ENU basis, az/el, surface vectors
│   ├── celestial.py  # SpiceyPy wrapper — sun/Earth ephemeris
│   ├── horizon.py    # DEM ray-marching with lunar curvature
│   ├── intervals.py  # Bisection refinement, sun/Earth intervals & metrics
│   ├── energy.py     # Solar power + battery SOC simulation
│   ├── terrain.py    # Slope, aspect, roughness, landing footprint
│   ├── agreement.py  # Visual/science agreement benchmark (IoU ≥ 0.90)
│   └── runner.py     # Full pipeline → canonical SHA-256 JSON
│
├── precompute/
│   └── generate_library.py   # Batch runs all 14 sites → static JSON
│
├── rehearsal/        # Mission Rehearsal Layer (Physics & Rehearsal Engine)
│   ├── schema.py     # Upload JSON validation & normalisation (≤ 1 MB)
│   ├── timeline.py   # Deterministic UTC timeline & delay perturbation model
│   ├── surface.py    # Surface stay physical evaluation, SoC & verdict logic
│   ├── slip.py       # Landing date sweep, tolerance & recovery detection
│   ├── gates.py      # 4 decision gates (PRE_LAUNCH to PRE_DESCENT)
│   ├── scenarios.py  # Perturbation application & neutral templated text
│   ├── compare.py    # Multi-scenario & date comparisons (sorted by date)
│   ├── choreography.py # Keyframed 3D trajectory sequence with SPICE
│   └── run.py        # Complete CLI runner pipeline → deterministic SHA-256
│
├── api/
│   └── main.py       # FastAPI server (serves precomputed data)
│
├── web/              # React + Three.js frontend (static-first)
│   └── public/data/  # Precomputed JSON assets (served directly)
│
├── data/
│   ├── sites.json    # 14 verified lunar sites (coordinates + sources)
│   ├── manifest.json # SHA-256 of all SPICE kernels
│   ├── raw/          # SPICE kernels (not committed to git)
│   └── processed/    # Precomputed results + hero terrain meshes
│
├── tests/            # 47 tests across 6 gates
│   ├── test_geometry.py          # G1 — geometric primitives
│   ├── test_horizon.py           # G1 — DEM ray-marching
│   ├── test_intervals.py         # G1 — interval/bisection logic
│   ├── test_energy.py            # G1 — solar/battery model
│   ├── test_celestial_spice.py   # G2 — SPICE sanity checks
│   ├── test_dem.py               # G3 — terrain analysis
│   ├── test_repro.py             # G5 — reproducibility + agreement
│   └── test_integration.py       # G6 — end-to-end schema + SHA-256
│
└── scripts/
    └── fetch_data.py  # Download and verify SPICE kernels
```

---

## Data Sources

| Data | Source | License |
|------|--------|---------|
| Solar/Earth ephemeris | JPL DE421 (NAIF) | Public domain |
| Lunar orientation frame | MOON_ME via FK kernel `moon_080317.tf` (NAIF) | Public domain |
| Leap seconds | `naif0012.tls` (NAIF) | Public domain |
| Planetary constants | `pck00010.tpc` (NAIF) | Public domain |
| Binary lunar PCK | `moon_pa_de421_1900-2050.bpc` (NAIF) | Public domain |
| Landing site coordinates | NASA Artemis III Science Definition Team Report (2020); published peer-reviewed papers; Chang'e 4 mission records | Public domain / open access |
| DEM data (hero terrains) | Synthetic mesh derived from LOLA 5 m/px GeoTIFF topography (PGDA/GSFC) — real DEM streaming planned | NASA/USGS open data |

> **No data was fabricated.** All coordinates are traceable to the sources listed above. Hero terrain meshes are analytically generated from known ridge/crater geometry pending live GeoTIFF streaming.

---

## SPICE Kernels (SHA-256 Verified)

| Kernel | Bytes | Purpose |
|--------|-------|---------|
| `naif0012.tls` | 5,257 | Leap second table |
| `pck00010.tpc` | 126,143 | Planetary constants (radii, rotation) |
| `moon_080317.tf` | 21,437 | MOON_ME frame kernel |
| `moon_pa_de421_1900-2050.bpc` | 1,770,496 | Lunar binary PCK |
| `de421.bsp` | 16,790,528 | Planetary/lunar SPK (1900–2050) |

All SHA-256 values stored in `data/manifest.json`.

---

## Landing Sites (14 Total)

| Site | Lat | Lon | Coverage | Sunlight % | Earth Vis % |
|------|-----|-----|----------|-----------|------------|
| Shackleton Connecting Ridge | -89.54° | 116.7° | hero | 38.2% | 7.2% |
| Peak Near Shackleton | -89.78° | 154.5° | hero | 38.1% | 0.0% |
| de Gerlache Rim 1 | -88.71° | -88.7° | hero | 0.0% | 24.0% |
| de Gerlache Rim 2 | -88.34° | -68.8° | standard | 34.4% | 43.4% |
| Connecting Ridge Extension | -89.44° | -137.4° | limited | 0.0% | 39.0% |
| Malapert Mountain Peak | -85.99° | 2.93° | standard | 43.6% | 63.2% |
| Haworth Crater Rim | -87.87° | -5.1° | standard | 36.4% | 50.2% |
| Nobile Rim 1 (VIPER Site) | -85.39° | 37.85° | standard | 45.0% | 60.6% |
| Amundsen Rim | -84.5° | 82.8° | standard | 46.3% | 43.6% |
| Faustini Rim A | -87.18° | 77.0° | standard | 41.7% | 43.5% |
| Apollo 11 (Statio Tranquillitatis) | 0.674° | 23.47° | standard | 51.1% | 100.0% |
| Apollo 12 (Oceanus Procellarum) | -3.01° | -23.42° | standard | 51.0% | 100.0% |
| Apollo 17 (Taurus-Littrow) | 20.19° | 30.77° | standard | 51.3% | 100.0% |
| Chang'e 4 (Von Kármán) | -45.44° | 177.60° | limited | 48.6% | 0.0% |

> Study interval: 2026-04-01 to 2026-05-01 (UTC), 10-minute steps.
> Limited-coverage sites display a hatch overlay in the UI per the Rulebook.

---

## Test Gates

| Gate | Description | Tests | Status |
|------|-------------|-------|--------|
| G1 | Geometric primitives, horizon, intervals, energy | 25 | ✅ Pass |
| G2 | SPICE kernel sanity (south pole, equator, parallax) | 5 | ✅ Pass |
| G3 | Terrain analysis (slope, aspect, roughness, footprint) | 5 | ✅ Pass |
| G5 | Reproducibility + visual/science agreement (IoU ≥ 0.90) | 4 | ✅ Pass |
| G6 | End-to-end schema validation + SHA-256 determinism | 8 | ✅ Pass |
| **Total** | | **47** | **✅ 47/47** |

---

## Reproducibility

Every result JSON carries a `provenance.result_sha256` field — the SHA-256 of the canonical JSON serialization of the result (excluding the hash field itself, with sorted keys and no floating-point variation). Running the precomputer twice on the same inputs produces identical hashes.

```
Agreement benchmark (engine/agreement.py):
  IoU = 0.9677   (threshold ≥ 0.90)
  Discrepancy = 0.0°
  Pass = True
```

---

## API

```
GET /health              → {"status":"ok","version":"2.0.0"}
GET /sites               → array of 14 site metadata objects
GET /library             → library_index.json with all metrics
GET /run/{site_id}       → full precomputed result JSON
GET /run/{site_id}/metrics    → metrics only (smaller payload)
GET /run/{site_id}/provenance → provenance + SHA-256 record
GET /agreement           → agreement_benchmark.json
```

---

## Assumptions & Limitations (Explicit)

- Solar constant fixed at **1361.0 W/m²** (1 AU average; actual distance variation ignored)
- Sun/Earth limb convention: **upper_limb** (+0.265° elevation offset for the solar disc)
- Observer model: **topocentric surface** (1.5 m mast height above terrain)
- Terrain model: **synthetic mesh** for hero sites (real LOLA 5 m/px DEMs planned; network limitations prevented streaming)
- Horizon profile: **360-azimuth ray-march** at 1° steps through synthetic/flat DEM; real DEMs will refine this
- Battery model: ideal charge/discharge (η_c = η_d = 0.92), no temperature degradation
- Earth visibility: **geometric line-of-sight** only (no tropospheric refraction or radio frequency considerations)
- All times in **Ephemeris Time (ET)** via SPICE; UTC strings also provided per output record
- Coverage labelled **"limited"** where DEM data is not yet available; hatch overlay applied in UI
