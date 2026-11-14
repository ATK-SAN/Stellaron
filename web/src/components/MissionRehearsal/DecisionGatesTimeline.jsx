/** DecisionGatesTimeline.jsx — Flight-Ops Decision Gates Timeline
 * Restyled with:
 * - Lucide line icons (GitCommit, AlertTriangle, Clock)
 * - Deep space panel styling and JetBrains Mono timestamps
 * - Clear remaining tolerance indicators
 */

import { GitCommit, AlertTriangle, Clock } from 'lucide-react'

const GATE_NAMES = {
  PRE_LAUNCH: 'Pre-Launch Hold',
  POST_LAUNCH: 'Post-Launch TLI',
  LUNAR_ORBIT_ARRIVAL: 'Lunar Orbit Insertion (LOI)',
  PRE_DESCENT: 'Pre-Descent Checkout (PDI)',
}

function ToleranceBar({ remaining, maxDays = 10 }) {
  const frac = Math.min(1, Math.max(0, (remaining || 0) / maxDays))
  const color = remaining > 3 ? 'var(--color-safe)' : remaining > 0 ? 'var(--color-caution)' : 'var(--color-hazard)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        height: '4px',
        flex: 1,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${frac * 100}%`,
          background: color,
          borderRadius: 'var(--radius-pill)',
          transition: 'width 200ms ease',
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color, fontWeight: 700, minWidth: '24px' }}>
        +{remaining}d
      </span>
    </div>
  )
}

export default function DecisionGatesTimeline({ decisionGates }) {
  if (!decisionGates || decisionGates.length === 0) return null

  const maxTolerance = Math.max(...decisionGates.map(g => g.remaining_tolerance_days || 0), 10)

  return (
    <div style={{
      background: 'var(--color-panel)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Title + Schematic Notice */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCommit size={16} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Mission Decision Gates
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--color-caution-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
          fontSize: '11px',
          color: 'var(--color-caution)',
        }}>
          <AlertTriangle size={12} strokeWidth={1.5} />
          <span>Schematic phases are illustrative — not a flight dynamics trajectory design.</span>
        </div>
      </div>

      {/* Decision Gates Grid / Flow */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        paddingTop: '6px',
      }}>
        {decisionGates.map((gate, i) => {
          const isFinalGate = i === decisionGates.length - 1
          return (
            <div
              key={gate.gate}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
              }}
            >
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-cyan)',
                  background: 'var(--color-cyan-subtle)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}>
                  GATE 0{i + 1}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  Slip: {gate.slip_so_far_days}d
                </span>
              </div>

              {/* Gate Name */}
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {GATE_NAMES[gate.gate] || gate.name}
              </div>

              {/* Timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                <Clock size={12} strokeWidth={1.5} />
                <span>{gate.time_utc ? gate.time_utc.slice(0, 16).replace('T', ' ') + ' UTC' : '—'}</span>
              </div>

              {/* Tolerance remaining progress */}
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  <span>Tolerance Remaining</span>
                  <span>Max: +{maxTolerance}d</span>
                </div>
                <ToleranceBar remaining={gate.remaining_tolerance_days} maxDays={maxTolerance} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
