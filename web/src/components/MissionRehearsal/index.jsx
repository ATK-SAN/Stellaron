/** MissionRehearsal/index.jsx — Full Mission Rehearsal UI for STELLARON
 *
 * Features:
 * - Tabbed interface: Form | Results | Compare
 * - Live form validation (mirrors rehearsal/schema_spec.json)
 * - JSON upload/download/demo presets
 * - Slip calendar grid, decision gates timeline, verdict badge
 * - No physics in the browser — results come from precomputed JSON
 */

import { useState, useCallback, useRef } from 'react'
import { validateMissionPlan, planToJSON, SITE_IDS, DELAY_TYPES } from './schema_validation'
import VerdictBadge from './VerdictBadge'
import SlipCalendarGrid from './SlipCalendarGrid'
import DecisionGatesTimeline from './DecisionGatesTimeline'
import ChoreographyPlayer from './ChoreographyPlayer'
import CompareView from './CompareView'

// ─── Site display names ───────────────────────────────────────────────────────
const SITE_NAMES = {
  shackleton_connecting_ridge: 'Shackleton Connecting Ridge',
  shackleton_peak: 'Shackleton Peak',
  de_gerlache_rim_1: 'de Gerlache Rim 1',
  de_gerlache_rim_2: 'de Gerlache Rim 2',
  connecting_ridge_ext: 'Connecting Ridge Extension',
  malapert_mountain: 'Malapert Mountain',
  haworth_rim: 'Haworth Rim',
  nobile_rim_1: 'Nobile Rim 1',
  amundsen_rim: 'Amundsen Rim',
  faustini_rim_a: 'Faustini Rim A',
  apollo_11: 'Apollo 11 (Mare Tranquillitatis)',
  apollo_12: 'Apollo 12 (Oceanus Procellarum)',
  apollo_17: 'Apollo 17 (Taurus-Littrow)',
  change_4: "Chang'e 4 (Von Kármán)",
}

const DELAY_TYPE_LABELS = {
  launch_slip: 'Launch Slip',
  transit_extension: 'Transit Extension',
  orbit_hold_extension: 'Orbit Hold Extension',
  landing_retry: 'Landing Retry',
  reduced_power: 'Reduced Power',
  comms_outage: 'Comms Outage',
}

// ─── Default form state ───────────────────────────────────────────────────────
const DEFAULT_FORM = {
  centre: '',
  mission: '',
  launch_utc: '2026-04-01T00:00',
  transit_days: 4,
  orbit_hold_days: 1,
  landing_site_id: 'shackleton_connecting_ridge',
  surface_days: 14,
  hardware: {
    panel_m2: 2.5,
    panel_efficiency: 0.28,
    battery_wh: 1200,
    base_load_w: 65,
    min_soc_fraction: 0.20,
  },
  constraints: {
    max_earth_blackout_h: '',
    min_sunlit_fraction: '',
  },
  delay_scenarios: [],
}

// ─── Demo presets ──────────────────────────────────────────────────────────────
const DEMO_PRESETS = {
  A: {
    label: 'Demo Scenario A',
    desc: 'Shackleton Ridge · 14-day surface · default hardware',
    form: {
      centre: 'Demo Agency Alpha',
      mission: 'DEMO-LUNAR-A',
      launch_utc: '2026-04-01T00:00',
      transit_days: 4,
      orbit_hold_days: 1,
      landing_site_id: 'shackleton_connecting_ridge',
      surface_days: 14,
      hardware: { panel_m2: 2.5, panel_efficiency: 0.28, battery_wh: 1200, base_load_w: 65, min_soc_fraction: 0.20 },
      constraints: { max_earth_blackout_h: '', min_sunlit_fraction: '' },
      delay_scenarios: [],
    },
  },
  B: {
    label: 'Demo Scenario B',
    desc: 'Malapert Mountain · reduced power scenario',
    form: {
      centre: 'Demo Agency Beta',
      mission: 'DEMO-LUNAR-B',
      launch_utc: '2026-04-15T00:00',
      transit_days: 5,
      orbit_hold_days: 2,
      landing_site_id: 'malapert_mountain',
      surface_days: 10,
      hardware: { panel_m2: 2.5, panel_efficiency: 0.28, battery_wh: 1200, base_load_w: 65, min_soc_fraction: 0.20 },
      constraints: { max_earth_blackout_h: '', min_sunlit_fraction: '' },
      delay_scenarios: [{ type: 'reduced_power', power_factor: 0.7 }],
    },
  },
  C: {
    label: 'Demo Scenario C',
    desc: 'Nobile Rim 1 · launch slip scenario',
    form: {
      centre: 'Demo Agency Gamma',
      mission: 'DEMO-LUNAR-C',
      launch_utc: '2026-05-01T00:00',
      transit_days: 3,
      orbit_hold_days: 0,
      landing_site_id: 'nobile_rim_1',
      surface_days: 7,
      hardware: { panel_m2: 2.5, panel_efficiency: 0.28, battery_wh: 1200, base_load_w: 65, min_soc_fraction: 0.20 },
      constraints: { max_earth_blackout_h: '', min_sunlit_fraction: '' },
      delay_scenarios: [{ type: 'launch_slip', days: 3 }],
    },
  },
}

// ─── Precomputed mock results (Demo A) ────────────────────────────────────────
function buildMockCalendarCells() {
  const cells = []
  for (let off = -5; off <= 14; off++) {
    const date = new Date('2026-04-06T00:00:00Z')
    date.setDate(date.getDate() + off)
    const dateStr = date.toISOString().slice(0, 10) + 'T00:00:00Z'
    let verdict, minSoc, lf
    if (off >= 12) { verdict = 'fails'; minSoc = 0.14; lf = 'battery_reserve' }
    else if (off >= 10) { verdict = 'marginal'; minSoc = 0.24; lf = 'battery_reserve' }
    else { verdict = 'survives'; minSoc = 0.55 + Math.sin(off * 0.4) * 0.1; lf = 'none' }
    cells.push({ offset_days: off, date_utc: dateStr, verdict, min_soc: minSoc, sunlit_hours: 240 + off * 2, blackout_hours: 8, limiting_factor: lf })
  }
  return cells
}

const MOCK_RESULTS = {
  A: {
    status: 'complete',
    verdict: 'survives',
    limiting_factor: 'none',
    result_sha256: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    baseline: {
      surface: {
        metrics: {
          minimum_soc: 0.55,
          sunlit_hours: 288,
          longest_earth_blackout_h: 18.5,
          sunlit_fraction: 0.84,
          earth_visible_hours: 220,
          time_below_reserve_h: 0,
        }
      }
    },
    slip_calendar: {
      baseline_landing_utc: '2026-04-06T00:00:00Z',
      tolerance_days_forward: 9,
      first_failing_offset_days: 10,
      first_failing_landing_utc: '2026-04-16T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: buildMockCalendarCells(),
    },
    decision_gates: [
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-04-01T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-16T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-04-05T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-16T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-04-05T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-16T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-04-06T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-16T00:00:00Z' },
    ],
    comparison: null,
    probability_view: null,
    provenance: {
      ephemeris_kernel: 'de421.bsp',
      model_note: 'Modelled surface conditions; schematic transit phases. Illustrative path, not a trajectory design.',
      thresholds_used: { min_soc_fraction: 0.20, max_earth_blackout_h: null, min_sunlit_fraction: null },
    },
  },
  B: {
    status: 'complete',
    verdict: 'marginal',
    limiting_factor: 'battery_reserve',
    result_sha256: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
    baseline: {
      surface: {
        metrics: { minimum_soc: 0.26, sunlit_hours: 190, longest_earth_blackout_h: 24, sunlit_fraction: 0.76, earth_visible_hours: 180, time_below_reserve_h: 0 }
      }
    },
    slip_calendar: {
      baseline_landing_utc: '2026-04-22T00:00:00Z',
      tolerance_days_forward: 3,
      first_failing_offset_days: 4,
      first_failing_landing_utc: '2026-04-26T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: (() => {
        const cells = []
        for (let off = -5; off <= 14; off++) {
          const d = new Date('2026-04-22T00:00:00Z'); d.setDate(d.getDate() + off)
          let verdict, soc, lf
          if (off >= 4) { verdict = 'fails'; soc = 0.12; lf = 'battery_reserve' }
          else if (off >= 2) { verdict = 'marginal'; soc = 0.24; lf = 'battery_reserve' }
          else { verdict = off < 0 ? 'survives' : 'marginal'; soc = 0.26 + (off < 0 ? 0.1 : 0); lf = off < 0 ? 'none' : 'battery_reserve' }
          cells.push({ offset_days: off, date_utc: d.toISOString().slice(0,10)+'T00:00:00Z', verdict, min_soc: soc, sunlit_hours: 190, blackout_hours: 24, limiting_factor: lf })
        }
        return cells
      })(),
    },
    decision_gates: [
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-04-15T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-26T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-04-20T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-26T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-04-20T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-26T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-04-22T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-26T00:00:00Z' },
    ],
    comparison: null,
    probability_view: null,
    provenance: {
      ephemeris_kernel: 'de421.bsp',
      model_note: 'Modelled surface conditions; schematic transit phases. Illustrative path, not a trajectory design.',
      thresholds_used: { min_soc_fraction: 0.20, max_earth_blackout_h: null, min_sunlit_fraction: null },
    },
  },
  C: {
    status: 'complete',
    verdict: 'survives',
    limiting_factor: 'none',
    result_sha256: 'c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
    baseline: {
      surface: {
        metrics: { minimum_soc: 0.44, sunlit_hours: 150, longest_earth_blackout_h: 12, sunlit_fraction: 0.89, earth_visible_hours: 140, time_below_reserve_h: 0 }
      }
    },
    slip_calendar: {
      baseline_landing_utc: '2026-05-04T00:00:00Z',
      tolerance_days_forward: 7,
      first_failing_offset_days: 8,
      first_failing_landing_utc: '2026-05-12T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: (() => {
        const cells = []
        for (let off = -5; off <= 14; off++) {
          const d = new Date('2026-05-04T00:00:00Z'); d.setDate(d.getDate() + off)
          let verdict, soc, lf
          if (off >= 8) { verdict = 'fails'; soc = 0.11; lf = 'battery_reserve' }
          else { verdict = 'survives'; soc = 0.5; lf = 'none' }
          cells.push({ offset_days: off, date_utc: d.toISOString().slice(0,10)+'T00:00:00Z', verdict, min_soc: soc, sunlit_hours: 150, blackout_hours: 12, limiting_factor: lf })
        }
        return cells
      })(),
    },
    decision_gates: [
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-05-01T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-12T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-05-04T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-12T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-05-04T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-12T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-05-04T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-12T00:00:00Z' },
    ],
    comparison: null,
    probability_view: null,
    provenance: {
      ephemeris_kernel: 'de421.bsp',
      model_note: 'Modelled surface conditions; schematic transit phases. Illustrative path, not a trajectory design.',
      thresholds_used: { min_soc_fraction: 0.20, max_earth_blackout_h: null, min_sunlit_fraction: null },
    },
  },
}

// ─── Input component helpers ──────────────────────────────────────────────────
const inputStyle = {
  background: 'rgba(5,7,17,0.8)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f1f5f9',
  borderRadius: '5px',
  padding: '7px 10px',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-ui)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const inputErrorStyle = {
  ...inputStyle,
  border: '1px solid rgba(248,113,113,0.6)',
}

const labelStyle = {
  fontSize: '0.70rem',
  color: '#94a3b8',
  fontWeight: 600,
  display: 'block',
  marginBottom: '3px',
}

function FieldRow({ id, label, unit, hint, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <label htmlFor={id} style={labelStyle}>
        {label} {unit && <span style={{ color: '#475569', fontWeight: 400 }}>({unit})</span>}
        {hint && <span style={{ color: '#475569', marginLeft: '6px', fontWeight: 400, fontSize: '0.62rem' }}>{hint}</span>}
      </label>
      {children}
      {error && (
        <div role="alert" aria-live="polite" style={{ fontSize: '0.66rem', color: '#f87171', marginTop: '2px' }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div style={{
      fontSize: '0.60rem',
      color: '#64748b',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingBottom: '6px',
      marginBottom: '2px',
    }}>
      {title}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MissionRehearsal() {
  const [tab, setTab] = useState('form')
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [validation, setValidation] = useState({ valid: false, errors: {} })
  const [result, setResult] = useState(null)
  const [activeDemo, setActiveDemo] = useState(null)
  const [qualityTier, setQualityTier] = useState('High')
  const fileInputRef = useRef(null)

  // Live validation on every change
  const updateForm = useCallback((updater) => {
    setForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const v = validateMissionPlan({ ...next, launch_utc: next.launch_utc + ':00Z' })
      setValidation(v)
      return next
    })
  }, [])

  const setField = (path, value) => {
    updateForm(prev => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...prev, [path]: value }
      if (parts.length === 2) return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } }
      return prev
    })
  }

  const handleRunDemo = (key) => {
    const preset = DEMO_PRESETS[key]
    if (!preset) return
    setForm({ ...preset.form })
    setValidation(validateMissionPlan({ ...preset.form, launch_utc: preset.form.launch_utc + ':00Z' }))
    setResult(MOCK_RESULTS[key])
    setActiveDemo(key)
    setTab('results')
  }

  const handleRunRehearsal = () => {
    // No backend wired — show static-only note (result stays null)
    setResult({ status: 'no_backend' })
    setTab('results')
  }

  const handleReset = () => {
    setForm({ ...DEFAULT_FORM })
    setValidation({ valid: false, errors: {} })
    setResult(null)
    setActiveDemo(null)
    setTab('form')
  }

  const handleDownloadJSON = () => {
    const plan = planToJSON({ ...form, launch_utc: form.launch_utc + ':00Z' })
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.mission || 'mission'}_rehearsal.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadJSON = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 1048576) { alert('File too large (max 1 MB).'); return }
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result)
        const newForm = {
          centre: parsed.centre || '',
          mission: parsed.mission || '',
          launch_utc: (parsed.launch_utc || '').replace('Z', '').replace(/:\d\dZ?$/, ''),
          transit_days: parsed.transit_days || 4,
          orbit_hold_days: parsed.orbit_hold_days ?? 1,
          landing_site_id: parsed.landing_site_id || 'shackleton_connecting_ridge',
          surface_days: parsed.surface_days || 14,
          hardware: { ...DEFAULT_FORM.hardware, ...(parsed.hardware || {}) },
          constraints: {
            max_earth_blackout_h: parsed.constraints?.max_earth_blackout_h ?? '',
            min_sunlit_fraction: parsed.constraints?.min_sunlit_fraction ?? '',
          },
          delay_scenarios: (parsed.delay_scenarios || []).map(s => ({ ...s })),
        }
        setForm(newForm)
        const v = validateMissionPlan({ ...newForm, launch_utc: newForm.launch_utc + ':00Z' })
        setValidation(v)
        setActiveDemo(null)
        setResult(null)
        setTab('form')
      } catch {
        alert('Invalid JSON file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const addScenario = () => {
    if (form.delay_scenarios.length >= 8) return
    updateForm(prev => ({
      ...prev,
      delay_scenarios: [...prev.delay_scenarios, { type: 'launch_slip', days: 1 }]
    }))
  }

  const removeScenario = (i) => {
    updateForm(prev => ({
      ...prev,
      delay_scenarios: prev.delay_scenarios.filter((_, idx) => idx !== i)
    }))
  }

  const updateScenario = (i, field, value) => {
    updateForm(prev => {
      const sc = [...prev.delay_scenarios]
      sc[i] = { ...sc[i], [field]: value }
      return { ...prev, delay_scenarios: sc }
    })
  }

  const { valid, errors, probability_total, unspecified_remainder } = validation
  const hasProb = probability_total != null

  // ─── Tab buttons ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'form', label: '📋 Mission Input' },
    { id: 'results', label: '📊 Results', disabled: !result },
    { id: 'compare', label: '⚖ Scenario Compare' },
    { id: 'playback', label: '🚀 3D Flight Playback' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 18px',
        background: '#070a18',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
            🛸 Mission Rehearsal
          </div>
          <div style={{ fontSize: '0.66rem', color: '#64748b' }}>
            Upload a mission plan or fill the form · results are modelled, conditional on your inputs
          </div>
        </div>
        {/* Demo preset buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.60rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Demo:
          </span>
          {Object.entries(DEMO_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handleRunDemo(key)}
              title={preset.desc}
              style={{
                background: activeDemo === key ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${activeDemo === key ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: activeDemo === key ? '#38bdf8' : '#94a3b8',
                borderRadius: '5px',
                padding: '5px 10px',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Static-only note */}
      <div style={{
        background: 'rgba(56,189,248,0.06)',
        border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: '0',
        padding: '6px 18px',
        fontSize: '0.68rem',
        color: '#38bdf8',
        flexShrink: 0,
      }}>
        ℹ Live runs need the backend. Use a demo preset above or download the file and run{' '}
        <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(56,189,248,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
          python -m rehearsal.run
        </code>
      </div>

      {/* Tab nav */}
      <div className="tabs-row" style={{ flexShrink: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            style={{ opacity: t.disabled ? 0.4 : 1, cursor: t.disabled ? 'not-allowed' : 'pointer' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── FORM TAB ─── */}
      {tab === 'form' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleRunRehearsal}
              disabled={!valid}
              style={{
                background: valid ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'rgba(255,255,255,0.05)',
                color: valid ? '#fff' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: valid ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-ui)',
              }}
            >
              ▶ Run Rehearsal
            </button>
            <button onClick={handleReset} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 14px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              ↺ Reset to Defaults
            </button>
            <button onClick={handleDownloadJSON} style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '6px', padding: '8px 14px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              ⬇ Download as JSON
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', padding: '8px 14px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              ⬆ Upload JSON
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUploadJSON} />
            {!valid && Object.keys(errors).length > 0 && (
              <span style={{ fontSize: '0.68rem', color: '#f87171', alignSelf: 'center' }}>
                ⚠ {Object.keys(errors).length} validation error{Object.keys(errors).length > 1 ? 's' : ''} — fix before running
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Mission */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Mission" />
                <FieldRow id="centre" label="Space Centre" error={errors.centre}>
                  <input id="centre" type="text" placeholder="e.g. ESOC, ISRO" value={form.centre} onChange={e => setField('centre', e.target.value)} style={errors.centre ? inputErrorStyle : inputStyle} />
                </FieldRow>
                <FieldRow id="mission" label="Mission Name" error={errors.mission}>
                  <input id="mission" type="text" placeholder="e.g. LUNAR-DEMO-1" value={form.mission} onChange={e => setField('mission', e.target.value)} style={errors.mission ? inputErrorStyle : inputStyle} />
                </FieldRow>
              </div>

              {/* Schedule */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Schedule" />
                <FieldRow id="launch_utc" label="Launch Date & Time" unit="UTC" hint="Enter in UTC" error={errors.launch_utc}>
                  <input id="launch_utc" type="datetime-local" value={form.launch_utc} onChange={e => setField('launch_utc', e.target.value)} style={errors.launch_utc ? inputErrorStyle : inputStyle} />
                  <span style={{ fontSize: '0.60rem', color: '#475569' }}>⚠ All times are UTC</span>
                </FieldRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <FieldRow id="transit_days" label="Transit" unit="days" hint="1–40" error={errors.transit_days}>
                    <input id="transit_days" type="number" min="1" max="40" step="0.5" value={form.transit_days} onChange={e => setField('transit_days', e.target.value)} style={errors.transit_days ? inputErrorStyle : inputStyle} />
                  </FieldRow>
                  <FieldRow id="orbit_hold_days" label="Orbit Hold" unit="days" hint="0–30" error={errors.orbit_hold_days}>
                    <input id="orbit_hold_days" type="number" min="0" max="30" step="0.5" value={form.orbit_hold_days} onChange={e => setField('orbit_hold_days', e.target.value)} style={errors.orbit_hold_days ? inputErrorStyle : inputStyle} />
                  </FieldRow>
                  <FieldRow id="surface_days" label="Surface" unit="days" hint="1–30" error={errors.surface_days}>
                    <input id="surface_days" type="number" min="1" max="30" step="1" value={form.surface_days} onChange={e => setField('surface_days', e.target.value)} style={errors.surface_days ? inputErrorStyle : inputStyle} />
                  </FieldRow>
                </div>
              </div>

              {/* Site */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Landing Site" />
                <FieldRow id="landing_site_id" label="Site" error={errors.landing_site_id}>
                  <select id="landing_site_id" value={form.landing_site_id} onChange={e => setField('landing_site_id', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    {SITE_IDS.map(id => (
                      <option key={id} value={id}>{SITE_NAMES[id] || id}</option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              {/* Constraints */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Constraints (optional)" />
                <FieldRow id="max_earth_blackout_h" label="Max Earth Blackout" unit="hours" hint="optional, > 0" error={errors['constraints.max_earth_blackout_h']}>
                  <input id="max_earth_blackout_h" type="number" min="0.1" step="1" placeholder="e.g. 48" value={form.constraints.max_earth_blackout_h} onChange={e => setField('constraints.max_earth_blackout_h', e.target.value)} style={errors['constraints.max_earth_blackout_h'] ? inputErrorStyle : inputStyle} />
                </FieldRow>
                <FieldRow id="min_sunlit_fraction" label="Min Sunlit Fraction" unit="0–1" hint="optional" error={errors['constraints.min_sunlit_fraction']}>
                  <input id="min_sunlit_fraction" type="number" min="0" max="1" step="0.01" placeholder="e.g. 0.5" value={form.constraints.min_sunlit_fraction} onChange={e => setField('constraints.min_sunlit_fraction', e.target.value)} style={errors['constraints.min_sunlit_fraction'] ? inputErrorStyle : inputStyle} />
                </FieldRow>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Hardware */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Hardware" />
                {[
                  { id: 'panel_m2', label: 'Solar Panel Area', unit: 'm²', hint: '> 0', key: 'panel_m2' },
                  { id: 'panel_efficiency', label: 'Panel Efficiency', unit: '0–1', hint: 'e.g. 0.28 = 28%', key: 'panel_efficiency' },
                  { id: 'battery_wh', label: 'Battery Capacity', unit: 'Wh', hint: '> 0', key: 'battery_wh' },
                  { id: 'base_load_w', label: 'Base Load', unit: 'W', hint: '≥ 0', key: 'base_load_w' },
                  { id: 'min_soc_fraction', label: 'Reserve Threshold', unit: '0–1', hint: 'default 0.20', key: 'min_soc_fraction' },
                ].map(f => (
                  <FieldRow key={f.id} id={f.id} label={f.label} unit={f.unit} hint={f.hint} error={errors[`hardware.${f.key}`]}>
                    <input id={f.id} type="number" min="0" step="any" value={form.hardware[f.key]} onChange={e => setField(`hardware.${f.key}`, e.target.value)} style={errors[`hardware.${f.key}`] ? inputErrorStyle : inputStyle} />
                  </FieldRow>
                ))}
              </div>

              {/* Delay scenarios */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SectionHeader title="Delay Scenarios (optional, max 8)" />

                {/* Probability total */}
                {hasProb && (
                  <div style={{
                    background: errors.delay_scenarios_probability ? 'rgba(248,113,113,0.08)' : 'rgba(56,189,248,0.07)',
                    border: `1px solid ${errors.delay_scenarios_probability ? 'rgba(248,113,113,0.4)' : 'rgba(56,189,248,0.3)'}`,
                    borderRadius: '5px',
                    padding: '6px 10px',
                    fontSize: '0.68rem',
                    color: errors.delay_scenarios_probability ? '#f87171' : '#38bdf8',
                  }}>
                    Probability total: {probability_total.toFixed(3)} · Unspecified: {unspecified_remainder?.toFixed(3)}
                    {errors.delay_scenarios_probability && <div role="alert" aria-live="polite">{errors.delay_scenarios_probability}</div>}
                  </div>
                )}

                {form.delay_scenarios.map((sc, i) => (
                  <div key={i} style={{
                    background: 'rgba(5,7,17,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '7px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Scenario {i + 1}</span>
                      <button onClick={() => removeScenario(i)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Remove</button>
                    </div>

                    <FieldRow id={`sc_type_${i}`} label="Type" error={errors[`delay_scenarios[${i}].type`]}>
                      <select id={`sc_type_${i}`} value={sc.type} onChange={e => updateScenario(i, 'type', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                        {DELAY_TYPES.map(t => <option key={t} value={t}>{DELAY_TYPE_LABELS[t]}</option>)}
                      </select>
                    </FieldRow>

                    {['launch_slip', 'transit_extension', 'orbit_hold_extension', 'landing_retry'].includes(sc.type) && (
                      <FieldRow id={`sc_days_${i}`} label="Days" unit="days" hint="≥ 0" error={errors[`delay_scenarios[${i}].days`]}>
                        <input id={`sc_days_${i}`} type="number" min="0" step="0.5" value={sc.days ?? ''} onChange={e => updateScenario(i, 'days', e.target.value)} style={inputStyle} />
                      </FieldRow>
                    )}

                    {sc.type === 'reduced_power' && (
                      <FieldRow id={`sc_pf_${i}`} label="Power Factor" unit="0–1" error={errors[`delay_scenarios[${i}].power_factor`]}>
                        <input id={`sc_pf_${i}`} type="number" min="0" max="1" step="0.05" value={sc.power_factor ?? ''} onChange={e => updateScenario(i, 'power_factor', e.target.value)} style={inputStyle} />
                      </FieldRow>
                    )}

                    {sc.type === 'comms_outage' && (
                      <>
                        <FieldRow id={`sc_ostart_${i}`} label="Outage Start" unit="UTC" error={errors[`delay_scenarios[${i}].outage_start_utc`]}>
                          <input id={`sc_ostart_${i}`} type="datetime-local" value={sc.outage_start_utc?.replace('Z','') ?? ''} onChange={e => updateScenario(i, 'outage_start_utc', e.target.value + ':00Z')} style={inputStyle} />
                        </FieldRow>
                        <FieldRow id={`sc_ohours_${i}`} label="Outage Duration" unit="hours" hint="≥ 0" error={errors[`delay_scenarios[${i}].outage_hours`]}>
                          <input id={`sc_ohours_${i}`} type="number" min="0" step="1" value={sc.outage_hours ?? ''} onChange={e => updateScenario(i, 'outage_hours', e.target.value)} style={inputStyle} />
                        </FieldRow>
                      </>
                    )}

                    <FieldRow id={`sc_prob_${i}`} label="Probability" unit="0–1" hint="Optional. Enter only if you have your own estimate. STELLARON does not estimate likelihood." error={errors[`delay_scenarios[${i}].probability`]}>
                      <input id={`sc_prob_${i}`} type="number" min="0" max="1" step="0.01" placeholder="optional" value={sc.probability ?? ''} onChange={e => updateScenario(i, 'probability', e.target.value)} style={inputStyle} />
                    </FieldRow>
                  </div>
                ))}

                {form.delay_scenarios.length < 8 && (
                  <button onClick={addScenario} style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', color: '#64748b', borderRadius: '6px', padding: '8px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                    + Add Delay Scenario
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── RESULTS TAB ─── */}
      {tab === 'results' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!result || result.status === 'no_backend' ? (
            <div style={{
              background: 'rgba(56,189,248,0.07)',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
              color: '#38bdf8',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🛸</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px' }}>Live Rehearsal Requires the Backend</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
                Use a <strong style={{ color: '#38bdf8' }}>Demo Scenario</strong> above to see precomputed results, or download your plan and run:<br />
                <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '4px', display: 'inline-block', marginTop: '8px', fontSize: '0.78rem' }}>
                  python -m rehearsal.run mission_plan.json results.json
                </code>
              </div>
            </div>
          ) : (
            <>
              {/* Mission label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>
                    {form.mission || 'Mission Rehearsal'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                    {SITE_NAMES[form.landing_site_id] || form.landing_site_id} · {form.surface_days}d surface
                    {activeDemo && <span style={{ marginLeft: '8px', color: '#38bdf8', fontWeight: 700 }}>[{DEMO_PRESETS[activeDemo]?.label} · precomputed]</span>}
                  </div>
                </div>
              </div>

              {/* Verdict badge */}
              <VerdictBadge
                verdict={result.verdict}
                limiting_factor={result.limiting_factor}
                result_sha256={result.result_sha256}
                provenance={result.provenance}
                metrics={result.baseline?.surface?.metrics}
              />

              {/* Slip calendar */}
              {result.slip_calendar && (
                <div style={{ background: 'rgba(7,10,24,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 18px' }}>
                  <SlipCalendarGrid slipCalendar={result.slip_calendar} />
                </div>
              )}

              {/* Decision gates */}
              {result.decision_gates && (
                <div style={{ background: 'rgba(7,10,24,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 18px' }}>
                  <DecisionGatesTimeline decisionGates={result.decision_gates} />
                </div>
              )}

              {/* Probability view */}
              {result.probability_view && (
                <div style={{ background: 'rgba(7,10,24,0.7)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Probability View
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#a78bfa', marginBottom: '10px', fontStyle: 'italic' }}>
                    {result.probability_view.note}
                  </div>
                  {result.probability_view.entries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <div style={{ width: `${e.probability * 200}px`, height: '8px', background: '#a78bfa', borderRadius: '4px', minWidth: '4px' }} />
                      <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>{e.probability.toFixed(2)} — {e.label}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.66rem', color: '#475569', marginTop: '6px' }}>
                    Unspecified: {result.probability_view.unspecified_remainder?.toFixed(3)}
                  </div>
                </div>
              )}

              {/* Provenance */}
              {result.provenance && (
                <div style={{
                  background: 'rgba(5,7,17,0.8)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.66rem',
                  color: '#475569',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                }}>
                  <div style={{ color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-ui)', marginBottom: '6px', fontSize: '0.68rem' }}>
                    Provenance
                  </div>
                  <div>Kernel: {result.provenance.ephemeris_kernel}</div>
                  <div>Model: {result.provenance.model_note}</div>
                  <div>SHA-256: {result.result_sha256}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── COMPARE TAB ─── */}
      {tab === 'compare' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <CompareView comparisonData={result?.comparison} />
        </div>
      )}

      {/* ─── 3D PLAYBACK TAB ─── */}
      {tab === 'playback' && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ChoreographyPlayer
            plan={form}
            siteId={form.landing_site_id}
            siteName={SITE_NAMES[form.landing_site_id]}
            timeline={result?.baseline?.timeline}
            surfaceMetrics={result?.baseline?.surface?.metrics}
            qualityTier={qualityTier}
            onQualityChange={setQualityTier}
            activeDemo={activeDemo}
            onSelectDemo={handleRunDemo}
          />
        </div>
      )}
    </div>
  )
}
