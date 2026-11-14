function formatCoord(val, posDir, negDir) {
  if (val == null) return '—'
  const abs = Math.abs(val).toFixed(4)
  return `${abs}° ${val >= 0 ? posDir : negDir}`
}

function CoverageLabel({ coverage }) {
  const map = {
    hero: { label: 'HERO', cls: 'coverage-hero' },
    verified: { label: 'VERIFIED', cls: 'coverage-verified' },
    standard: { label: 'STANDARD', cls: 'coverage-standard' },
    limited: { label: 'LIMITED', cls: 'coverage-limited' },
  }
  const entry = map[coverage] || { label: coverage?.toUpperCase() || '?', cls: 'coverage-limited' }
  return (
    <span className={`coverage-badge ${entry.cls}`}>
      {entry.label}
    </span>
  )
}

function SunBar({ fraction }) {
  const pct = (fraction * 100).toFixed(1)
  const color = fraction > 0.4 ? 'var(--success)' : fraction > 0.2 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 50, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden'
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>☀ {pct}%</span>
    </div>
  )
}

function EarthBar({ fraction }) {
  const pct = (fraction * 100).toFixed(1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 50, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden'
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>🌍 {pct}%</span>
    </div>
  )
}

export default function SiteSelector({ sites, selectedSite, onSelect }) {
  return (
    <>
      <div className="site-selector-header">
        {sites.length} Lunar Sites
      </div>
      {sites.map(site => {
        const isSelected = selectedSite?.id === site.id
        const isLimited = site.coverage === 'limited'
        return (
          <div
            key={site.id}
            className={`site-item ${isSelected ? 'selected' : ''} ${isLimited ? 'limited-hatch' : ''}`}
            onClick={() => onSelect(site)}
          >
            <div className="site-item-name">
              {site.name}
              <CoverageLabel coverage={site.coverage} />
            </div>
            <div className="site-item-coords">
              {formatCoord(site.lat_deg, 'N', 'S')} · {formatCoord(site.lon_deg, 'E', 'W')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <SunBar fraction={site.sunlight_fraction ?? 0} />
              <EarthBar fraction={site.geometric_earth_visibility_fraction ?? 0} />
            </div>
          </div>
        )
      })}
    </>
  )
}
