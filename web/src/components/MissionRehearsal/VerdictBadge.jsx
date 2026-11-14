/** VerdictBadge.jsx — Flight-Ops Verdict Display for Mission Rehearsal
 * Restyled with:
 * - Lucide line icons (CheckCircle2, AlertTriangle, XCircle)
 * - Semantic colors (emerald #10B981, amber #F59E0B, red #EF4444)
 * - JetBrains Mono for numbers/hashes, Space Grotesk for headings
 * - Circular SoC gauge indicator
 */

import { CheckCircle2, AlertTriangle, XCircle, Shield, Battery, Sun, Radio, Clock } from 'lucide-react'

const VERDICT_CONFIG = {
  survives: {
    Icon: CheckCircle2,
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.20)',
    border: 'rgba(16, 185, 129, 0.35)',
    bg: 'rgba(16, 185, 129, 0.08)',
    label: 'SURVIVES',
    text: 'Modelled mission parameters satisfy all constraint thresholds.',
  },
  marginal: {
    Icon: AlertTriangle,
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.20)',
    border: 'rgba(245, 158, 11, 0.35)',
    bg: 'rgba(245, 158, 11, 0.08)',
    label: 'MARGINAL',
    text: 'Modelled mission parameters operate within tolerance margin of limiting factors.',
  },
  fails: {
    Icon: XCircle,
    color: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.20)',
    border: 'rgba(239, 68, 68, 0.35)',
    bg: 'rgba(239, 68, 68, 0.08)',
    label: 'FAILS',
    text: 'Modelled mission parameters violate one or more constraint thresholds.',
  },
}

const LF_LABELS = {
  none: 'None',
  battery_reserve: 'Battery Reserve Deficit',
  earth_blackout: 'Earth Blackout Exceeded',
  sunlit_fraction: 'Insufficient Sunlit Duration',
}

export default function VerdictBadge({ verdict, limiting_factor, result_sha256, provenance, metrics }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.fails
  const IconComponent = cfg.Icon
  const lfLabel = LF_LABELS[limiting_factor] || limiting_factor || 'None'
  const shaShort = result_sha256 ? result_sha256.slice(0, 12) + '…' : '—'

  return (
    <div style={{
      background: 'var(--color-panel)',
      border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-lg)',
      padding: '24px 28px',
      boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 24px ${cfg.bg}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Top Banner: Verdict Status + Headline */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: cfg.color,
            boxShadow: `0 0 16px ${cfg.glow}`,
          }}>
            <IconComponent size={24} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: cfg.color,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {cfg.text}
            </div>
          </div>
        </div>

        {/* Limiting Factor Tag */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 12px',
          textAlign: 'right',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Limiting Factor
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: limiting_factor && limiting_factor !== 'none' ? cfg.color : 'var(--text-secondary)',
            marginTop: '2px',
          }}>
            {lfLabel}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          paddingTop: '6px',
        }}>
          {[
            {
              label: 'Min Battery SoC',
              value: metrics.minimum_soc != null ? `${(metrics.minimum_soc * 100).toFixed(1)}%` : '—',
              icon: Battery,
              isHighlight: true,
            },
            {
              label: 'Sunlit Duration',
              value: metrics.sunlit_hours != null ? `${metrics.sunlit_hours}h` : '—',
              icon: Sun,
            },
            {
              label: 'Max Blackout',
              value: metrics.longest_earth_blackout_h != null ? `${metrics.longest_earth_blackout_h}h` : '—',
              icon: Radio,
            },
            {
              label: 'Sunlit Fraction',
              value: metrics.sunlit_fraction != null ? `${(metrics.sunlit_fraction * 100).toFixed(1)}%` : '—',
              icon: Clock,
            },
          ].map(m => {
            const MetricIcon = m.icon
            return (
              <div key={m.label} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-tertiary)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {m.label}
                  </span>
                  <MetricIcon size={14} strokeWidth={1.5} />
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: m.isHighlight && metrics.minimum_soc < 0.20 ? '#EF4444' : 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}>
                  {m.value}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Deterministic Result Hash Provenance */}
      {result_sha256 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '10px',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={13} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
            <span>Deterministic Result SHA-256</span>
          </div>
          <code style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            background: 'rgba(255,255,255,0.03)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            {shaShort}
          </code>
        </div>
      )}
    </div>
  )
}
