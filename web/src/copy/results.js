/** results.js — Centralized UI text, headlines, and unit formatters for scientific results.
 *
 * Rules:
 * - Single source of truth for all results copy.
 * - Headline templates with named slots, strictly under 35 words.
 * - Meaning lines strictly 12 words or fewer.
 * - Details-on-demand bullets strictly 3 bullets of ~15 words.
 * - Durations formatted in human units: >=48h shows 'X d Y h', <48h shows 'Xh Ym'.
 * - No unverified certainty claims. Always use 'modelled'.
 */

export const GLOSSARY = {
  soc: {
    term: 'SoC',
    full: 'State of Charge',
    definition: 'Fraction of total battery capacity currently available for spacecraft operations.',
  },
  dte: {
    term: 'DTE',
    full: 'Direct-to-Earth',
    definition: 'Uninterrupted geometric line-of-sight radio link to Earth ground stations.',
  },
  terminator: {
    term: 'Terminator',
    full: 'Lunar Terminator',
    definition: 'Moving boundary line dividing daylight from night on the lunar surface.',
  },
  libration: {
    term: 'Libration',
    full: 'Lunar Libration',
    definition: 'Apparent wobble of the Moon allowing direct visibility slightly past its mean limb.',
  },
  deficit_interval: {
    term: 'Deficit Interval',
    full: 'Power Deficit Interval',
    definition: 'A continuous interval where power demand exceeds generation and battery drops below reserve.',
  },
  occultation: {
    term: 'Occultation',
    full: 'Terrain Occultation',
    definition: 'Intervening lunar terrain or planetary mass blocking line-of-sight to the Sun or Earth.',
  },
  censored: {
    term: 'Censored',
    full: 'Interval Censoring',
    definition: 'The battery was still empty when the study period ended, so the real duration may be longer.',
  },
}

export const DETAILS_DISCLOSURE = {
  battery: [
    'Solar generation is modelled from topocentric solar elevation and 2.5 m² array orientation.',
    'A constant 65 W baseline electrical load is demanded across the 30-day lunar study.',
    'Deficit intervals occur when darkness causes battery storage to deplete below the 20% reserve line.',
  ],
  timeline: [
    'Solar illumination accounts for LOLA topographic horizon masks and sub-solar latitude.',
    'Earth link accounts for topographic horizon masks and topocentric libration angles.',
    'Transitions mark discrete geometric boundary events (sunrises, sunsets, LOS acquisitions).',
  ],
}

export const MEANING_LINES = {
  generated: 'Total modelled solar energy captured by the 2.5 m² array.',
  demanded: 'What the load would have needed if powered all period.',
  minSoc: 'Lowest battery state of charge reached during the study.',
  belowReserve: 'Cumulative duration spent below the 20% reserve line.',
  netEnergy: 'Difference between total energy generated and demanded.',
  peakPower: 'Peak instantaneous solar power modelled at local solar noon.',
  deficitEvents: 'Discrete periods where stored energy fell below reserve.',
  sunVisible: 'Fraction of study interval with direct line-of-sight to Sun.',
  earthVisible: 'Direct line-of-sight radio link to Earth ground stations.',
  longestDarkness: 'Longest continuous period with solar disc completely occluded.',
  earthBlackout: 'Longest continuous interval without line-of-sight to Earth.',
  maxSolarElev: 'Peak apparent elevation angle of the Sun above the local horizon.',
  transitions: 'Discrete sunrise, sunset, or comms acquisition boundary events.',
}

/** Format seconds into human units: >=48h shows 'X d Y h', <48h shows 'Xh Ym' */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  const totalH = s / 3600

  if (totalH >= 48) {
    const days = Math.floor(s / 86400)
    const hours = Math.floor((s % 86400) / 3600)
    return `${days} d ${hours} h`
  }

  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

/** Formatter helper when hours are given directly */
export function formatDurationFromHours(hours) {
  if (hours == null || isNaN(hours)) return '—'
  return formatDuration(hours * 3600)
}

/** Tooltip text giving exact hours for durations */
export function formatHoursTooltip(seconds) {
  if (seconds == null || isNaN(seconds)) return ''
  const h = seconds / 3600
  return `${h.toFixed(1)} hours (${seconds.toLocaleString()} s)`
}

/** Format watt-hours to kWh or Wh */
export function formatWh(wh) {
  if (wh == null || isNaN(wh)) return '—'
  if (Math.abs(wh) >= 1000) {
    return `${(wh / 1000).toFixed(2)} kWh`
  }
  return `${wh.toFixed(1)} Wh`
}

/** Format percentage */
export function formatPct(frac) {
  if (frac == null || isNaN(frac)) return '—'
  return `${(frac * 100).toFixed(1)}%`
}

/** Battery Lab headline template (A.4) */
export function getBatteryHeadline({ minSoc, reserveFrac = 0.2, timeBelowReserveS = 0, isCensored = false }) {
  const reservePct = Math.round(reserveFrac * 100)
  const minSocPct = minSoc != null ? (minSoc * 100).toFixed(1) : '0.0'
  const duration = formatDuration(timeBelowReserveS)

  // Case 1: battery never below reserve line
  if (minSoc != null && minSoc >= reserveFrac) {
    return `Modelled battery stays above the ${reservePct}% reserve line for the full study period.`
  }

  // Case 3: battery empties (minSoc hit 0%)
  if (minSoc != null && minSoc <= 0.001) {
    if (isCensored) {
      return `Modelled battery runs out of energy for ${duration}; study period ended before full recharge.`
    }
    return `Modelled battery runs out of energy for ${duration} before recovering.`
  }

  // Case 2: battery dips below reserve line but doesn't hit 0%
  return `Modelled battery dips below the ${reservePct}% reserve line for ${duration}, reaching a low of ${minSocPct}%.`
}

/** Illumination & Earth Timeline headline template (A.4) */
export function getTimelineHeadline({ sunPct = 0, longestDarkH = 0, earthPct = 0, longestBlackoutH = 0 }) {
  const sunStr = typeof sunPct === 'number' ? sunPct.toFixed(1) : sunPct
  const earthStr = typeof earthPct === 'number' ? earthPct.toFixed(1) : earthPct
  const longestDark = formatDurationFromHours(longestDarkH)
  const longestBlackout = formatDurationFromHours(longestBlackoutH)

  return `Sunlight is modelled for ${sunStr}% of the period (longest dark interval ${longestDark}), with direct Earth radio line-of-sight for ${earthStr}% (longest blackout ${longestBlackout}).`
}
