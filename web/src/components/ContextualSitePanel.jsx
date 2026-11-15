/** ContextualSitePanel.jsx — Right-Hand Mission-Control Contextual Panel
 * Displays:
 * - Selected Site Name, lat/lon, elevation
 * - Radial Safety Score Ring Gauge (emerald/amber/red)
 * - Metric cards with mono figures
 * - Semantic Outlined Hazard Chips
 * - Mission Slip / Delay slider with live mono readout
 * - Executive briefing with audio TTS & clipboard copy
 * - Primary CTA to launch Mission Rehearsal
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Sun,
  Radio,
  Mountain,
  Gauge,
  Sliders,
  Volume2,
  Square,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Compass,
} from 'lucide-react'

function calculateScore(site) {
  const sun = (site?.sunlight_fraction ?? 0.4) * 100
  const earth = (site?.geometric_earth_visibility_fraction ?? 0.5) * 100
  const slopeSafety = site?.landing_safety_score ?? 80
  const score = Math.round(sun * 0.45 + earth * 0.35 + slopeSafety * 0.2)
  return Math.min(99, Math.max(25, score))
}

export default function ContextualSitePanel({
  site,
  siteData,
  onLaunchRehearsal,
  onDelayChange,
  delayDays = 0,
}) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [localDelay, setLocalDelay] = useState(delayDays)

  const score = calculateScore(site)
  const scoreColor = score >= 85 ? 'var(--color-safe)' : score >= 70 ? 'var(--color-caution)' : 'var(--color-hazard)'
  const scoreCircumference = 2 * Math.PI * 28
  const scoreOffset = scoreCircumference - (score / 100) * scoreCircumference

  const sunPct = ((site?.sunlight_fraction ?? 0) * 100).toFixed(1)
  const earthPct = ((site?.geometric_earth_visibility_fraction ?? 0) * 100).toFixed(1)
  const slopeDeg = site?.mean_slope_deg ?? (site?.id === 'malapert_mountain' ? 18.5 : 9.2)
  const elevationM = site?.elevation_m ?? 1306

  // Detect realistic hazard flags from site parameters
  const hazards = useMemo(() => {
    if (!site) return []
    const list = []
    if (slopeDeg > 15) list.push({ label: 'Slope >15° (Default limit, adjustable)', severity: 'hazard' })
    else if (slopeDeg > 8) list.push({ label: 'Moderate Incline', severity: 'caution' })

    if (site?.sunlight_fraction < 0.6) list.push({ label: 'Crater Shadow Risk', severity: 'hazard' })
    else if (site?.sunlight_fraction < 0.8) list.push({ label: 'Grazing Sun Elevation', severity: 'caution' })
    else list.push({ label: 'Persistent Sunlight', severity: 'safe' })

    if (site?.geometric_earth_visibility_fraction < 0.4) list.push({ label: 'Comms Occlusion', severity: 'hazard' })
    else if (site?.geometric_earth_visibility_fraction < 0.7) list.push({ label: 'Intermittent DTE', severity: 'caution' })
    else list.push({ label: 'Direct Earth Link', severity: 'safe' })

    if (site?.id?.includes('ridge')) list.push({ label: 'Ridge Crest Geometry', severity: 'safe' })
    if (site?.id?.includes('peak')) list.push({ label: 'Narrow Touchdown Zone', severity: 'caution' })

    list.push({ label: 'Horizon Limited to ~1.9 km', severity: 'caution' })

    return list
  }, [site, slopeDeg])

  // Executive briefing copy
  const briefingText = useMemo(() => {
    if (!site) return ''
    return `${site?.name}: Modelled sunlight coverage is ${sunPct}% and Earth visibility is ${earthPct}%. Terrain elevation is ${elevationM} meters with an average slope of ${slopeDeg} degrees. Modelled feasibility index is ${score} of 100.`
  }, [site, sunPct, earthPct, elevationM, slopeDeg, score])

  const handleSpeak = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    if (!site) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(briefingText)
    utterance.rate = 1.05
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [site, briefingText, isSpeaking])

  const handleCopy = useCallback(() => {
    if (!site) return
    navigator.clipboard?.writeText(briefingText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [site, briefingText])

  const handleDelaySlider = (val) => {
    setLocalDelay(val)
    if (onDelayChange) onDelayChange(val)
  }

  if (!site) {
    return (
      <aside style={{
        width: '340px',
        flexShrink: 0,
        height: '100%',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid var(--color-border-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--color-cyan)',
        }}>
          <Compass size={28} strokeWidth={1.5} />
        </div>
        <div style={{
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          letterSpacing: '0.04em',
        }}>
          No Site Selected
        </div>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: 0,
          maxWidth: '260px',
        }}>
          Pick a site on the globe or in the list to see its sunlight, Earth link, and power.
        </p>
      </aside>
    )
  }

  return (
    <div style={{
      width: '340px',
      height: '100%',
      background: 'var(--color-surface)',
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      padding: '20px 20px',
      gap: '18px',
      flexShrink: 0,
    }}>
      {/* ── Top Header: Site Title & Lat/Lon ── */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '4px' }}>
          Selected Target Site
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
          {site.name}
        </h2>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
          {Math.abs(site.lat_deg).toFixed(2)}°{site.lat_deg >= 0 ? 'N' : 'S'} · {Math.abs(site.lon_deg).toFixed(2)}°{site.lon_deg >= 0 ? 'E' : 'W'} · {elevationM}m DTM
        </div>
      </div>

      {/* ── Safety Score Radial Ring Gauge ── */}
      <div style={{
        background: 'var(--color-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Modelled Feasibility Index
            </span>
            <span style={{ fontSize: '9px', color: 'var(--color-cyan)', background: 'var(--color-cyan-subtle)', border: '1px solid var(--color-cyan-border)', padding: '1px 4px', borderRadius: '3px' }}>
              Modelled Constraint Check
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
            {score >= 85 ? 'High sunlight & comms' : score >= 70 ? 'Marginal power buffer' : 'High shadow / hazard risk'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            Weights: 45% Sun · 35% DTE · 20% Slope
          </div>
        </div>

        {/* Circular SVG Gauge */}
        <div style={{ position: 'relative', width: '68px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="34"
              cy="34"
              r="28"
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="5"
            />
            <circle
              cx="34"
              cy="34"
              r="28"
              fill="transparent"
              stroke={scoreColor}
              strokeWidth="5"
              strokeDasharray={scoreCircumference}
              strokeDashoffset={scoreOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            fontFamily: 'var(--font-mono)',
            fontSize: '18px',
            fontWeight: 800,
            color: scoreColor,
          }}>
            {score}
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Sunlight</span>
            <Sun size={13} strokeWidth={1.5} style={{ color: 'var(--color-caution)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {sunPct}%
          </div>
        </div>

        <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Earth link (DTE)</span>
            <Radio size={13} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {earthPct}%
          </div>
        </div>

        <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Mean Slope</span>
            <Mountain size={13} strokeWidth={1.5} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {slopeDeg.toFixed(1)}°
          </div>
        </div>

        <div style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Elevation</span>
            <Gauge size={13} strokeWidth={1.5} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {elevationM}m
          </div>
        </div>
      </div>

      {/* ── Semantic Outlined Hazard Chips ── */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '8px' }}>
          Operational Assessment Chips
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {hazards.map((h, idx) => {
            const chipClass = h.severity === 'safe' ? 'status-chip-safe' : h.severity === 'caution' ? 'status-chip-caution' : 'status-chip-hazard'
            return (
              <span key={idx} className={`status-chip ${chipClass}`} style={{ fontSize: '10px', padding: '3px 8px' }}>
                {h.label}
              </span>
            )
          })}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: 1.35 }}>
          Note: 30m LOLA DTM cannot resolve rocks or meter-scale craters; slope reflects regional terrain gradient, not an engineering landing-hazard certification.
        </div>
      </div>

      {/* ── Mission Slip / Delay Slider with Mono Value Readout ── */}
      <div style={{
        background: 'var(--color-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={13} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Mission Slip Tolerance
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-cyan)',
          }}>
            +{localDelay}d Slip
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={14}
          value={localDelay}
          onChange={e => handleDelaySlider(Number(e.target.value))}
        />

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          {localDelay === 0
            ? 'Nominal departure epoch. Evaluates baseline continuous illumination window.'
            : `Testing ${localDelay}-day arrival slip. Solar azimuth advances by ~${(localDelay * 12.2).toFixed(0)}°.`}
        </div>
      </div>

      {/* ── 10-Second Mission Briefing Card ── */}
      <div style={{
        background: 'var(--color-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Mission Briefing
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {'speechSynthesis' in window && (
              <button
                onClick={handleSpeak}
                className="btn btn-ghost"
                style={{ padding: '3px 6px' }}
                title={isSpeaking ? 'Stop speech' : 'Listen to briefing audio'}
              >
                {isSpeaking ? <Square size={13} style={{ color: 'var(--color-hazard)' }} /> : <Volume2 size={13} />}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="btn btn-ghost"
              style={{ padding: '3px 6px' }}
              title="Copy to clipboard"
            >
              {copied ? <Check size={13} style={{ color: 'var(--color-safe)' }} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {site?.simple_description || site?.description}
        </p>
      </div>

      {/* ── Primary CTA Button: Rehearse Mission at this Site ── */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <button
          onClick={() => onLaunchRehearsal && onLaunchRehearsal(site)}
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px 16px', fontSize: '13px' }}
        >
          <span>Rehearse Mission at this Site</span>
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
