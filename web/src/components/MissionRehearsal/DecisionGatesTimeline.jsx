/** DecisionGatesTimeline.jsx — Horizontal decision gates timeline for Mission Rehearsal */

const GATE_COLORS = {
  PRE_LAUNCH: '#38bdf8',
  POST_LAUNCH: '#a78bfa',
  LUNAR_ORBIT_ARRIVAL: '#34d399',
  PRE_DESCENT: '#fbbf24',
}

function ToleranceBar({ remaining, maxDays = 10 }) {
  const frac = Math.min(1, (remaining || 0) / maxDays)
  const color = remaining > 3 ? '#34d399' : remaining > 0 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        height: '6px',
        flex: 1,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${frac * 100}%`,
          background: color,
          borderRadius: '3px',
          transition: 'width 0.3s',
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color, fontWeight: 700, minWidth: '28px' }}>
        {remaining}d
      </span>
    </div>
  )
}

export default function DecisionGatesTimeline({ decisionGates }) {
  if (!decisionGates || decisionGates.length === 0) return null

  const phaseLabels = [
    { label: 'TRANSIT', note: 'illustrative' },
    { label: 'LUNAR ORBIT', note: 'illustrative' },
    { label: 'DESCENT', note: 'illustrative' },
  ]

  const maxTolerance = Math.max(...decisionGates.map(g => g.remaining_tolerance_days || 0), 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Title + Schematic banner */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
          Decision Gates
        </div>
        <div style={{
          background: 'rgba(251,191,36,0.07)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '5px',
          padding: '5px 10px',
          fontSize: '0.68rem',
          color: '#fbbf24',
          fontStyle: 'italic',
        }}>
          ⚠ Schematic phases are illustrative — not a trajectory design.
        </div>
      </div>

      {/* Horizontal timeline bar */}
      <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: '4px' }}>
        {/* Phase connector row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', minWidth: '600px' }}>
          {decisionGates.map((gate, i) => {
            const color = GATE_COLORS[gate.gate] || '#94a3b8'
            return (
              <div key={gate.gate} style={{ display: 'flex', alignItems: 'center', flex: i < decisionGates.length - 1 ? 1 : 0 }}>
                {/* Gate node */}
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}80`,
                  flexShrink: 0,
                }} />
                {/* Phase line + label */}
                {i < decisionGates.length - 1 && (
                  <div style={{ flex: 1, position: 'relative', margin: '0 4px' }}>
                    <div style={{ height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      fontSize: '0.56rem',
                      color: '#475569',
                      fontStyle: 'italic',
                    }}>
                      {phaseLabels[i]?.label} ({phaseLabels[i]?.note})
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Gate cards */}
        <div style={{ display: 'flex', gap: '8px', minWidth: '600px' }}>
          {decisionGates.map((gate) => {
            const color = GATE_COLORS[gate.gate] || '#94a3b8'
            const rem = gate.remaining_tolerance_days || 0
            const remColor = rem > 3 ? '#34d399' : rem > 0 ? '#fbbf24' : '#f87171'
            return (
              <div key={gate.gate} style={{
                flex: 1,
                background: 'rgba(5,7,17,0.7)',
                border: `1px solid ${color}40`,
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ fontSize: '0.60rem', color, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {gate.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#475569' }}>
                  {gate.time_utc?.slice(0, 10)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  Slip so far: <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    {gate.slip_so_far_days > 0 ? `+${gate.slip_so_far_days}d` : '0d'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.60rem', color: '#475569', marginBottom: '3px' }}>
                    Remaining tolerance
                  </div>
                  <ToleranceBar remaining={rem} maxDays={maxTolerance} />
                </div>
                {gate.first_failing_landing_utc && (
                  <div style={{ fontSize: '0.60rem', color: '#475569' }}>
                    First fail: <span style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                      {gate.first_failing_landing_utc.slice(0, 10)}
                    </span>
                  </div>
                )}
                {!gate.first_failing_landing_utc && (
                  <div style={{ fontSize: '0.60rem', color: '#34d399' }}>
                    No failure in sweep ✓
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
