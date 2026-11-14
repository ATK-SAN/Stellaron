/** VerdictBadge.jsx — Large verdict display for Mission Rehearsal results */

const VERDICT_CONFIG = {
  survives: {
    icon: '✓',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    border: 'rgba(52,211,153,0.4)',
    bg: 'rgba(52,211,153,0.07)',
    label: 'SURVIVES',
    text: 'Modelled mission meets all constraints.',
  },
  marginal: {
    icon: '⚠',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.25)',
    border: 'rgba(251,191,36,0.4)',
    bg: 'rgba(251,191,36,0.07)',
    label: 'MARGINAL',
    text: 'Within margin of one or more limits.',
  },
  fails: {
    icon: '✗',
    color: '#f87171',
    glow: 'rgba(248,113,113,0.25)',
    border: 'rgba(248,113,113,0.4)',
    bg: 'rgba(248,113,113,0.07)',
    label: 'FAILS',
    text: 'Modelled mission violates one or more constraints.',
  },
}

const LF_LABELS = {
  none: '—',
  battery_reserve: 'battery reserve',
  earth_blackout: 'Earth blackout',
  sunlit_fraction: 'sunlit fraction',
}

export default function VerdictBadge({ verdict, limiting_factor, result_sha256, provenance, metrics }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.fails
  const lfLabel = LF_LABELS[limiting_factor] || limiting_factor || '—'
  const shaShort = result_sha256 ? result_sha256.slice(0, 12) + '…' : '—'

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: `0 0 24px ${cfg.glow}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Main verdict row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          fontSize: '2.4rem',
          color: cfg.color,
          lineHeight: 1,
          filter: `drop-shadow(0 0 8px ${cfg.glow})`,
        }}>
          {cfg.icon}
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: cfg.color,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '4px' }}>
            {cfg.text}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      {metrics && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'Min SoC', value: metrics.minimum_soc != null ? `${(metrics.minimum_soc * 100).toFixed(1)}%` : '—', unit: '' },
            { label: 'Sunlit', value: metrics.sunlit_hours != null ? `${metrics.sunlit_hours}h` : '—', unit: '' },
            { label: 'Max Earth Blackout', value: metrics.longest_earth_blackout_h != null ? `${metrics.longest_earth_blackout_h}h` : '—', unit: '' },
            { label: 'Sunlit Fraction', value: metrics.sunlit_fraction != null ? `${(metrics.sunlit_fraction * 100).toFixed(1)}%` : '—', unit: '' },
          ].map(m => (
            <div key={m.label} style={{
              background: 'rgba(5,7,17,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '8px 12px',
              textAlign: 'center',
              minWidth: '90px',
            }}>
              <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {m.label}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Limiting factor + provenance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.74rem' }}>
          <span style={{ color: '#64748b' }}>
            Limiting factor: <span style={{ color: cfg.color, fontWeight: 700 }}>{lfLabel}</span>
          </span>
        </div>
        <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
          SHA-256: {shaShort}
        </div>
      </div>

      {/* Provenance model note */}
      {provenance?.model_note && (
        <div style={{
          fontSize: '0.68rem',
          color: '#475569',
          fontStyle: 'italic',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '8px',
        }}>
          ℹ {provenance.model_note}
        </div>
      )}
    </div>
  )
}
