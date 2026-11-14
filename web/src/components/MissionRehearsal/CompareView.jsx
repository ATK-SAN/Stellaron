/** CompareView.jsx — Mission Control Rehearsal Scenario Comparison View
 * Restyled with:
 * - Lucide line icons (GitCompare, Check, AlertTriangle, X)
 * - Hairline divider table with cyan left-border on selected column
 * - JetBrains Mono for metrics and timestamps
 */

import { useState } from 'react'
import { GitCompare, Check, AlertTriangle, X } from 'lucide-react'

const VERDICT_STYLES = {
  survives: { bg: 'var(--color-safe-subtle)', border: 'var(--color-safe-border)', color: 'var(--color-safe)', Icon: Check },
  marginal: { bg: 'var(--color-caution-subtle)', border: 'var(--color-caution-border)', color: 'var(--color-caution)', Icon: AlertTriangle },
  fails: { bg: 'var(--color-hazard-subtle)', border: 'var(--color-hazard-border)', color: 'var(--color-hazard)', Icon: X },
}

const DEFAULT_COMPARE_DEMO = {
  compared_count: 3,
  note: "Scenarios sorted chronologically by modelled landing epoch. Results are conditional on supplied mission constraints.",
  comparisons: [
    {
      label: "Baseline (Nominal)",
      change_sentence: "Nominal flight profile with on-schedule launch and lunar orbit insertion.",
      landing_utc: "2026-04-15T00:00:00Z",
      verdict: "survives",
      limiting_factor: "none",
      metrics: {
        minimum_soc: 0.55,
        sunlit_hours: 288.0,
        longest_earth_blackout_h: 18.5,
        sunlit_fraction: 0.84,
      },
    },
    {
      label: "Scenario 1: Launch Slip (+3d)",
      change_sentence: "Launch slipped by 3.0 days. Lunar orbit insertion and touchdown shift forward accordingly.",
      landing_utc: "2026-04-18T00:00:00Z",
      verdict: "survives",
      limiting_factor: "none",
      metrics: {
        minimum_soc: 0.48,
        sunlit_hours: 264.0,
        longest_earth_blackout_h: 22.0,
        sunlit_fraction: 0.79,
      },
    },
    {
      label: "Scenario 2: Reduced Power (70%)",
      change_sentence: "Solar panel effective generation reduced to 70% of nominal rating.",
      landing_utc: "2026-04-15T00:00:00Z",
      verdict: "marginal",
      limiting_factor: "battery_reserve",
      metrics: {
        minimum_soc: 0.24,
        sunlit_hours: 288.0,
        longest_earth_blackout_h: 18.5,
        sunlit_fraction: 0.84,
      },
    },
  ],
}

export default function CompareView({ comparisonData }) {
  const data = comparisonData || DEFAULT_COMPARE_DEMO
  const [selectedCol, setSelectedCol] = useState(0)

  const items = [...(data.comparisons || [])].sort((a, b) => a.landing_utc.localeCompare(b.landing_utc))

  return (
    <div style={{
      background: 'var(--color-panel)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCompare size={16} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Scenario Comparative Analysis
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {data.note}
        </div>
      </div>

      {/* Side-by-Side Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
        gap: '12px',
      }}>
        {items.map((item, idx) => {
          const vs = VERDICT_STYLES[item.verdict] || VERDICT_STYLES.fails
          const VIcon = vs.Icon
          const isSelected = selectedCol === idx
          return (
            <div
              key={idx}
              onClick={() => setSelectedCol(idx)}
              style={{
                background: isSelected ? 'var(--color-panel-hover)' : 'var(--color-surface)',
                border: isSelected ? '1px solid var(--color-cyan-border)' : '1px solid var(--color-border)',
                borderLeft: isSelected ? '3px solid var(--color-cyan)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: isSelected ? '0 0 16px rgba(34, 211, 238, 0.15)' : 'none',
                transition: 'all 150ms ease',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? 'var(--color-cyan)' : 'var(--text-primary)' }}>
                  {item.label}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: vs.bg,
                  border: `1px solid ${vs.border}`,
                  color: vs.color,
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                }}>
                  <VIcon size={11} strokeWidth={2.5} />
                  {item.verdict?.toUpperCase()}
                </span>
              </div>

              {/* Explanatory sentence */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, minHeight: '34px' }}>
                {item.change_sentence}
              </div>

              {/* Landing Date */}
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Landing: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.landing_utc?.slice(0, 10)}</span>
              </div>

              {/* Metrics Divider Table */}
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  ['Min SoC', `${((item.metrics?.minimum_soc ?? 0) * 100).toFixed(1)}%`],
                  ['Sunlit Hours', `${item.metrics?.sunlit_hours ?? 0}h`],
                  ['Max Earth Blackout', `${item.metrics?.longest_earth_blackout_h ?? 0}h`],
                  ['Sunlit Fraction', `${((item.metrics?.sunlit_fraction ?? 0) * 100).toFixed(1)}%`],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{lbl}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
