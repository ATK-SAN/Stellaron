# STELLARON Project Status Tracker

**Current Date / Milestone:** November 15, 2026 — UX Fixes Round 2 (Items 0.2, B, F, E, D, A, C)  
**Total Automated Tests:** **154 Passing** (0 failing, 0 regressions)  
**Repository State:** Clean (`main` branch)  

---

## 1. UX Fixes Round 2 Implementation Progress

| Item | Title | Specification Summary | Status | Key Commits / Changes |
|---|---|---|---|---|
| **0.2** | Metric Tile & Legend CSS Restoration | Restored missing `.metrics-grid`, `.metric-card`, `.legend-item`, `.legend-dot`, `.empty-state` classes. | **COMPLETE** | `1407c7e` (`web/src/index.css`) |
| **B** | No Default Selection & Empty States | App starts with no site selected; clicking selected deselects; `Escape` deselects; deep link `?site=<id>`; empty state in all workspaces. | **COMPLETE** | `1407c7e` (`App.jsx`, `ContextualSitePanel.jsx`, 7 unit tests in `test_site_selection_flow.py`) |
| **F** | Zoom-to-Site Camera Normal Alignment | Fixed 29–37° camera pointing error by aligning camera standoff strictly along surface normal vector ($spNorm \times 1.48$). Error: **0.00°** across all 14 sites. | **COMPLETE** | `9c1dcd7` (`CelestialSimulator.jsx`, 2 unit tests in `test_zoom_to_site_alignment.py`) |
| **E** | Constant-Size 3D Labels & Occlusion | CSS2D-style fixed 11px font screen size via `@react-three/drei` `Html` with `occlude`. Removed scaling distortion on zoom. | **COMPLETE** | `28be140` (`HorizonGlobe.jsx`, `TerrainViewer.jsx`) |
| **D** | Site Labels Toggle Button | Added "Labels" button to globe toolbar with `Tag` icon, keyboard shortcut `L`, `localStorage` persistence, hero filtering. | **COMPLETE** | `28be140` (`HorizonGlobe.jsx`, 5 unit tests in `test_label_scaling_and_toggle.py`) |
| **A** | Plain-Language Results & Data Bug Fixes | Centralized copy in `src/copy/results.js`. Fixed Bug A.3.1 ("Transitions: 0" -> 4). Relabeled "Consumed" to "Energy Demanded". Removed duplicate SoC tile. Unified durations (`formatDuration`). Unclipped chart thresholds. | **COMPLETE** | `8fb8074` (`copy/results.js`, `TimelinePanel.jsx`, `EnergyPanel.jsx`, `ContextualSitePanel.jsx`, `ui-text-audit.md`, 8 unit tests in `test_plain_language_results.py`) |
| **C** | Home Page CTA & Step Images | Exactly one "Launch Navigator" button on Intro (hero only). Removed duplicates from top nav and footer. Converted user screenshots to WebP with JPG fallbacks for the 3 "How it works" steps. | **COMPLETE** | `918bcab` (`IntroPage.jsx`, `IntroPage.module.css`, images in `web/public/intro/`, 4 unit tests in `test_intro_cta_and_images.py`) |
| **G** | 2027 Epoch Evaluation Gate | Kernel coverage and SPICE validation for 2027 window. Gated on user providing `tests/reference/horizons_2027.json` and start date. | **GATED** | Standing by for reference file & start date. |

---

## 2. Test Suite Evolution

- **Pre-UX Baseline:** 128 tests
- **After Item B (Selection Flow):** 135 tests (+7)
- **After Item F (Zoom Alignment):** 137 tests (+2)
- **After Items E & D (Labels Toggle & Occlusion):** 142 tests (+5)
- **After Item A (Plain-Language Results):** 150 tests (+8)
- **After Item C (Intro CTA & Images):** 154 tests (+4)
- **Current Total:** **154 passed in 4.9s**

---

## 3. Architecture & Verification Summary

1. **Central Copy Module (`web/src/copy/results.js`):**
   - Single source of truth for headline templates, duration formatting, metric definitions, and glossary tooltips.
   - Zero hard-coded sentences in components.
   - Zero banned certainty words ("safe", "will survive", "guaranteed").

2. **Data Bug Fixes:**
   - **Transitions Count:** Corrected key lookup to `siteData.transitions` (yielding 4 sunrise/sunset events for Shackleton).
   - **Duration Formatter:** Formats $\ge 48\text{ h}$ as `"X d Y h"` (e.g. `29 d 10 h` for 2,542,800 s) with exact hours in the title tooltip.
   - **Chart Margin:** Threshold lines repositioned `insideRight` with 60px right padding to eliminate text truncation.
   - **Energy Demanded:** Clarified load demand semantics so users understand unpowered periods do not consume battery energy.

3. **Production Build:**
   - Modules transformed: 3,115
   - Chunks generated cleanly with zero errors in ~27 seconds.
