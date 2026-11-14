import { useState, useEffect } from 'react'
import SiteSelector from './components/SiteSelector'
import HorizonGlobe from './components/HorizonGlobe'
import TerrainViewer from './components/TerrainViewer'
import TimelinePanel from './components/TimelinePanel'
import EnergyPanel from './components/EnergyPanel'
import ProvenanceBadge from './components/ProvenanceBadge'
import NasaCrossCheckPanel from './components/NasaCrossCheckPanel'

const TABS = [
  { id: 'overview', label: '🚀 Mission Overview', icon: '🚀' },
  { id: 'nasa', label: '🔬 NASA Cross-Check', icon: '🔬' },
  { id: 'timeline', label: '📈 Illumination & Comms', icon: '📈' },
  { id: 'energy', label: '⚡ Energy & Battery', icon: '⚡' },
  { id: 'provenance', label: '🔐 SPICE Provenance', icon: '🔐' },
]

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [libraryMeta, setLibraryMeta] = useState(null)
  const [view3DMode, setView3DMode] = useState('split') // 'split' | 'globe' | 'terrain'

  // Load library index on mount
  useEffect(() => {
    fetch('/data/library_index.json')
      .then(r => r.json())
      .then(data => {
        setSites(data.sites || [])
        setLibraryMeta(data)
        if (data.sites && data.sites.length > 0) {
          // Default to high-profile Artemis site
          const defaultSite = data.sites.find(s => s.id === 'shackleton_connecting_ridge') || data.sites[0]
          setSelectedSite(defaultSite)
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
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#050711' }}>
      {/* Top Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(56,189,248,0.4)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px'
          }}>
            ⬡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.12em', color: '#f8fafc' }}>
              STELLARON
            </h1>
            <div style={{ fontSize: '0.62rem', color: '#38bdf8', letterSpacing: '0.04em', fontWeight: 600 }}>
              LUNAR LANDING SITE NAVIGATOR · NASA SPACE APPS 2026
            </div>
          </div>
        </div>

        {/* Global Status Pills */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('nasa')}
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#4ade80',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '0.66rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>✓</span> NASA Verified Data Matrix
          </button>

          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.66rem',
            color: '#94a3b8',
            fontFamily: 'monospace'
          }}>
            🛰 JPL DE421 SPICE · MOON_ME
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.66rem',
            color: '#cbd5e1'
          }}>
            Study: <strong>2026-04-01 &rarr; 2026-05-01</strong>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="app-body">
        {/* Left Sidebar: Site Selector */}
        <aside className="sidebar" style={{ width: '310px' }}>
          <SiteSelector
            sites={sites}
            selectedSite={selectedSite}
            onSelect={(site) => {
              setSelectedSite(site)
            }}
          />
        </aside>

        {/* Right Main Panel */}
        <main className="main-panel">
          {/* Top 3D Viewport Controls & Canvas */}
          <div style={{
            position: 'relative',
            height: view3DMode === 'split' ? '320px' : '380px',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#070a17'
          }}>
            {/* View Mode Toolbar */}
            <div style={{
              position: 'absolute',
              top: 10,
              right: 12,
              zIndex: 10,
              display: 'flex',
              gap: '4px',
              background: 'rgba(6, 11, 25, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '3px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <button
                onClick={() => setView3DMode('split')}
                style={{
                  background: view3DMode === 'split' ? '#0284c7' : 'transparent',
                  color: view3DMode === 'split' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 9px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Split 3D
              </button>
              <button
                onClick={() => setView3DMode('globe')}
                style={{
                  background: view3DMode === 'globe' ? '#0284c7' : 'transparent',
                  color: view3DMode === 'globe' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 9px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Globe View
              </button>
              <button
                onClick={() => setView3DMode('terrain')}
                style={{
                  background: view3DMode === 'terrain' ? '#0284c7' : 'transparent',
                  color: view3DMode === 'terrain' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 9px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Surface DTM (All 14)
              </button>
            </div>

            {/* Viewport Content */}
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {/* Globe Viewport */}
              {(view3DMode === 'split' || view3DMode === 'globe') && (
                <div style={{
                  flex: view3DMode === 'split' ? '0 0 42%' : '1',
                  height: '100%',
                  position: 'relative',
                  borderRight: view3DMode === 'split' ? '1px solid rgba(255,255,255,0.08)' : 'none'
                }}>
                  <HorizonGlobe
                    sites={sites}
                    selectedSite={selectedSite}
                    onSelect={setSelectedSite}
                  />
                </div>
              )}

              {/* Surface Terrain Viewport */}
              {(view3DMode === 'split' || view3DMode === 'terrain') && (
                <div style={{ flex: '1', height: '100%', position: 'relative' }}>
                  <TerrainViewer site={selectedSite} siteData={siteData} />
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation Row */}
          <div className="tabs-row" style={{ background: '#090d1f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{tab.label}</span>
              </button>
            ))}

            {selectedSite && (
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                paddingRight: '16px',
                fontSize: '0.74rem',
                color: '#94a3b8'
              }}>
                {loadingData ? (
                  <span style={{ color: '#38bdf8' }}>⏳ Loading scientific telemetry…</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
                    <strong style={{ color: '#f1f5f9' }}>{selectedSite.name}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lower Content Deck */}
          <div className="tab-content" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#050711' }}>
            {selectedSite && siteData && (
              <>
                {/* 1. Overview & Feasibility Card */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Hero Site KPI Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px'
                    }}>
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        border: '1px solid rgba(251, 191, 36, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                          ☀️ Total Sunlight
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>
                          {((siteData?.metrics?.sunlight?.sunlight_fraction ?? 0) * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          {(siteData?.metrics?.sunlight?.total_sunlight_s / 3600).toFixed(1)} hours daylight
                        </div>
                      </div>

                      <div style={{
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                          🌍 Direct Earth Comms
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                          {((siteData?.metrics?.geometric_earth_visibility?.visibility_fraction ?? 0) * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          Geometric Line-of-Sight
                        </div>
                      </div>

                      <div style={{
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                          🌑 Max Darkness Run
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>
                          {(siteData?.metrics?.sunlight?.longest_dark_run_s / 3600).toFixed(1)}h
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          Continuous night endurance
                        </div>
                      </div>

                      <div style={{
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        border: '1px solid rgba(52, 211, 153, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                          🔋 Min Battery SoC
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (siteData?.metrics?.energy?.min_soc ?? 0) < 0.2 ? '#f87171' : '#34d399' }}>
                          {((siteData?.metrics?.energy?.min_soc ?? 0) * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          {(siteData?.metrics?.energy?.deficit_intervals?.length ?? 0)} deficit interval(s)
                        </div>
                      </div>
                    </div>

                    {/* Regional Description & Mission Context */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                          About {selectedSite.name}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                          Source: {selectedSite.source}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        {selectedSite.description || 'Candidate exploration region analyzed for the NASA Artemis III human return mission, focusing on sustained solar energy capture on high topographic ridges and direct-to-Earth communication links.'}
                      </p>
                    </div>

                    {/* Quick Link to NASA Validation Matrix */}
                    <div style={{
                      background: 'rgba(14, 165, 233, 0.08)',
                      border: '1px dashed rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📊</span>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc' }}>
                            Inspect Peer-Reviewed NASA Literature Cross-Check
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            Compare STELLARON SPICE calculations side-by-side with Mazarico (2011), Gläser (2014), and Apollo SP-238 data.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('nasa')}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Open Matrix &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. NASA Cross-Check Matrix Tab */}
                {activeTab === 'nasa' && (
                  <NasaCrossCheckPanel selectedSite={selectedSite} />
                )}

                {/* 3. Timeline Chart Tab */}
                {activeTab === 'timeline' && (
                  <TimelinePanel siteData={siteData} site={selectedSite} />
                )}

                {/* 4. Energy & Battery Tab */}
                {activeTab === 'energy' && (
                  <EnergyPanel siteData={siteData} site={selectedSite} />
                )}

                {/* 5. Provenance Tab */}
                {activeTab === 'provenance' && (
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
