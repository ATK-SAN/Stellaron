/** SlipCalendarGrid.jsx — Mission Control Slip Calendar Sweep Grid
 * Accessible color-blind patterns, JetBrains Mono data, Lucide line icons
 */

import { useState } from 'react'
import { Calendar, Check, AlertTriangle, X } from 'lucide-react'

const VERDICT_STYLE = {
  survives: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.4)',
    color: '#10B981',
    Icon: Check,
    pattern: 'none',
  },
  marginal: {
    bg: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.4)',
    color: '#F59E0B',
    Icon: AlertTriangle,
    pattern: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(245, 158, 11, 0.15) 3px, rgba(245, 158, 11, 0.15) 6px)',
  },
  fails: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.4)',
    color: '#EF4444',
    Icon: X,
    pattern: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(239, 68, 68, 0.15) 3px, rgba(239, 68, 68, 0.15) 6px)',
  },
}

function TooltipContent({ cell }) {
  const lf = {
    none: 'None',
    battery_reserve: 'Battery reserve deficit',
    earth_blackout: 'Earth blackout exceeded',
    sunlit_fraction: 'Insufficient sunlight duration',
  }
  return (
    <div style={{ minWidth: '190px' }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
        {cell.date_utc?.slice(0, 10)}
      </div>
      {[
        ['Verdict', cell.verdict?.toUpperCase()],
        ['Min SoC', `${((cell.min_soc || 0) * 100).toFixed(1)}%`],
        ['Sunlit Hours', `${cell.sunlit_hours || 0}h`],
        ['Max Blackout', `${cell.blackout_hours || 0}h`],
        ['Limiting Factor', lf[cell.limiting_factor] || cell.limiting_factor || 'None'],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', marginBottom: '3px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function SlipCalendarGrid({ slipCalendar }) {
  const [tooltip, setTooltip] = useState(null)

  if (!slipCalendar) return null
  const { cells = [], baseline_landing_utc, tolerance_days_forward } = slipCalendar

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
      {/* Title & Baseline Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Landing Slip Calendar Sweep
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Baseline landing: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyan)', fontWeight: 600 }}>{baseline_landing_utc?.slice(0, 10)}</span>
          {tolerance_days_forward != null && (
            <span style={{ marginLeft: '12px', color: 'var(--text-tertiary)' }}>
              Forward tolerance: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-safe)', fontWeight: 700 }}>+{tolerance_days_forward}d</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid of Days */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px',
        }}>
          {cells.map((cell) => {
            const vs = VERDICT_STYLE[cell.verdict] || VERDICT_STYLE.fails
            const isBaseline = cell.offset_days === 0
            const CellIcon = vs.Icon
            return (
              <div
                key={cell.offset_days}
                onMouseEnter={(e) => setTooltip({ cell, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  width: '56px',
                  background: vs.pattern !== 'none' ? vs.pattern : vs.bg,
                  backgroundColor: vs.pattern !== 'none' ? undefined : vs.bg,
                  border: `${isBaseline ? '2px' : '1px'} solid ${isBaseline ? 'var(--color-cyan)' : vs.border}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 4px',
                  textAlign: 'center',
                  cursor: 'default',
                  position: 'relative',
                  boxShadow: isBaseline ? '0 0 12px rgba(34, 211, 238, 0.4)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: isBaseline ? 'var(--color-cyan)' : 'var(--text-secondary)',
                  fontWeight: isBaseline ? 800 : 600,
                  marginBottom: '2px',
                }}>
                  {cell.offset_days > 0 ? `+${cell.offset_days}d` : `${cell.offset_days}d`}
                </div>
                <div style={{ color: vs.color, display: 'flex', justifyContent: 'center' }}>
                  <CellIcon size={12} strokeWidth={2} />
                </div>
                <div style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: vs.color,
                  marginTop: '2px',
                  fontWeight: 600,
                }}>
                  {((cell.min_soc || 0) * 100).toFixed(0)}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Hover Tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 220, tooltip.x + 12),
            top: tooltip.y - 80,
            zIndex: 100,
            background: 'var(--color-panel-glass)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
          }}>
            <TooltipContent cell={tooltip.cell} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-border-subtle)',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-safe)', border: '1px solid var(--color-safe-border)' }} />
          <span>Survives (&gt;20% reserve)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-caution)', border: '1px solid var(--color-caution-border)' }} />
          <span>Marginal (tight buffer)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-hazard)', border: '1px solid var(--color-hazard-border)' }} />
          <span>Fails (depletes reserve)</span>
        </div>
      </div>
    </div>
  )
}
