# STELLARON UI Text and Plain-Language Results Audit

Comprehensive system-wide audit of user-facing scientific results copy, metric definitions, unit formatting, and telemetry semantics as mandated by Item A.

---

## 1. Audit Summary Matrix

| View / Location | Original Text / Issue | Plain-Language Fix | Rationale / Rule | Status |
|---|---|---|---|---|
| **TimelinePanel** | `(siteData?.refined_transitions?.length ?? 0)` rendered `0` | Changed to `siteData?.transitions?.length ?? 0` | Bug A.3.1 fix: actual key in JSON is `transitions` (4 events for Shackleton) | **FIXED** |
| **TimelinePanel** | Refined Transitions table was blank (`length > 0` condition failed) | Connected table to `siteData.transitions` displaying Event, UTC Time, and Precision | Table-tile agreement; user sees discrete sunrise/sunset events | **FIXED** |
| **TimelinePanel** | Stacked text blocks with unstyled bare words for metrics | Added `.metrics-grid` with `.metric-card` and `.metric-meaning` descriptions | Rule 2: Metric tiles with clear hierarchy and meaning lines | **FIXED** |
| **TimelinePanel** | No summary statement for members of the public | Added dynamic headline via `getTimelineHeadline()` (under 35 words) | Rule 1 & A.4: One headline sentence stating primary finding | **FIXED** |
| **TimelinePanel** | Technical concepts without context | Added "What does this mean?" disclosure with 3 plain bullets | Rule 3: Details on demand | **FIXED** |
| **EnergyPanel** | "Consumed 46.80 kWh" tile implies real consumption | Relabeled to "Energy Demanded" with meaning line: *"What the load would have needed if powered all period"* | A.3.2: Prevents false perception that unpowered systems consume energy | **FIXED** |
| **EnergyPanel** | Duplicate tiles: "Min SoC" and "Site Min SoC" | Removed duplicate tile; capped total tiles to 6 in a responsive grid | A.3.3 & Rule 2: Max 6 tiles per view, no duplicates | **FIXED** |
| **EnergyPanel** | Inconsistent duration formats: `706h 20m` vs `706.3h` | Unified under `formatDuration()`: `>=48h` shows `29 d 10 h`, tooltip shows exact hours | A.3.4 & Rule 5: Durations in human units | **FIXED** |
| **EnergyPanel** | 20% and 50% threshold labels clipped on right chart edge | Added 60px right margin and `position: insideRight` | A.3.5: Clean chart visuals without clipped text | **FIXED** |
| **EnergyPanel** | "Censored: yes" presented without explanation | Added glossary tooltip explaining study period ended before full recharge | A.3.7: Honest scientific limitation explanation | **FIXED** |
| **EnergyPanel** | Bare text lines and unstyled legend words | Added `.legend-item` chips and `.headline-box` with dynamic battery template | Rule 7 & A.4: Visual chips and plain English findings | **FIXED** |
| **ContextualSitePanel** | Acronym "Earth DTE" | Expanded to "Earth link (DTE)" | Rule 4: Plain label first, acronym in brackets | **FIXED** |
| **ContextualSitePanel** | Briefing copy: "Safety evaluation score is..." | Updated to "Modelled feasibility index is..." | Scientific honesty; no unwarranted safety claims | **FIXED** |
| **Central Copy** | Text strings scattered inside component JSX | Consolidated all copy, glossary, disclosures, and headlines in `src/copy/results.js` | Rule 10: Centralized copy module | **FIXED** |

---

## 2. Glossary of Plain-Language Terms

| Technical Term | Plain Label | Glossary Definition |
|---|---|---|
| **SoC** | Battery level (SoC) | Fraction of total battery capacity currently available for spacecraft operations. |
| **DTE** | Earth link (DTE) | Uninterrupted geometric line-of-sight radio link to Earth ground stations. |
| **Terminator** | Lunar Terminator | Moving boundary line dividing daylight from night on the lunar surface. |
| **Libration** | Lunar Libration | Apparent wobble of the Moon allowing direct visibility slightly past its mean limb. |
| **Deficit Interval** | Deficit Interval | A continuous interval where power demand exceeds generation and battery drops below reserve. |
| **Occultation** | Terrain Occultation | Intervening lunar terrain or planetary mass blocking line-of-sight to the Sun or Earth. |
| **Censored** | Truncated Interval | The battery was still empty when the study period ended, so the real duration may be longer. |

---

## 3. Headline Fill-In Templates (A.4)

### Battery Lab
1. **Never below reserve line (`min_soc >= 0.2`):**  
   `"Modelled battery stays above the {reserve}% reserve line for the full study period."`
2. **Dips below reserve line (`0.0 < min_soc < 0.2`):**  
   `"Modelled battery dips below the {reserve}% reserve line for {duration}, reaching a low of {min_soc}%."`
3. **Battery empties (`min_soc <= 0.001`):**  
   - If censored: `"Modelled battery runs out of energy for {duration}; study period ended before full recharge."`  
   - If recovered: `"Modelled battery runs out of energy for {duration} before recovering."`

### Illumination & Earth Timeline
- `"Sunlight is modelled for {sunPct}% of the period (longest dark interval {longestDark}), with direct Earth radio line-of-sight for {earthPct}% (longest blackout {longestBlackout})."`

---

## 4. Verification Check

- **Unit tests:** `tests/test_plain_language_results.py` (8/8 passing).
- **Frontend banned phrases:** `tests/test_frontend_claims.py` (passing, zero violations).
- **Full suite:** 150/150 passing across all modules.
