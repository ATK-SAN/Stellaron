import { useState, useEffect } from 'react'
import SiteSelector from './components/SiteSelector'
import HorizonGlobe from './components/HorizonGlobe'
import TerrainViewer from './components/TerrainViewer'
import TimelinePanel from './components/TimelinePanel'
import EnergyPanel from './components/EnergyPanel'
import ProvenanceBadge from './components/ProvenanceBadge'
import NasaCrossCheckPanel from './components/NasaCrossCheckPanel'
import SunOrbitSimulator from './components/SunOrbitSimulator'
import CelestialSimulator from './components/CelestialSimulator'
import HorizonSkyline from './components/HorizonSkyline'
import OrthographicPolarMap from './components/OrthographicPolarMap'
import MissionPlannerHeadline from './components/MissionPlannerHeadline'
import MissionRehearsal from './components/MissionRehearsal'

// Clean pages / windows
// 'explorer' | 'celestial' | 'horizon' | 'timeline' | 'energy' | 'nasa' | 'provenance'

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [activeWindow, setActiveWindow] = useState('explorer')
  const [skylineStep, setSkylineStep] = useState(0)
  const [view3DMode, setView3DMode] = useState('split') // 'split' | 'globe' | 'terrain'

  // Load library index on mount
  useEffect(() => {
    fetch('/data/library_index.json')
      .then(r => r.json())
      .then(data => {
        setSites(data.sites || [])
        if (data.sites && data.sites.length > 0) {
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
      {/* Top Application Header */}
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

        {/* Global Navigation Guide for Students & Researchers */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '30px' }}>
          {[
            { id: 'explorer', label: '🪐 3D Site Explorer', icon: '🪐' },
            { id: 'celestial', label: '☀️🌍 Sun & Earth Simulator', icon: '☀️' },
            { id: 'horizon', label: '🌅 Horizon Skyline', icon: '🌅' },
            { id: 'timeline', label: '📈 Illumination Timeline', icon: '📈' },
            { id: 'energy', label: '⚡ Lander Battery Lab', icon: '⚡' },
            { id: 'nasa', label: '🔬 NASA Cross-Check', icon: '🔬' },
            { id: 'rehearsal', label: '🛸 Mission Rehearsal', icon: '🛸' },
          ].map(page => (
            <button
              key={page.id}
              onClick={() => setActiveWindow(page.id)}
              style={{
                background: activeWindow === page.id ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeWindow === page.id ? '#38bdf8' : '#94a3b8',
                border: activeWindow === page.id ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                borderRadius: '5px',
                padding: '5px 11px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {page.label}
            </button>
          ))}
        </div>

        {/* NASA SPICE Status Tag */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.66rem',
            color: '#94a3b8',
            fontFamily: 'monospace'
          }}>
            🛰 NASA JPL DE421 SPICE · 100% Offline Static
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="app-body">
        {/* Left Sidebar: Site Selector (Visible across views so user can always switch sites) */}
        <aside className="sidebar" style={{ width: '310px' }}>
          <SiteSelector
            sites={sites}
            selectedSite={selectedSite}
            onSelect={(site) => {
              setSelectedSite(site)
            }}
          />
        </aside>

        {/* Right Main Secluded Workspace */}
        <main className="main-panel">
          {/* WINDOW 1: Dedicated 3D Lunar & Ridge Explorer (Clean visual focus!) */}
          {activeWindow === 'explorer' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              {/* Upper 3D Dual-Viewport: ONLY the Moon Globe & Ridge Model */}
              <div style={{
                position: 'relative',
                height: view3DMode === 'split' ? '370px' : '440px',
                flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: '#070a17'
              }}>
                {/* 3D Viewport Toolbar */}
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
                    Full Globe View
                  </button>
                  <button
                    onClick={() => setView3DMode('terrain')}
                    style={{
                      fontFamily: 'var(--font-ui)',
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
                    Full Ridge/DTM View
                  </button>
                  <button
                    onClick={() => setView3DMode('polar')}
                    style={{
                      fontFamily: 'var(--font-ui)',
                      background: view3DMode === 'polar' ? '#0284c7' : 'transparent',
                      color: view3DMode === 'polar' ? '#fff' : '#94a3b8',
                      border: 'none',
                      padding: '4px 9px',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🧭</span> South Pole Radar
                  </button>
                </div>

                {/* 3D Viewport Content */}
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  {(view3DMode === 'split' || view3DMode === 'globe') && (
                    <div style={{
                      flex: view3DMode === 'split' ? '0 0 44%' : '1',
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

                  {(view3DMode === 'split' || view3DMode === 'terrain') && (
                    <div style={{ flex: '1', height: '100%', position: 'relative' }}>
                      <TerrainViewer site={selectedSite} siteData={siteData} />
                    </div>
                  )}

                  {view3DMode === 'polar' && (
                    <div style={{ flex: '1', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#040714', padding: '10px' }}>
                      <OrthographicPolarMap
                        sites={sites}
                        selectedSite={selectedSite}
                        onSelectSite={setSelectedSite}
                        sunAzDeg={siteData?.time_series?.sun_az_deg?.[0] ?? 0}
                        siteData={siteData}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Lower Section: Simple Site Story & Guide Actions (NO chart clutter!) */}
              <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header row with Title and Essential Numbers */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                        {selectedSite.name}
                      </h2>
                      <span style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700
                      }}>
                        {selectedSite.coverage?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                      Lat: {selectedSite.lat_deg}° · Lon: {selectedSite.lon_deg}° · Elevation: {selectedSite.elevation_m}m · Source: {selectedSite.source}
                    </div>
                  </div>

                  {/* Quick Vital Stats Badges */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>☀️ SUNLIGHT</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                        {((selectedSite.sunlight_fraction ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>🌍 EARTH COMMS</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                        {((selectedSite.geometric_earth_visibility_fraction ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* 10-Second Mission Planner Headline Assessment */}
                <MissionPlannerHeadline site={selectedSite} siteData={siteData} />

                {/* Simple Description for Students & Public */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  lineHeight: 1.5,
                  fontSize: '0.82rem',
                  color: '#e2e8f0'
                }}>
                  <strong style={{ color: '#38bdf8' }}>What is this place? </strong>
                  {selectedSite.simple_description || selectedSite.description}
                </div>

                {/* Why NASA Cares & Fun Fact Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '8px',
                    padding: '12px 16px'
                  }}>
                    <div style={{ color: '#38bdf8', fontSize: '0.74rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🚀</span> Why NASA Cares About This Site
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.45 }}>
                      {selectedSite.why_nasa_cares || 'Key Artemis exploration region studied for persistent solar power and direct radio communications back to Earth.'}
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    borderRadius: '8px',
                    padding: '12px 16px'
                  }}>
                    <div style={{ color: '#fbbf24', fontSize: '0.74rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💡</span> Lunar Fun Fact for Students
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.45 }}>
                      {selectedSite.key_fun_fact || 'The Moon experiences zero atmosphere, meaning temperatures range from scorching +250°F in sunlight to -250°F in shadows.'}
                    </div>
                  </div>
                </div>

                {/* Dedicated Action Guide Buttons: Guide user to secluded windows */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '8px' }}>
                    Select an In-Depth Scientific Tool:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    <button
                      onClick={() => setActiveWindow('celestial')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(56,189,248,0.1) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        ☀️🌍 Sun & Earth Simulator →
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Dual 3D celestial model — real Earth libration loop, DTE comms blackout & camera zoom.
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveWindow('horizon')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        🌅 360° Horizon Skyline →
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Panoramic LOLA terrain silhouette with animated Sun & Earth libration path overlay.
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveWindow('sun_sim')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(251, 191, 36, 0.35)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        ☀️ Live Sun Simulator &rarr;
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Simulate the Sun orbiting around the Moon with time slider & SPICE cross-check.
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveWindow('timeline')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        📈 Illumination Timeline &rarr;
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Day-by-day 720-hour AreaChart of sunlight and Earth line-of-sight passes.
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveWindow('energy')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(52, 211, 153, 0.35)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        ⚡ Lander Battery Lab &rarr;
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Battery State of Charge curve, solar generation Wh, and 20% critical reserve limit.
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveWindow('nasa')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(167, 139, 250, 0.35)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
                        🔬 NASA Science Matrix &rarr;
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Side-by-side comparison with Mazarico (2011), Gläser (2014), and Apollo reports.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WINDOW 2: Dedicated Sun & Orbit Simulator */}
          {activeWindow === 'sun_sim' && selectedSite && (
            <SunOrbitSimulator
              site={selectedSite}
              siteData={siteData}
              onBack={() => setActiveWindow('explorer')}
            />
          )}

          {/* WINDOW 2b: Dedicated Sun + Earth Dual Celestial Simulator */}
          {activeWindow === 'celestial' && selectedSite && (
            <CelestialSimulator
              site={selectedSite}
              siteData={siteData}
              onBack={() => setActiveWindow('explorer')}
            />
          )}

          {/* WINDOW 2c: 360 Degree Panoramic Horizon Skyline */}
          {activeWindow === 'horizon' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711' }}>
              <div style={{
                padding: '10px 18px',
                background: '#070a18',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setActiveWindow('explorer')}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56,189,248,0.3)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to 3D Explorer
                  </button>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                      🌅 360° Panoramic Horizon Skyline · {selectedSite.name}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                      LOLA DTM topographic silhouette with real-time Sun & Earth libration paths — drag the slider to scrub time
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <HorizonSkyline
                  siteData={siteData}
                  site={selectedSite}
                  currentStep={skylineStep}
                />

                {/* Standalone Time Scrubber for Skyline */}
                <div style={{
                  background: 'rgba(7, 10, 24, 0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                    ⏱ Time Scrubber — Drag to Animate Sun & Earth Movement Across the Skyline
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>Day 0 · Apr 1</span>
                    <input
                      type="range"
                      min={0}
                      max={(siteData?.time_series?.times_utc?.length || 1) - 1}
                      value={skylineStep}
                      onChange={e => setSkylineStep(Number(e.target.value))}
                      style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer', height: '6px' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>Day 30 · May 1</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.66rem', color: '#475569', fontFamily: 'monospace' }}>
                      Step {skylineStep + 1} of {siteData?.time_series?.times_utc?.length || '—'} ·
                      UTC: {siteData?.time_series?.times_utc?.[skylineStep]?.slice(0,16).replace('T',' ') || '—'}
                    </span>
                  </div>
                </div>

                {/* Libration Education Card */}
                <div style={{
                  background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  fontSize: '0.76rem',
                  color: '#94a3b8'
                }}>
                  <div>
                    <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '5px', fontSize: '0.78rem' }}>
                      🔵 What is the Earth Libration Loop?
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                      Although the Moon is <strong>tidally locked</strong> to Earth, the Moon's slightly elliptical orbit and 5.14° orbital inclination cause Earth to appear to <strong>wobble</strong> in the lunar sky — tracing a small <strong>figure-8 pattern</strong> (Lissajous) of about ±7° over 27.3 days. For south polar sites, this loop can dip Earth below nearby crater ridges, causing temporary comms blackouts.
                    </p>
                  </div>
                  <div>
                    <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '5px', fontSize: '0.78rem' }}>
                      ☀️ Why Does the Sun Stay Low at the Poles?
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                      The Moon's axial tilt is only <strong>1.54°</strong> — so the Sun never rises more than ≈1.5° above the horizon at the South Pole. It circles around 360° all month, neither setting nor rising high, creating those <strong>permanently lit ridges</strong> and deep <strong>permanently shadowed craters</strong> that might harbour ancient ice deposits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WINDOW 3: Dedicated Illumination Timeline */}
          {activeWindow === 'timeline' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711' }}>
              <div style={{
                padding: '10px 18px',
                background: '#070a18',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  onClick={() => setActiveWindow('explorer')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  &larr; Back to 3D Explorer
                </button>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                    📈 Illumination & Earth Line-of-Sight Timeline · {selectedSite.name}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                    Full 720-hour study interval (2026-04-01 to 2026-05-01) with sub-second transition bisection
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                <TimelinePanel siteData={siteData} site={selectedSite} />
              </div>
            </div>
          )}

          {/* WINDOW 4: Dedicated Lander Battery Lab */}
          {activeWindow === 'energy' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711' }}>
              <div style={{
                padding: '10px 18px',
                background: '#070a18',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  onClick={() => setActiveWindow('explorer')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  &larr; Back to 3D Explorer
                </button>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                    ⚡ Lander Power & Battery Simulation Lab · {selectedSite.name}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                    Simulating 2.5m² solar panel, 1200 Wh battery, 65W nominal lander load, and 20% SoC reserve threshold
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                <EnergyPanel siteData={siteData} site={selectedSite} />
              </div>
            </div>
          )}

          {/* WINDOW 5: Dedicated NASA Cross-Check Matrix */}
          {activeWindow === 'nasa' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711' }}>
              <div style={{
                padding: '10px 18px',
                background: '#070a18',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  onClick={() => setActiveWindow('explorer')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  &larr; Back to 3D Explorer
                </button>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                    🔬 NASA Scientific Literature Cross-Validation Matrix
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                    Comparing STELLARON SPICE calculations with Mazarico (2011), Gläser (2014), and Apollo mission reports
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: '18px 24px', overflowY: 'auto' }}>
                <NasaCrossCheckPanel selectedSite={selectedSite} />
              </div>
            </div>
          )}
          {/* WINDOW 6: Mission Rehearsal */}
          {activeWindow === 'rehearsal' && (
            <MissionRehearsal sites={sites} />
          )}
        </main>
      </div>
    </div>
  )
}
