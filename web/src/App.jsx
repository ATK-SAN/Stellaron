/** App.jsx — STELLARON Mission Control Dashboard (NASA Space Apps 2026)
 *
 * Restyled with:
 * - Slim left icon rail navigation (56px) replacing the cluttered 8-tab top bar
 * - Minimal top bar holding only: STELLARON wordmark, mission context, live UTC clock, data status
 * - 3-Column Layout: Left Rail + Site List (280px) | Center Hero 3D Viewport | Right Contextual Site Panel (340px)
 * - Deep space #05070D base with layered #111827 panels, borders rgba(255,255,255,0.08)
 * - Electric cyan #22D3EE as single accent
 * - Zero overflow or clipping at 1366px width
 * - Lucide line icons throughout (zero emojis)
 */

import { useState, useEffect } from 'react'
import {
  Compass,
  Sun,
  Mountain,
  Activity,
  BatteryCharging,
  CheckSquare,
  Rocket,
  Globe,
  Layers,
  ChevronLeft,
  Sliders,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react'
import SiteSelector from './components/SiteSelector'
import HorizonGlobe from './components/HorizonGlobe'
import TerrainViewer from './components/TerrainViewer'
import TimelinePanel from './components/TimelinePanel'
import EnergyPanel from './components/EnergyPanel'
import NasaCrossCheckPanel from './components/NasaCrossCheckPanel'
import SunOrbitSimulator from './components/SunOrbitSimulator'
import CelestialSimulator from './components/CelestialSimulator'
import HorizonSkyline from './components/HorizonSkyline'
import OrthographicPolarMap from './components/OrthographicPolarMap'
import ContextualSitePanel from './components/ContextualSitePanel'
import MissionRehearsal from './components/MissionRehearsal'

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [activeWindow, setActiveWindow] = useState('explorer')
  const [skylineStep, setSkylineStep] = useState(0)
  const [view3DMode, setView3DMode] = useState('split') // 'split' | 'globe' | 'terrain' | 'polar'
  const [missionSlipDays, setMissionSlipDays] = useState(0)
  const [utcTime, setUtcTime] = useState(() => new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC')

  // Live Mission Control UTC Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC')
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load candidate sites library on mount
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

  // Load site precomputed ephemeris data when selection changes
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

  // Navigation rail definition
  const navItems = [
    { id: 'explorer', label: '3D Site Explorer', icon: Compass },
    { id: 'celestial', label: 'Sun & Earth Simulator', icon: Sun },
    { id: 'horizon', label: 'Horizon Skyline', icon: Mountain },
    { id: 'timeline', label: 'Illumination Timeline', icon: Activity },
    { id: 'energy', label: 'Lander Battery Lab', icon: BatteryCharging },
    { id: 'nasa', label: 'NASA Cross-Check', icon: CheckSquare },
    { id: 'rehearsal', label: 'Mission Rehearsal', icon: Rocket },
  ]

  const handleLaunchRehearsal = (site) => {
    if (site) setSelectedSite(site)
    setActiveWindow('rehearsal')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* ── Top Bar: Wordmark, Mission Context, Clock, Status Dot ── */}
      <header style={{
        height: '48px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        zIndex: 30,
      }}>
        {/* Left: STELLARON Wordmark + Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-cyan)',
            color: '#05070D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 0 14px rgba(34, 211, 238, 0.4)',
          }}>
            S
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.10em', color: 'var(--text-primary)' }}>
              STELLARON
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              Lunar Landing Site Navigator · NASA Space Apps 2026
            </span>
          </div>
        </div>

        {/* Right: Live UTC Clock + Data Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            <Clock size={13} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
            <span>{utcTime}</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 10px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-safe)', boxShadow: '0 0 8px var(--color-safe)' }} />
            <span>JPL DE421 SPICE · ONLINE</span>
          </div>
        </div>
      </header>

      {/* ── Main Workspace: Left Slim Rail + Context ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Slim Left Icon Rail (56px Width) */}
        <nav style={{
          width: '56px',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: '8px',
          flexShrink: 0,
          zIndex: 25,
        }}>
          {navItems.map(item => {
            const ItemIcon = item.icon
            const isActive = activeWindow === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveWindow(item.id)}
                title={item.label}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--color-panel-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--color-cyan-border)' : '1px solid transparent',
                  borderLeft: isActive ? '3px solid var(--color-cyan)' : '3px solid transparent',
                  color: isActive ? 'var(--color-cyan)' : 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  position: 'relative',
                }}
              >
                <ItemIcon size={18} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            )
          })}
        </nav>

        {/* ── VIEWPORT CONTENT ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* WINDOW 1: 3D Site Explorer (3-Column Layout: Site List | Full-Bleed 3D | Context Panel) */}
          {activeWindow === 'explorer' && selectedSite && (
            <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
              {/* Column 1: Site Selector (280px) */}
              <aside style={{ width: '280px', flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                <SiteSelector
                  sites={sites}
                  selectedSite={selectedSite}
                  onSelect={(site) => setSelectedSite(site)}
                />
              </aside>

              {/* Column 2: Center Full-Bleed 3D Viewport Hero */}
              <main style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden', background: '#05070D' }}>
                {/* Floating Viewport Mode Selector (Glass Panel, 12px margin) */}
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 15,
                  pointerEvents: 'none',
                }}>
                  <div className="segmented-control" style={{ pointerEvents: 'auto', background: 'var(--color-panel-glass)', backdropFilter: 'blur(8px)' }}>
                    <button
                      onClick={() => setView3DMode('split')}
                      className={`segmented-item ${view3DMode === 'split' ? 'active' : ''}`}
                    >
                      <Layers size={13} strokeWidth={1.5} />
                      <span>Split 3D</span>
                    </button>
                    <button
                      onClick={() => setView3DMode('globe')}
                      className={`segmented-item ${view3DMode === 'globe' ? 'active' : ''}`}
                    >
                      <Globe size={13} strokeWidth={1.5} />
                      <span>Moon Globe</span>
                    </button>
                    <button
                      onClick={() => setView3DMode('terrain')}
                      className={`segmented-item ${view3DMode === 'terrain' ? 'active' : ''}`}
                    >
                      <Mountain size={13} strokeWidth={1.5} />
                      <span>Ridge DTM</span>
                    </button>
                    <button
                      onClick={() => setView3DMode('polar')}
                      className={`segmented-item ${view3DMode === 'polar' ? 'active' : ''}`}
                    >
                      <Compass size={13} strokeWidth={1.5} />
                      <span>Polar Radar</span>
                    </button>
                  </div>
                </div>

                {/* 3D Viewport Content */}
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  {(view3DMode === 'split' || view3DMode === 'globe') && (
                    <div style={{
                      flex: view3DMode === 'split' ? '0 0 46%' : '1',
                      height: '100%',
                      position: 'relative',
                      borderRight: view3DMode === 'split' ? '1px solid var(--color-border)' : 'none',
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
                    <div style={{ flex: '1', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070D', padding: '16px' }}>
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
              </main>

              {/* Column 3: Contextual Site Details Panel (340px) */}
              <ContextualSitePanel
                site={selectedSite}
                siteData={siteData}
                delayDays={missionSlipDays}
                onDelayChange={setMissionSlipDays}
                onLaunchRehearsal={handleLaunchRehearsal}
              />
            </div>
          )}

          {/* WINDOW 2: Dedicated Sun & Earth Celestial Simulator */}
          {activeWindow === 'celestial' && selectedSite && (
            <div style={{ flex: 1, height: '100%', position: 'relative' }}>
              <CelestialSimulator
                site={selectedSite}
                siteData={siteData}
                onBack={() => setActiveWindow('explorer')}
              />
            </div>
          )}

          {/* WINDOW 3: 360° Horizon Skyline */}
          {activeWindow === 'horizon' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
              <div style={{
                padding: '12px 20px',
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setActiveWindow('explorer')} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                    <ChevronLeft size={14} />
                    <span>Back to Explorer</span>
                  </button>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      360° Panoramic Horizon Skyline · {selectedSite.name}
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      LOLA DTM topographic silhouette with real-time Sun & Earth libration path intersection.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <HorizonSkyline
                  siteData={siteData}
                  site={selectedSite}
                  currentStep={skylineStep}
                />

                {/* Scrubber Card */}
                <div style={{
                  background: 'var(--color-panel)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Time Scrubber — Animate Celestial Motion
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-cyan)' }}>
                      UTC: {siteData?.time_series?.times_utc?.[skylineStep]?.slice(0, 16).replace('T', ' ') || '—'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Apr 01</span>
                    <input
                      type="range"
                      min={0}
                      max={(siteData?.time_series?.times_utc?.length || 1) - 1}
                      value={skylineStep}
                      onChange={e => setSkylineStep(Number(e.target.value))}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>May 01</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WINDOW 4: Illumination Timeline Panel */}
          {activeWindow === 'timeline' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
              <div style={{
                padding: '12px 20px',
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
              }}>
                <button onClick={() => setActiveWindow('explorer')} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  <ChevronLeft size={14} />
                  <span>Back to Explorer</span>
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Illumination & Earth Visibility Timeline · {selectedSite.name}
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    720-hour study interval with sub-second bisection for eclipse transitions.
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <TimelinePanel siteData={siteData} site={selectedSite} />
              </div>
            </div>
          )}

          {/* WINDOW 5: Lander Battery Simulation Lab */}
          {activeWindow === 'energy' && selectedSite && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
              <div style={{
                padding: '12px 20px',
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
              }}>
                <button onClick={() => setActiveWindow('explorer')} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  <ChevronLeft size={14} />
                  <span>Back to Explorer</span>
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Lander Power & Battery Simulation Lab · {selectedSite.name}
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    2.5 m² solar array, 1,200 Wh battery capacity, 65 W nominal load, 20% reserve floor.
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <EnergyPanel siteData={siteData} site={selectedSite} />
              </div>
            </div>
          )}

          {/* WINDOW 6: NASA Cross-Check Matrix */}
          {activeWindow === 'nasa' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
              <div style={{
                padding: '12px 20px',
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
              }}>
                <button onClick={() => setActiveWindow('explorer')} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  <ChevronLeft size={14} />
                  <span>Back to Explorer</span>
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    NASA Scientific Literature Cross-Validation Matrix
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Independent verification against Mazarico (2011), Gläser (2014), and Apollo mission surface reports.
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <NasaCrossCheckPanel selectedSite={selectedSite} />
              </div>
            </div>
          )}

          {/* WINDOW 7: Mission Rehearsal & Flight Playback */}
          {activeWindow === 'rehearsal' && (
            <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              <MissionRehearsal sites={sites} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
