/** MissionRehearsal/index.jsx — Mission Control Rehearsal UI for STELLARON
 *
 * Restyled with:
 * - One clean underline-style tab row for sub-tabs (Input / Results / Compare / Playback)
 * - Single segmented control for Demo Presets (Demo A | Demo B | Demo C)
 * - Product-grade banner replacing developer messages
 * - Buttons with 3 variants (primary cyan, secondary outlined glass, ghost)
 * - Space Grotesk headings, JetBrains Mono data fields, Lucide line icons throughout
 * - Layered #111827 panels, borders rgba(255,255,255,0.08)
 */

import { useState, useCallback, useRef } from 'react'
import {
  FileText,
  BarChart3,
  GitCompare,
  Rocket,
  Play,
  RotateCcw,
  Download,
  Upload,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  Server,
} from 'lucide-react'
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
  launch_utc: '2026-04-10T00:00',
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
    label: 'Demo A',
    desc: 'Shackleton Ridge · 14-day surface · nominal profile',
    form: {
      centre: 'Demo Agency Alpha',
      mission: 'DEMO-LUNAR-A',
      launch_utc: '2026-04-10T00:00',
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
    label: 'Demo B',
    desc: 'Malapert Mountain · reduced hardware power scenario',
    form: {
      centre: 'Demo Agency Beta',
      mission: 'DEMO-LUNAR-B',
      launch_utc: '2026-04-01T00:00',
      transit_days: 3,
      orbit_hold_days: 1,
      landing_site_id: 'malapert_mountain',
      surface_days: 10,
      hardware: { panel_m2: 2.5, panel_efficiency: 0.28, battery_wh: 1200, base_load_w: 65, min_soc_fraction: 0.20 },
      constraints: { max_earth_blackout_h: '', min_sunlit_fraction: '' },
      delay_scenarios: [{ type: 'reduced_power', power_factor: 0.7 }],
    },
  },
  C: {
    label: 'Demo C',
    desc: 'Nobile Rim 1 · launch slip scenario',
    form: {
      centre: 'Demo Agency Gamma',
      mission: 'DEMO-LUNAR-C',
      launch_utc: '2026-04-20T00:00',
      transit_days: 3,
      orbit_hold_days: 1,
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
    const date = new Date('2026-04-15T00:00:00Z')
    date.setDate(date.getDate() + off)
    const dateStr = date.toISOString().slice(0, 10) + 'T00:00:00Z'
    let verdict, minSoc, lf
    if (off >= 10) { verdict = 'fails'; minSoc = 0.14; lf = 'battery_reserve' }
    else if (off >= 8) { verdict = 'marginal'; minSoc = 0.24; lf = 'battery_reserve' }
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
      baseline_landing_utc: '2026-04-15T00:00:00Z',
      tolerance_days_forward: 9,
      first_failing_offset_days: 10,
      first_failing_landing_utc: '2026-04-25T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: buildMockCalendarCells(),
    },
    decision_gates: [
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-04-10T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-25T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-04-14T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-25T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-04-14T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-25T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-04-15T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 9, first_failing_landing_utc: '2026-04-25T00:00:00Z' },
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
      baseline_landing_utc: '2026-04-05T00:00:00Z',
      tolerance_days_forward: 3,
      first_failing_offset_days: 4,
      first_failing_landing_utc: '2026-04-09T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: (() => {
        const cells = []
        for (let off = -5; off <= 14; off++) {
          const d = new Date('2026-04-05T00:00:00Z'); d.setDate(d.getDate() + off)
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
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-04-01T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-09T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-04-04T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-09T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-04-04T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-09T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-04-05T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 3, first_failing_landing_utc: '2026-04-09T00:00:00Z' },
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
      baseline_landing_utc: '2026-04-24T00:00:00Z',
      tolerance_days_forward: 7,
      first_failing_offset_days: 8,
      first_failing_landing_utc: '2026-05-02T00:00:00Z',
      next_pass_window_utc: null,
      sweep_range_days: [-5, 14],
      cells: (() => {
        const cells = []
        for (let off = -5; off <= 14; off++) {
          const d = new Date('2026-04-24T00:00:00Z'); d.setDate(d.getDate() + off)
          let verdict, soc, lf
          if (off >= 8) { verdict = 'fails'; soc = 0.11; lf = 'battery_reserve' }
          else { verdict = 'survives'; soc = 0.5; lf = 'none' }
          cells.push({ offset_days: off, date_utc: d.toISOString().slice(0,10)+'T00:00:00Z', verdict, min_soc: soc, sunlit_hours: 150, blackout_hours: 12, limiting_factor: lf })
        }
        return cells
      })(),
    },
    decision_gates: [
      { gate: 'PRE_LAUNCH', name: 'Pre-Launch Hold', time_utc: '2026-04-20T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-02T00:00:00Z' },
      { gate: 'POST_LAUNCH', name: 'Post-Launch Injection', time_utc: '2026-04-23T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-02T00:00:00Z' },
      { gate: 'LUNAR_ORBIT_ARRIVAL', name: 'Lunar Orbit Arrival', time_utc: '2026-04-23T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-02T00:00:00Z' },
      { gate: 'PRE_DESCENT', name: 'Pre-Descent Checkout', time_utc: '2026-04-24T00:00:00Z', slip_so_far_days: 0, remaining_tolerance_days: 7, first_failing_landing_utc: '2026-05-02T00:00:00Z' },
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

// ─── Reusable Field & Section Components ─────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
      paddingBottom: '4px',
      borderBottom: '1px solid var(--color-border)',
      marginBottom: '6px',
    }}>
      {title}
    </div>
  )
}

function FieldRow({ id, label, unit, hint, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label htmlFor={id} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label} {unit && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>({unit})</span>}
        </label>
        {hint && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{hint}</span>}
      </div>
      {children}
      {error && <span style={{ fontSize: '11px', color: 'var(--color-hazard)', fontFamily: 'var(--font-mono)' }}>{error}</span>}
    </div>
  )
}

const inputStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  transition: 'border-color 150ms ease',
}

const inputErrorStyle = {
  ...inputStyle,
  borderColor: 'var(--color-hazard)',
}

// ─── Main MissionRehearsal Component ─────────────────────────────────────────
export default function MissionRehearsal() {
  const [tab, setTab] = useState('form')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [validation, setValidation] = useState(() => validateMissionPlan(DEFAULT_FORM))
  const [result, setResult] = useState(null)
  const [activeDemo, setActiveDemo] = useState(null)
  const [qualityTier, setQualityTier] = useState('High')
  const fileInputRef = useRef(null)

  const updateForm = useCallback((updater) => {
    setForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const v = validateMissionPlan({ ...next, launch_utc: next.launch_utc ? next.launch_utc + ':00Z' : '' })
      setValidation(v)
      return next
    })
  }, [])

  const setField = (field, value) => {
    updateForm(prev => ({ ...prev, [field]: value }))
  }

  const setHwField = (field, value) => {
    updateForm(prev => ({ ...prev, hardware: { ...prev.hardware, [field]: value } }))
  }

  const setConstraintField = (field, value) => {
    updateForm(prev => ({ ...prev, constraints: { ...prev.constraints, [field]: value } }))
  }

  const handleRunDemo = (key) => {
    const preset = DEMO_PRESETS[key]
    if (!preset) return
    setActiveDemo(key)
    setForm(preset.form)
    const v = validateMissionPlan({ ...preset.form, launch_utc: preset.form.launch_utc + ':00Z' })
    setValidation(v)
    setResult(MOCK_RESULTS[key] || MOCK_RESULTS.A)
    setTab('playback')
  }

  const handleRunRehearsal = () => {
    if (!validation.valid) return
    const mock = MOCK_RESULTS[activeDemo] || MOCK_RESULTS.A
    setResult(mock)
    setTab('playback')
  }

  const handleReset = () => {
    setForm(DEFAULT_FORM)
    setValidation(validateMissionPlan(DEFAULT_FORM))
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
        alert('Invalid JSON file format.')
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

  const { valid, errors } = validation

  // Sub-tabs configuration
  const tabs = [
    { id: 'form', label: 'Mission Input', icon: FileText },
    { id: 'results', label: 'Evaluation Results', icon: BarChart3, disabled: !result },
    { id: 'compare', label: 'Scenario Compare', icon: GitCompare },
    { id: 'playback', label: '3D Flight Playback', icon: Rocket },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* ── Sub-Header: Mission Title + Demo Segmented Control ── */}
      <div style={{
        padding: '12px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Mission Rehearsal & Timeline Simulator
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Modelled surface conditions based on SPICE ephemeris and LOLA topographic horizons.
          </div>
        </div>

        {/* Demo Preset Single Segmented Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Demo Presets:
          </span>
          <div className="segmented-control">
            {Object.entries(DEMO_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handleRunDemo(key)}
                className={`segmented-item ${activeDemo === key ? 'active' : ''}`}
                title={preset.desc}
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Product-Grade Banner (Replacing Developer Messages) ── */}
      <div style={{
        background: 'var(--color-panel)',
        borderBottom: '1px solid var(--color-border)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={14} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <span>Live simulation requires the backend calculation engine.</span>
        </div>
        <button
          onClick={() => handleRunDemo('A')}
          className="btn btn-secondary"
          style={{ padding: '3px 10px', fontSize: '11px' }}
        >
          Use Demo Data (Demo A)
        </button>
      </div>

      {/* ── Underline-Style Sub-Tab Row ── */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        flexShrink: 0,
        padding: '0 16px',
      }}>
        {tabs.map(t => {
          const TabIcon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => !t.disabled && setTab(t.id)}
              disabled={t.disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-cyan)' : '2px solid transparent',
                color: isActive ? 'var(--color-cyan)' : t.disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <TabIcon size={15} strokeWidth={isActive ? 2 : 1.5} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── TAB 1: FORM ─── */}
      {tab === 'form' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleRunRehearsal}
              disabled={!valid}
              className={`btn ${valid ? 'btn-primary' : 'btn-secondary'}`}
              style={{ opacity: valid ? 1 : 0.4 }}
            >
              <Play size={14} strokeWidth={2} />
              <span>Run Rehearsal</span>
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              <RotateCcw size={14} strokeWidth={1.5} />
              <span>Reset Defaults</span>
            </button>
            <button onClick={handleDownloadJSON} className="btn btn-secondary">
              <Download size={14} strokeWidth={1.5} />
              <span>Export JSON</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary">
              <Upload size={14} strokeWidth={1.5} />
              <span>Import Plan</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUploadJSON} />

            {!valid && Object.keys(errors).length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--color-hazard)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={13} strokeWidth={1.5} />
                <span>{Object.keys(errors).length} validation error(s) pending</span>
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Left Column: Mission Profile & Hardware */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SectionHeader title="Mission Parameters" />
                <FieldRow id="centre" label="Space Agency / Centre" error={errors.centre}>
                  <input id="centre" type="text" placeholder="e.g. NASA, ESA, ISRO" value={form.centre} onChange={e => setField('centre', e.target.value)} style={errors.centre ? inputErrorStyle : inputStyle} />
                </FieldRow>
                <FieldRow id="mission" label="Mission Identifier" error={errors.mission}>
                  <input id="mission" type="text" placeholder="e.g. ARTEMIS-VII" value={form.mission} onChange={e => setField('mission', e.target.value)} style={errors.mission ? inputErrorStyle : inputStyle} />
                </FieldRow>
                <FieldRow id="landing_site_id" label="Landing Site Target" error={errors.landing_site_id}>
                  <select id="landing_site_id" value={form.landing_site_id} onChange={e => setField('landing_site_id', e.target.value)} style={inputStyle}>
                    {SITE_IDS.map(id => (
                      <option key={id} value={id}>{SITE_NAMES[id] || id}</option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              {/* Hardware Specifications */}
              <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SectionHeader title="Lander Hardware Specification" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <FieldRow id="panel_m2" label="Solar Array Area" unit="m²" error={errors['hardware.panel_m2']}>
                    <input id="panel_m2" type="number" step="0.1" value={form.hardware.panel_m2} onChange={e => setHwField('panel_m2', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                  <FieldRow id="battery_wh" label="Battery Storage" unit="Wh" error={errors['hardware.battery_wh']}>
                    <input id="battery_wh" type="number" step="50" value={form.hardware.battery_wh} onChange={e => setHwField('battery_wh', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                  <FieldRow id="base_load_w" label="Base Electrical Load" unit="W" error={errors['hardware.base_load_w']}>
                    <input id="base_load_w" type="number" step="5" value={form.hardware.base_load_w} onChange={e => setHwField('base_load_w', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                  <FieldRow id="min_soc_fraction" label="Reserve Margin" unit="frac" error={errors['hardware.min_soc_fraction']}>
                    <input id="min_soc_fraction" type="number" step="0.05" value={form.hardware.min_soc_fraction} onChange={e => setHwField('min_soc_fraction', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                </div>
              </div>
            </div>

            {/* Right Column: Timeline & Delay Scenarios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SectionHeader title="Timeline Schedule" />
                <FieldRow id="launch_utc" label="Launch Date & Time" unit="UTC" error={errors.launch_utc}>
                  <input id="launch_utc" type="datetime-local" value={form.launch_utc} onChange={e => setField('launch_utc', e.target.value)} style={errors.launch_utc ? inputErrorStyle : inputStyle} />
                </FieldRow>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <FieldRow id="transit_days" label="Transit" unit="days" error={errors.transit_days}>
                    <input id="transit_days" type="number" step="0.5" value={form.transit_days} onChange={e => setField('transit_days', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                  <FieldRow id="orbit_hold_days" label="Orbit Hold" unit="days" error={errors.orbit_hold_days}>
                    <input id="orbit_hold_days" type="number" step="0.5" value={form.orbit_hold_days} onChange={e => setField('orbit_hold_days', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                  <FieldRow id="surface_days" label="Surface Ops" unit="days" error={errors.surface_days}>
                    <input id="surface_days" type="number" step="1" value={form.surface_days} onChange={e => setField('surface_days', Number(e.target.value))} style={inputStyle} />
                  </FieldRow>
                </div>
              </div>

              {/* Perturbation Scenarios */}
              <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionHeader title="Delay & Perturbation Scenarios" />
                  <button onClick={addScenario} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }}>
                    <Plus size={12} strokeWidth={2} />
                    <span>Add Scenario</span>
                  </button>
                </div>

                {form.delay_scenarios.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '12px 0' }}>
                    No delay perturbations specified (evaluates nominal timeline).
                  </div>
                ) : (
                  form.delay_scenarios.map((sc, idx) => (
                    <div key={idx} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <select value={sc.type} onChange={e => updateScenario(idx, 'type', e.target.value)} style={{ ...inputStyle, flex: 2, padding: '4px 8px' }}>
                        {DELAY_TYPES.map(t => (
                          <option key={t} value={t}>{DELAY_TYPE_LABELS[t] || t}</option>
                        ))}
                      </select>
                      <input type="number" step="1" placeholder="Days" value={sc.days ?? sc.power_factor ?? 1} onChange={e => updateScenario(idx, sc.type === 'reduced_power' ? 'power_factor' : 'days', Number(e.target.value))} style={{ ...inputStyle, flex: 1, padding: '4px 8px' }} />
                      <button onClick={() => removeScenario(idx)} className="btn btn-ghost" style={{ padding: '4px' }}>
                        <Trash2 size={14} style={{ color: 'var(--color-hazard)' }} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: RESULTS ─── */}
      {tab === 'results' && result && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <VerdictBadge
            verdict={result.verdict}
            limiting_factor={result.limiting_factor}
            result_sha256={result.result_sha256}
            provenance={result.provenance}
            metrics={result.baseline?.surface?.metrics}
          />
          <SlipCalendarGrid slipCalendar={result.slip_calendar} />
          <DecisionGatesTimeline decisionGates={result.decision_gates} />
        </div>
      )}

      {/* ─── TAB 3: COMPARE ─── */}
      {tab === 'compare' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <CompareView comparisonData={result?.comparison} />
        </div>
      )}

      {/* ─── TAB 4: 3D FLIGHT PLAYBACK ─── */}
      {tab === 'playback' && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ChoreographyPlayer
            plan={form}
            siteId={form.landing_site_id}
            siteName={SITE_NAMES[form.landing_site_id]}
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
