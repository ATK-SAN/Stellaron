# STELLARON Mission Rehearsal — Mathematical & Scientific Methods

## 1. Overview

The **Mission Rehearsal** layer enables space mission design teams to upload or interactively configure a lunar surface mission plan and evaluate operational margins under schedule perturbations.

All physical calculations are strictly performed by the deterministic Python scientific engine (`engine` and `rehearsal`), utilizing NASA JPL SPICE ephemerides and LOLA topographic data. The browser interface renders precomputed JSON artifacts and never approximates celestial physics.

---

## 2. Mission Timeline Model (`rehearsal.timeline`)

Given baseline schedule inputs and scenario delay parameters:
- `launch_t = launch_utc + slip_launch`
- `orbit_arrival_t = launch_t + transit_days + extension_transit`
- `descent_t = orbit_arrival_t + orbit_hold_days + extension_hold`
- `landing_t = descent_t + nominal_descent + retry_days`
- `surface_end_t = landing_t + surface_days`

Phases are strictly contiguous:
$$\text{PRELAUNCH\_HOLD} \longrightarrow \text{TRANSIT} \longrightarrow \text{LUNAR\_ORBIT} \longrightarrow \text{DESCENT} \longrightarrow \text{SURFACE}$$

A scenario with zero delays reproduces the baseline timeline identically.

---

## 3. Surface Physics Evaluation (`rehearsal.surface`)

The surface phase stay is simulated using real celestial mechanics:
1. **Ephemeris Computation**: Observer positions on the lunar triaxial ellipsoid (`MOON_ME` / `IAU_MOON`) evaluated via `de421.bsp` and `moon_pa_de421_1900-2050.bpc`.
2. **Line-of-Sight Visibility**:
   - **Sun**: Apparent solar elevation $h_\odot$ adjusted for the solar upper limb semi-diameter convention (+0.26°):
     $$\text{visible}_\odot \iff h_\odot + 0.26^\circ > H_\text{terrain}(\text{az}_\odot)$$
   - **Earth**: Radio geometric visibility checked against the 360° terrain horizon silhouette:
     $$\text{visible}_\oplus \iff h_\oplus > H_\text{terrain}(\text{az}_\oplus)$$
3. **Power & Battery Simulation**:
   - Photovoltaic generation: $P_\text{gen}(t) = \max(0, I_\text{solar} \cdot A_\text{panel} \cdot \eta \cdot \cos(\theta_\text{incidence}))$.
   - Battery state-of-charge integration with charge efficiency $\eta_c = 0.92$, discharge efficiency $\eta_d = 0.92$, and configurable minimum reserve threshold $SoC_\text{reserve}$ (default 20%).

### Verdict Determination
- **`fails`**: Minimum SoC drops below reserve threshold ($SoC < SoC_\text{reserve}$) OR user constraints violated (e.g. Earth blackout $> \text{limit}$).
- **`marginal`**: Operating within safety margin of any limit:
  - $SoC_\text{reserve} \le SoC < SoC_\text{reserve} + 0.10$
  - Blackout duration within 10% of constraint limit
  - Sunlit fraction within 5 percentage points of constraint threshold
- **`survives`**: All parameters strictly above safety margins throughout the entire surface stay.

---

## 4. Slip Calendar Sweep (`rehearsal.slip`)

The landing date is swept over $[-D_\text{back}, +D_\text{forward}]$ (default: $-5$ to $+60$ days, up to $120$ days) in 1-day steps.
- **Tolerance Days Forward**: Number of consecutive non-failing days starting from baseline.
- **First Failing Date**: The earliest forward landing date resulting in a `fails` verdict.
- **Next Pass Window**: The first date following a failure where conditions return to `survives`.

---

## 5. Decision Gates (`rehearsal.gates`)

Four operational milestones are evaluated:
1. `PRE_LAUNCH`: $t = \text{launch\_t}$
2. `POST_LAUNCH`: $t = \text{launch\_t} + \text{transit\_days}$
3. `LUNAR_ORBIT_ARRIVAL`: $t = \text{orbit\_arrival\_t}$
4. `PRE_DESCENT`: $t = \text{descent\_t}$

Each gate outputs:
- Accumulated delay so far ($\Delta t_\text{slip}$)
- Remaining tolerance days before surface operations fail
- First failing landing timestamp

---

## 6. Neutral Language Policy & Provenance

In accordance with scientific integrity standards:
- Language is strictly descriptive: results are labelled **"modelled"** and **"conditional on your inputs"**.
- Value judgments such as "recommended", "best", "optimal", "predicted", or "guaranteed" are strictly excluded from all outputs.
- Every run carries a cryptographic SHA-256 hash computed deterministically from the canonical result structure.
