/**
 * schema_validation.js — Client-side mirror of rehearsal/schema_spec.json rules.
 * This must stay in sync with the Python backend (rehearsal/schema.py).
 * Returns { valid: bool, errors: { 'fieldPath': 'error message' } }
 */

const SITE_IDS = [
  'shackleton_connecting_ridge',
  'shackleton_peak',
  'de_gerlache_rim_1',
  'de_gerlache_rim_2',
  'connecting_ridge_ext',
  'malapert_mountain',
  'haworth_rim',
  'nobile_rim_1',
  'amundsen_rim',
  'faustini_rim_a',
  'apollo_11',
  'apollo_12',
  'apollo_17',
  'change_4',
]

const DELAY_TYPES = [
  'launch_slip',
  'transit_extension',
  'orbit_hold_extension',
  'landing_retry',
  'reduced_power',
  'comms_outage',
]

const SPICE_START = new Date('1900-01-01T00:00:00Z')
const SPICE_END = new Date('2049-12-31T23:59:59Z')

export function validateMissionPlan(form) {
  const errors = {}

  // Required strings
  if (!form.centre || String(form.centre).trim() === '')
    errors.centre = 'Space centre name is required.'
  if (!form.mission || String(form.mission).trim() === '')
    errors.mission = 'Mission name is required.'

  // launch_utc
  if (!form.launch_utc) {
    errors.launch_utc = 'Launch date and time (UTC) is required.'
  } else {
    const ld = new Date(form.launch_utc)
    if (isNaN(ld.getTime())) {
      errors.launch_utc = 'Invalid date/time format.'
    } else if (ld < SPICE_START || ld > SPICE_END) {
      errors.launch_utc = `Launch date must be within ephemeris coverage (1900-01-01 to 2049-12-31).`
    }
  }

  // transit_days
  const td = Number(form.transit_days)
  if (isNaN(td) || td < 1 || td > 40)
    errors.transit_days = 'Transit days must be between 1 and 40.'

  // orbit_hold_days
  const ohd = Number(form.orbit_hold_days ?? 0)
  if (isNaN(ohd) || ohd < 0 || ohd > 30)
    errors.orbit_hold_days = 'Orbit hold days must be between 0 and 30.'

  // landing_site_id
  if (!form.landing_site_id || !SITE_IDS.includes(form.landing_site_id))
    errors.landing_site_id = 'Please select a valid landing site.'

  // surface_days
  const sd = Number(form.surface_days)
  if (isNaN(sd) || sd < 1 || sd > 30)
    errors.surface_days = 'Surface days must be between 1 and 30.'

  // hardware
  const hw = form.hardware || {}
  const pm = Number(hw.panel_m2)
  if (isNaN(pm) || pm <= 0)
    errors['hardware.panel_m2'] = 'Panel area must be > 0 m².'
  const pe = Number(hw.panel_efficiency)
  if (isNaN(pe) || pe <= 0 || pe > 1)
    errors['hardware.panel_efficiency'] = 'Panel efficiency must be between 0 (exclusive) and 1.'
  const bwh = Number(hw.battery_wh)
  if (isNaN(bwh) || bwh <= 0)
    errors['hardware.battery_wh'] = 'Battery capacity must be > 0 Wh.'
  const bl = Number(hw.base_load_w)
  if (isNaN(bl) || bl < 0)
    errors['hardware.base_load_w'] = 'Base load must be ≥ 0 W.'
  const msf = Number(hw.min_soc_fraction ?? 0.2)
  if (isNaN(msf) || msf < 0 || msf > 1)
    errors['hardware.min_soc_fraction'] = 'Reserve SoC fraction must be between 0 and 1.'

  // constraints (optional)
  const con = form.constraints || {}
  if (con.max_earth_blackout_h !== undefined && con.max_earth_blackout_h !== '') {
    const meb = Number(con.max_earth_blackout_h)
    if (isNaN(meb) || meb <= 0)
      errors['constraints.max_earth_blackout_h'] = 'Max Earth blackout must be > 0 hours.'
  }
  if (con.min_sunlit_fraction !== undefined && con.min_sunlit_fraction !== '') {
    const msf2 = Number(con.min_sunlit_fraction)
    if (isNaN(msf2) || msf2 < 0 || msf2 > 1)
      errors['constraints.min_sunlit_fraction'] = 'Min sunlit fraction must be between 0 and 1.'
  }

  // delay_scenarios
  const scenarios = form.delay_scenarios || []
  if (scenarios.length > 8)
    errors.delay_scenarios = 'Maximum 8 delay scenarios allowed.'

  let totalProb = 0
  let hasProb = false
  scenarios.forEach((s, i) => {
    const prefix = `delay_scenarios[${i}]`
    if (!DELAY_TYPES.includes(s.type))
      errors[`${prefix}.type`] = 'Please select a valid scenario type.'
    if (['launch_slip', 'transit_extension', 'orbit_hold_extension', 'landing_retry'].includes(s.type)) {
      const days = Number(s.days)
      if (isNaN(days) || days < 0)
        errors[`${prefix}.days`] = 'Days must be ≥ 0.'
    }
    if (s.type === 'reduced_power') {
      const pf = Number(s.power_factor)
      if (isNaN(pf) || pf < 0 || pf > 1)
        errors[`${prefix}.power_factor`] = 'Power factor must be between 0 and 1.'
    }
    if (s.type === 'comms_outage') {
      if (!s.outage_start_utc)
        errors[`${prefix}.outage_start_utc`] = 'Outage start time (UTC) is required.'
      const oh = Number(s.outage_hours)
      if (isNaN(oh) || oh < 0)
        errors[`${prefix}.outage_hours`] = 'Outage hours must be ≥ 0.'
    }
    if (s.probability !== undefined && s.probability !== '') {
      const p = Number(s.probability)
      if (isNaN(p) || p < 0 || p > 1)
        errors[`${prefix}.probability`] = 'Probability must be between 0 and 1.'
      else {
        totalProb += p
        hasProb = true
      }
    }
  })
  if (hasProb && totalProb > 1 + 1e-6)
    errors['delay_scenarios_probability'] = `Probabilities sum to ${totalProb.toFixed(3)}, which exceeds 1.0. Reduce or remove some probability values.`

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    probability_total: hasProb ? totalProb : null,
    unspecified_remainder: hasProb ? Math.max(0, 1 - totalProb) : null,
  }
}

export function planToJSON(form) {
  const plan = {
    schema_version: 1,
    centre: String(form.centre || '').trim(),
    mission: String(form.mission || '').trim(),
    launch_utc: form.launch_utc || '',
    transit_days: Number(form.transit_days),
    orbit_hold_days: Number(form.orbit_hold_days ?? 0),
    landing_site_id: form.landing_site_id || '',
    surface_days: Number(form.surface_days),
    hardware: {
      panel_m2: Number(form.hardware?.panel_m2 ?? 2.5),
      panel_efficiency: Number(form.hardware?.panel_efficiency ?? 0.28),
      battery_wh: Number(form.hardware?.battery_wh ?? 1200),
      base_load_w: Number(form.hardware?.base_load_w ?? 65),
      min_soc_fraction: Number(form.hardware?.min_soc_fraction ?? 0.20),
    },
  }

  const con = form.constraints || {}
  const cOut = {}
  if (con.max_earth_blackout_h !== '' && con.max_earth_blackout_h !== undefined)
    cOut.max_earth_blackout_h = Number(con.max_earth_blackout_h)
  if (con.min_sunlit_fraction !== '' && con.min_sunlit_fraction !== undefined)
    cOut.min_sunlit_fraction = Number(con.min_sunlit_fraction)
  if (Object.keys(cOut).length > 0) plan.constraints = cOut

  const scenarios = (form.delay_scenarios || []).map(s => {
    const sc = { type: s.type }
    if (s.days !== undefined && s.days !== '') sc.days = Number(s.days)
    if (s.power_factor !== undefined && s.power_factor !== '') sc.power_factor = Number(s.power_factor)
    if (s.outage_start_utc) sc.outage_start_utc = s.outage_start_utc
    if (s.outage_hours !== undefined && s.outage_hours !== '') sc.outage_hours = Number(s.outage_hours)
    if (s.probability !== undefined && s.probability !== '') sc.probability = Number(s.probability)
    return sc
  })
  if (scenarios.length > 0) plan.delay_scenarios = scenarios

  return plan
}

export { SITE_IDS, DELAY_TYPES }
