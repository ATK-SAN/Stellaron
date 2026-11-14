/** CompareView.jsx — Mission Rehearsal Scenario & Landing Date Compare View
 *
 * Compares up to 3 mission scenarios or 2 landing dates side-by-side:
 * - Table sorted chronologically by modeled landing date
 * - Templated plain-English change sentences (no banned words)
 * - Highlights metric deltas (Min SoC, Sunlit Hours, Blackout Duration, Verdict)
 * - Fully neutral scientific labeling: "modelled", "conditional on your inputs"
 */

import { useState } from 'react'

const VERDICT_COLORS = {
  survives: { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.5)', color: '#34d399', icon: '✓' },
  marginal: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.5)', color: '#fbbf24', icon: '⚠' },
  fails: { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.5)', color: '#f87171', icon: '✗' },
}

const DEFAULT_COMPARE_DEMO = {
  compared_count: 3,
  note: "Sorted by modelled landing date. Results are conditional on the supplied inputs.",
  comparisons: [
    {
      label: "Baseline (Nominal)",
      change_sentence: "Nominal mission plan with no perturbations.",
      landing_utc: "2026-04-06T00:00:00Z",
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
      change_sentence: "Launch slipped by 3.0 day(s). All subsequent phases shift forward.",
      landing_utc: "2026-04-09T00:00:00Z",
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
      change_sentence: "Solar panel output reduced to 70% of nominal capacity.",
      landing_utc: "2026-04-06T00:00:00Z",
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
  const [selectedCol, setSelectedCol] = useState(null)

  const items = [...(data.comparisons || [])].sort((a, b) => a.landing_utc.localeCompare(b.landing_utc))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px' }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
          Scenario Comparison (Up to 3 Missions)
        </div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
          {data.note}
        </div>
      </div>

      {/* Side-by-side comparison cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(220px, 1fr))`, gap: '12px' }}>
        {items.map((c, idx) => {
          const vs = VERDICT_COLORS[c.verdict] || VERDICT_COLORS.fails
          const isBaseline = c.label.toLowerCase().includes('baseline')
          return (
            <div
              key={idx}
              onClick={() => setSelectedCol(selectedCol === idx ? null : idx)}
              style={{
                background: 'rgba(7,10,24,0.75)',
                border: `1px solid ${selectedCol === idx ? '#38bdf8' : isBaseline ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                boxShadow: isBaseline ? '0 0 12px rgba(56,189,248,0.1)' : 'none',
              }}
            >
              {/* Card Title */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                    {c.label}
                  </div>
                  {isBaseline && (
                    <span style={{ fontSize: '0.58rem', background: 'rgba(56,189,248,0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                      BASELINE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  Landing: {c.landing_utc?.slice(0, 10)}
                </div>
              </div>

              {/* Change description */}
              <div style={{
                background: 'rgba(5,7,17,0.6)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '0.70rem',
                color: '#cbd5e1',
                lineHeight: 1.4,
                fontStyle: isBaseline ? 'italic' : 'normal',
              }}>
                {c.change_sentence}
              </div>

              {/* Verdict Pill */}
              <div style={{
                background: vs.bg,
                border: `1px solid ${vs.border}`,
                borderRadius: '6px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: vs.color, fontSize: '1rem', fontWeight: 800 }}>{vs.icon}</span>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: vs.color, letterSpacing: '0.04em' }}>
                    {c.verdict?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                    Limiting factor: <strong style={{ color: '#e2e8f0' }}>{c.limiting_factor}</strong>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(5,7,17,0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase' }}>Min SoC</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700, color: vs.color }}>
                    {((c.metrics?.minimum_soc ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ background: 'rgba(5,7,17,0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase' }}>Sunlit Hours</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {c.metrics?.sunlit_hours ?? 0}h
                  </div>
                </div>
                <div style={{ background: 'rgba(5,7,17,0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase' }}>Max Blackout</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {c.metrics?.longest_earth_blackout_h ?? 0}h
                  </div>
                </div>
                <div style={{ background: 'rgba(5,7,17,0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase' }}>Sunlit %</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {((c.metrics?.sunlit_fraction ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Delta comparison summary table */}
      <div style={{
        background: 'rgba(5,7,17,0.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '12px 16px',
        overflowX: 'auto',
      }}>
        <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Delta Comparison Summary
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Scenario</th>
              <th style={{ padding: '6px 8px' }}>Landing (UTC)</th>
              <th style={{ padding: '6px 8px' }}>Verdict</th>
              <th style={{ padding: '6px 8px' }}>Min SoC</th>
              <th style={{ padding: '6px 8px' }}>Sunlit</th>
              <th style={{ padding: '6px 8px' }}>Earth Blackout</th>
              <th style={{ padding: '6px 8px' }}>Limiting Factor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => {
              const vs = VERDICT_COLORS[row.verdict] || VERDICT_COLORS.fails
              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px', fontWeight: 600, color: '#f1f5f9' }}>{row.label}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{row.landing_utc?.slice(0, 10)}</td>
                  <td style={{ padding: '8px', color: vs.color, fontWeight: 700 }}>{vs.icon} {row.verdict?.toUpperCase()}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: vs.color }}>{((row.metrics?.minimum_soc ?? 0) * 100).toFixed(1)}%</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.metrics?.sunlit_hours ?? 0}h</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.metrics?.longest_earth_blackout_h ?? 0}h</td>
                  <td style={{ padding: '8px', color: '#94a3b8' }}>{row.limiting_factor}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
