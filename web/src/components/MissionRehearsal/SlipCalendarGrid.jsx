/** SlipCalendarGrid.jsx — Visual slip calendar sweep grid with color-blind accessible patterns */

import { useState } from 'react'

const VERDICT_STYLE = {
  survives: {
    bg: 'rgba(52,211,153,0.15)',
    border: 'rgba(52,211,153,0.5)',
    color: '#34d399',
    icon: '✓',
    // No pattern — solid green for survives
    pattern: 'none',
  },
  marginal: {
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.5)',
    color: '#fbbf24',
    icon: '⚠',
    // Diagonal stripe pattern for color-blind accessibility
    pattern: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(251,191,36,0.15) 3px, rgba(251,191,36,0.15) 6px)',
  },
  fails: {
    bg: 'rgba(248,113,113,0.1)',
    border: 'rgba(248,113,113,0.5)',
    color: '#f87171',
    icon: '✗',
    // Cross-hatch pattern for color-blind accessibility
    pattern: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(248,113,113,0.12) 3px, rgba(248,113,113,0.12) 6px)',
  },
}

function TooltipContent({ cell }) {
  const lf = { none: '—', battery_reserve: 'Battery reserve', earth_blackout: 'Earth blackout', sunlit_fraction: 'Sunlit fraction' }
  return (
    <div style={{ minWidth: '200px' }}>
      <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
        {cell.date_utc?.slice(0, 10)}
      </div>
      {[
        ['Verdict', VERDICT_STYLE[cell.verdict]?.icon + ' ' + cell.verdict?.toUpperCase()],
        ['Min SoC', `${((cell.min_soc || 0) * 100).toFixed(1)}%`],
        ['Sunlit Hours', `${cell.sunlit_hours || 0}h`],
        ['Max Blackout', `${cell.blackout_hours || 0}h`],
        ['Limiting Factor', lf[cell.limiting_factor] || cell.limiting_factor || '—'],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.68rem', marginBottom: '3px' }}>
          <span style={{ color: '#64748b' }}>{k}</span>
          <span style={{ color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function SlipCalendarGrid({ slipCalendar }) {
  const [tooltip, setTooltip] = useState(null)

  if (!slipCalendar) return null
  const { cells = [], baseline_landing_utc, tolerance_days_forward, first_failing_offset_days, next_pass_window_utc } = slipCalendar

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Title */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Slip Calendar
        </div>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
          Hover any cell for details. Baseline landing: <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{baseline_landing_utc?.slice(0, 10)}</span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
        }}>
          {cells.map((cell) => {
            const vs = VERDICT_STYLE[cell.verdict] || VERDICT_STYLE.fails
            const isBaseline = cell.offset_days === 0
            return (
              <div
                key={cell.offset_days}
                onMouseEnter={(e) => setTooltip({ cell, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  width: '54px',
                  background: vs.pattern !== 'none' ? vs.pattern : vs.bg,
                  backgroundColor: vs.pattern !== 'none' ? undefined : vs.bg,
                  border: `${isBaseline ? '2px' : '1px'} solid ${isBaseline ? '#38bdf8' : vs.border}`,
                  borderRadius: '5px',
                  padding: '6px 4px',
                  textAlign: 'center',
                  cursor: 'default',
                  position: 'relative',
                  boxShadow: isBaseline ? '0 0 10px rgba(56,189,248,0.3)' : 'none',
                  transition: 'transform 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isBaseline && (
                  <div style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.55rem',
                    color: '#38bdf8',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    BASE
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: vs.color, fontWeight: 700 }}>
                  {vs.icon}
                </div>
                <div style={{ fontSize: '0.60rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                  {cell.offset_days >= 0 ? `+${cell.offset_days}d` : `${cell.offset_days}d`}
                </div>
                <div style={{ fontSize: '0.60rem', color: vs.color, fontFamily: 'var(--font-mono)' }}>
                  {((cell.min_soc || 0) * 100).toFixed(0)}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 12, window.innerWidth - 240),
            top: tooltip.y - 10,
            background: 'rgba(7,10,24,0.97)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            padding: '10px 14px',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            <TooltipContent cell={tooltip.cell} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '0.68rem', color: '#64748b', flexWrap: 'wrap' }}>
        {[
          { verdict: 'survives', label: 'Survives' },
          { verdict: 'marginal', label: 'Marginal (striped)' },
          { verdict: 'fails', label: 'Fails (cross-hatched)' },
        ].map(l => {
          const vs = VERDICT_STYLE[l.verdict]
          return (
            <div key={l.verdict} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '14px', height: '14px',
                background: vs.pattern !== 'none' ? vs.pattern : vs.bg,
                backgroundColor: vs.pattern !== 'none' ? undefined : vs.bg,
                border: `1px solid ${vs.border}`,
                borderRadius: '3px',
              }} />
              <span>{l.label}</span>
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '8px',
        background: 'rgba(5,7,17,0.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '12px 16px',
      }}>
        {[
          {
            label: 'Forward Tolerance',
            value: tolerance_days_forward != null ? `${tolerance_days_forward} day${tolerance_days_forward !== 1 ? 's' : ''}` : '—',
            color: tolerance_days_forward > 3 ? '#34d399' : tolerance_days_forward > 0 ? '#fbbf24' : '#f87171',
          },
          {
            label: 'First Failing Offset',
            value: first_failing_offset_days != null ? `+${first_failing_offset_days}d` : 'None in sweep',
            color: first_failing_offset_days == null ? '#34d399' : '#f87171',
          },
          {
            label: 'Next Recovery',
            value: next_pass_window_utc ? next_pass_window_utc.slice(0, 10) : '—',
            color: '#94a3b8',
          },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: s.color, marginTop: '2px' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
