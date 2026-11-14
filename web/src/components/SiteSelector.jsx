/** SiteSelector.jsx — Flight-Ops Landing Site Selector Panel
 *
 * Restyled with:
 * - One row = Name, mono coordinates, one outlined status chip, one score
 * - Selected row: Electric cyan left border + slightly lighter surface (#1F2937), not filled blue
 * - One chip style for HERO / VERIFIED / LIMITED (small outlined chip with semantic color)
 * - Tiny two-segment sparkline for Sun/Earth visibility
 * - Lucide line icons (Search, Compass, Filter)
 */

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'

function formatCoord(val, posDir, negDir) {
  if (val == null) return '—'
  const abs = Math.abs(val).toFixed(2)
  return `${abs}°${val >= 0 ? posDir : negDir}`
}

function calculateScore(site) {
  const sun = (site.sunlight_fraction ?? 0.4) * 100
  const earth = (site.geometric_earth_visibility_fraction ?? 0.5) * 100
  const slopeSafety = site.landing_safety_score ?? 80
  const score = Math.round(sun * 0.45 + earth * 0.35 + slopeSafety * 0.2)
  return Math.min(99, Math.max(25, score))
}

function StatusChip({ coverage }) {
  if (coverage === 'hero') {
    return <span className="status-chip status-chip-caution">HERO</span>
  }
  if (coverage === 'limited') {
    return <span className="status-chip status-chip-hazard">LIMITED</span>
  }
  return <span className="status-chip status-chip-safe">VERIFIED</span>
}

export default function SiteSelector({ sites = [], selectedSite, onSelect }) {
  const [filter, setFilter] = useState('all') // 'all' | 'artemis' | 'apollo' | 'farside'
  const [search, setSearch] = useState('')

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      if (filter === 'artemis' && site.lat_deg > -80) return false
      if (filter === 'apollo' && !site.id.startsWith('apollo')) return false
      if (filter === 'farside' && site.id !== 'change_4') return false

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
      {/* Top Header: Title & Count */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            Candidate Sites
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-cyan)',
            background: 'var(--color-cyan-subtle)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 600,
          }}>
            {filteredSites.length} of {sites.length}
          </span>
        </div>

        {/* Search Bar with Lucide Search Icon */}
        <div style={{ position: 'relative' }}>
          <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search crater or coordinates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 10px 7px 32px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 150ms ease',
            }}
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="segmented-control" style={{ width: '100%', justifyContent: 'space-between' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'artemis', label: 'Artemis' },
            { id: 'apollo', label: 'Apollo' },
            { id: 'farside', label: 'Far Side' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`segmented-item ${filter === tab.id ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '4px 6px', fontSize: '11px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sites List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {filteredSites.map(site => {
          const isSelected = selectedSite?.id === site.id
          const score = calculateScore(site)
          const sunPct = (site.sunlight_fraction ?? 0) * 100
          const earthPct = (site.geometric_earth_visibility_fraction ?? 0) * 100

          return (
            <div
              key={site.id}
              onClick={() => onSelect(site)}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '4px',
                cursor: 'pointer',
                background: isSelected ? 'var(--color-panel-elevated)' : 'transparent',
                border: isSelected ? '1px solid var(--color-cyan-border)' : '1px solid transparent',
                borderLeft: isSelected ? '3px solid var(--color-cyan)' : '3px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* Row 1: Site Title + Score Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? 'var(--color-cyan)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {site.name}
                </span>

                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: score >= 85 ? 'var(--color-safe)' : score >= 70 ? 'var(--color-caution)' : 'var(--color-hazard)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}>
                  {score}
                </span>
              </div>

              {/* Row 2: Mono Coordinates + Outlined Status Chip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {formatCoord(site.lat_deg, 'N', 'S')}, {formatCoord(site.lon_deg, 'E', 'W')}
                </span>
                <StatusChip coverage={site.coverage} />
              </div>

              {/* Tiny Two-Segment Sparkline for Sun / Earth Coverage */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
                <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${sunPct}%`, height: '100%', background: 'var(--color-caution)' }} title={`Sunlight: ${sunPct.toFixed(0)}%`} />
                </div>
                <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${earthPct}%`, height: '100%', background: 'var(--color-cyan)' }} title={`Earth Comms: ${earthPct.toFixed(0)}%`} />
                </div>
              </div>
            </div>
          )
        })}

        {filteredSites.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            No landing sites match search criteria
          </div>
        )}
      </div>
    </div>
  )
}
