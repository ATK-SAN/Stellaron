# STELLARON Mission Rehearsal — System Limitations & Assumptions

## 1. Schematic Phase Trajectories

- **Non-Surface Phases**: Launch, translunar transit, lunar parking orbit, and deorbit descent are **schematic visualizations**. They are explicitly flagged in data and UI as:
  > *"Illustrative path, not a trajectory design."*
- STELLARON does not compute numerical orbital propagation, n-body gravitational perturbations, delta-v budgets, fuel mass consumption, or flight dynamics guidance for non-surface phases.

---

## 2. Ephemeris Coverage Bounds

- Ephemeris calculations are governed by NASA JPL kernel `de421.bsp` and high-precision lunar orientation PCK `moon_pa_de421_1900-2050.bpc`.
- Valid launch and mission timeframes are strictly bounded between **1900-01-01T00:00:00Z** and **2049-12-31T23:59:59Z**. Missions requested outside this coverage are rejected by schema validation.

---

## 3. Surface Physics Assumptions

- **Solar Upper Limb**: Solar illumination uses the standard +0.26° upper-limb elevation offset. Atmospheric refraction does not exist on the lunar surface.
- **Topography**: Local horizons are derived from LOLA 30m/pixel (polar) and LOLA/Kaguya merged DEMs resampled at 1° azimuth resolution. Sub-degree microtopography (boulders, craterlets < 30m) is not resolved.
- **Thermal Model**: Photovoltaic panel efficiency is treated as constant throughout the daylight cycle. Extreme lunar temperature variations (+120°C to -130°C) and resulting silicon bandgap shifts or thermal derating are not currently modeled.
- **Albedo & Regolith Scattering**: Regolith backscattering uses the Lommel-Seeliger law with empirical Hapke opposition parameters. Secondary terrain reflections from crater walls onto solar panels are not evaluated in the simplified 1D power model.

---

## 4. Probabilities & Risk Inputs

- **Zero Fabrication**: STELLARON never generates, infers, or predicts delay probabilities or scenario frequencies.
- Probability values exist only if explicitly supplied by the user in the input plan.
- All probability views are labeled:
  > *"Probabilities are conditional on your inputs. STELLARON does not estimate likelihood."*
