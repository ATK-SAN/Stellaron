import { useState, useMemo } from 'react'

function formatCoord(val, posDir, negDir) {
  if (val == null) return '—'
  const abs = Math.abs(val).toFixed(2)
  return `${abs}°${val >= 0 ? posDir : negDir}`
}

function calculateScore(site) {
  const sun = (site.sunlight_fraction ?? 0.4) * 100
  const earth = (site.geometric_earth_visibility_fraction ?? 0.5) * 100
  const slopeSafety = site.landing_safety_score ?? 80
  // Balanced Mission Feasibility Score
  const score = Math.round(sun * 0.45 + earth * 0.35 + slopeSafety * 0.2)
  return Math.min(99, Math.max(25, score))
}

function CoverageBadge({ coverage }) {
  if (coverage === 'hero') {
    return (
      <span style={{
        background: 'rgba(251, 191, 36, 0.15)',
        color: '#fbbf24',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.04em'
      }}>
        HERO
      </span>
    )
  }
  if (coverage === 'limited') {
    return (
      <span style={{
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.04em'
      }}>
        LIMITED
      </span>
    )
  }
  return (
    <span style={{
      background: 'rgba(56, 189, 248, 0.12)',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '4px',
      padding: '1px 6px',
      fontSize: '0.62rem',
      fontWeight: 600,
      letterSpacing: '0.04em'
    }}>
      VERIFIED
    </span>
  )
}

export default function SiteSelector({ sites, selectedSite, onSelect }) {
  const [filter, setFilter] = useState('all') // 'all' | 'artemis' | 'apollo' | 'farside'
  const [search, setSearch] = useState('')

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      // Category filter
      if (filter === 'artemis' && site.lat_deg > -80) return false
      if (filter === 'apollo' && !site.id.startsWith('apollo')) return false
      if (filter === 'farside' && site.id !== 'change_4') return false

      // Text search
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchName = site.name.toLowerCase().includes(query)
        const matchId = site.id.toLowerCase().includes(query)
        if (!matchName && !matchId) return false
      }
      return true
    })
  }, [sites, filter, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#070a18' }}>
      {/* Search Bar & Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
            Lunar Landing Sites
          </span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8',
            padding: '1px 6px',
            borderRadius: '10px',
            fontWeight: 600
          }}>
            {filteredSites.length} of {sites.length}
          </span>
        </div>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Search crater or coordinates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#f8fafc',
            fontSize: '0.72rem',
            outline: 'none',
            marginBottom: '8px'
          }}
        />

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'artemis', label: 'Artemis' },
            { id: 'apollo', label: 'Apollo' },
            { id: 'farside', label: 'Far Side' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                background: filter === tab.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                color: filter === tab.id ? '#38bdf8' : '#64748b',
                border: filter === tab.id ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.64rem',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sites List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filteredSites.map(site => {
          const isSelected = selectedSite?.id === site.id
          const isLimited = site.coverage === 'limited'
          const score = calculateScore(site)
          const sunPct = ((site.sunlight_fraction ?? 0) * 100).toFixed(0)
          const earthPct = ((site.geometric_earth_visibility_fraction ?? 0) * 100).toFixed(0)

          return (
            <div
              key={site.id}
              onClick={() => onSelect(site)}
              className={isLimited ? 'limited-hatch' : ''}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '6px',
                cursor: 'pointer',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.18) 0%, rgba(30, 41, 59, 0.8) 100%)'
                  : 'rgba(15, 23, 42, 0.45)',
                border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255,255,255,0.04)',
                boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Row 1: Site Title & Score Pill */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', color: isSelected ? '#38bdf8' : '#f1f5f9', lineHeight: 1.25 }}>
                  {site.name}
                </div>
                <div style={{
                  background: score >= 85 ? 'rgba(34, 197, 94, 0.15)' : score >= 70 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: score >= 85 ? '#4ade80' : score >= 70 ? '#fbbf24' : '#f87171',
                  border: `1px solid ${score >= 85 ? 'rgba(34, 197, 94, 0.3)' : score >= 70 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '4px',
                  padding: '1px 5px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {score}
                </div>
              </div>

              {/* Row 2: Badges and Coordinates */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.66rem', color: '#64748b', fontFamily: 'monospace' }}>
                  {formatCoord(site.lat_deg, 'N', 'S')}, {formatCoord(site.lon_deg, 'E', 'W')}
                </div>
                <CoverageBadge coverage={site.coverage} />
              </div>

              {/* Row 3: Visual Gauges (Sunlight & Earth Line of Sight) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Sun Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8', marginBottom: '2px' }}>
                    <span>☀️ Sun</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>{sunPct}%</span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${sunPct}%`, height: '100%', background: '#fbbf24' }} />
                  </div>
                </div>

                {/* Earth Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8', marginBottom: '2px' }}>
                    <span>🌍 Earth</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{earthPct}%</span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${earthPct}%`, height: '100%', background: '#38bdf8' }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filteredSites.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.74rem' }}>
            No landing sites match query
          </div>
        )}
      </div>
    </div>
  )
}
