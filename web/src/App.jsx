import { useState, useEffect } from 'react'
import SiteSelector from './components/SiteSelector'
import HorizonGlobe from './components/HorizonGlobe'
import TerrainViewer from './components/TerrainViewer'
import TimelinePanel from './components/TimelinePanel'
import EnergyPanel from './components/EnergyPanel'
import ProvenanceBadge from './components/ProvenanceBadge'

const TABS = ['Timeline', 'Energy', 'Provenance']

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [activeTab, setActiveTab] = useState('Timeline')
  const [libraryMeta, setLibraryMeta] = useState(null)

  // Load library index on mount
  useEffect(() => {
    fetch('/data/library_index.json')
      .then(r => r.json())
      .then(data => {
        setSites(data.sites || [])
        setLibraryMeta(data)
        // Auto-select first site
        if (data.sites && data.sites.length > 0) {
          setSelectedSite(data.sites[0])
        }
      })
      .catch(err => console.error('Failed to load library_index.json', err))
  }, [])

  // Load site data when selection changes
  useEffect(() => {
    if (!selectedSite) return
    setLoadingData(true)
    setSiteData(null)
    const url = `/data/${selectedSite.id}_2026.json`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setSiteData(data)
        setLoadingData(false)
      })
      .catch(err => {
        console.error(`Failed to load site data: ${url}`, err)
        setLoadingData(false)
      })
  }, [selectedSite])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header className="app-header">
        <div>
          <h1>⬡ STELLARON</h1>
        </div>
        <span className="subtitle">Lunar Landing Site Navigator · NASA Space Apps 2026</span>
        {libraryMeta && (
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {sites.length} sites · Study period {libraryMeta.study_interval?.start_utc?.slice(0,10)} → {libraryMeta.study_interval?.end_utc?.slice(0,10)}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Left sidebar */}
        <aside className="sidebar">
          <SiteSelector
            sites={sites}
            selectedSite={selectedSite}
            onSelect={site => {
              setSelectedSite(site)
              setActiveTab('Timeline')
            }}
          />
        </aside>

        {/* Main content */}
        <main className="main-panel">
          {/* Top row: Globe + Terrain */}
          <div className="top-row">
            <div className="globe-container">
              <HorizonGlobe
                sites={sites}
                selectedSite={selectedSite}
                onSelect={setSelectedSite}
              />
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                fontSize: '0.6rem', color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}>
                Drag to rotate · Scroll to zoom
              </div>
            </div>
            <div className="terrain-container">
              <TerrainViewer site={selectedSite} siteData={siteData} />
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs-row">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'Timeline' && '📈 '}
                {tab === 'Energy' && '⚡ '}
                {tab === 'Provenance' && '🔬 '}
                {tab}
              </button>
            ))}
            {selectedSite && (
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                paddingRight: 16,
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                {loadingData
                  ? '⏳ Loading data…'
                  : siteData
                    ? `✓ ${selectedSite.name}`
                    : ''}
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="tab-content">
            {!selectedSite && (
              <div className="empty-state">
                <span className="icon">🌙</span>
                <span>Select a lunar site from the sidebar to begin</span>
              </div>
            )}

            {selectedSite && loadingData && (
              <div className="loading-state">Loading site data…</div>
            )}

            {selectedSite && !loadingData && siteData && (
              <>
                {activeTab === 'Timeline' && (
                  <TimelinePanel siteData={siteData} site={selectedSite} />
                )}
                {activeTab === 'Energy' && (
                  <EnergyPanel siteData={siteData} site={selectedSite} />
                )}
                {activeTab === 'Provenance' && (
                  <ProvenanceBadge siteData={siteData} site={selectedSite} />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
