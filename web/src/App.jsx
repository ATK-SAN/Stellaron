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

import { useState, useEffect, lazy, Suspense } from 'react'
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
  CircleHelp,
} from 'lucide-react'

const QuickTour = lazy(() => import('./components/QuickTour'))
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

function WorkspaceNoSiteState({ title, description, onReturnToExplorer, sites, onSelectSite }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--color-bg)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(34, 211, 238, 0.08)',
        border: '1px solid var(--color-border-cyan)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        color: 'var(--color-cyan)',
      }}>
        <Compass size={32} strokeWidth={1.5} />
      </div>
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '18px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}>
        {title || 'No Landing Site Selected'}
      </h3>
      <p style={{
        margin: '0 0 24px 0',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        maxWidth: '420px',
        lineHeight: 1.5,
      }}>
        {description || 'Choose a landing site from the candidate library to view its telemetry and simulations.'}
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={onReturnToExplorer}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Compass size={15} strokeWidth={1.5} />
          <span>Return to Explorer</span>
        </button>
        {sites && sites.length > 0 && onSelectSite && (
          <select
            onChange={(e) => {
              const s = sites.find(x => x.id === e.target.value)
              if (s) onSelectSite(s)
            }}
            defaultValue=""
            style={{
              background: 'var(--color-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>Or pick a site here…</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

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
  const [tourOpen, setTourOpen] = useState(false)

  // Live Mission Control UTC Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC')
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Pressing Esc deselects current site
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedSite(null)
        setSiteData(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Toggle selection: click again or choose a site
  const handleSelectSite = (site) => {
    if (!site) {
      setSelectedSite(null)
      setSiteData(null)
      return
    }
    setSelectedSite(prev => {
      if (prev?.id === site.id) {
        setSiteData(null)
        return null
      }
      return site
    })
  }

  // Load candidate sites library on mount (no default selection; deep link ?site=<id> supported)
  useEffect(() => {
    fetch('/data/library_index.json')
      .then(r => r.json())
      .then(data => {
        const loadedSites = data.sites || []
        setSites(loadedSites)
        try {
          const params = new URLSearchParams(window.location.search)
          const siteParam = params.get('site')
          if (siteParam && loadedSites.length > 0) {
            const match = loadedSites.find(s => s.id === siteParam)
            if (match) {
              setSelectedSite(match)
            }
          }
        } catch (e) {
          // ignore
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
        {/* Left: STELLARON Wordmark + Context (Clickable link back to Intro page) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            window.history.pushState({}, '', '/')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', cursor: 'pointer' }}
          title="Return to STELLARON Mission Briefing (Intro Page)"
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#0F1524',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 0 12px rgba(34, 211, 238, 0.25)',
            flexShrink: 0,
          }}>
            <img
              src="/brand/stellaron-mark-32.png"
              srcSet="/brand/stellaron-mark-32.png 1x, /brand/stellaron-mark-64.png 2x, /brand/stellaron-mark-128.png 3x"
              alt="STELLARON"
              width="28"
              height="28"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.10em', color: 'var(--text-primary)' }}>
              STELLARON
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              Lunar Landing Site Navigator · NASA Space Apps 2026
            </span>
          </div>
        </a>

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

          {/* Quick Tour button */}
          <button
            onClick={() => setTourOpen(true)}
            title="Quick tour (?)"
            aria-label="Open dashboard quick tour"
            data-tour-trigger="true"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <CircleHelp size={13} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
            <span>?</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace: Left Slim Rail + Context ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Slim Left Icon Rail (56px Width) */}
        <nav
          data-tour="rail"
          style={{
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
          {activeWindow === 'explorer' && (
            <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
              {/* Column 1: Site Selector (280px) */}
              <aside data-tour="site-list" style={{ width: '280px', flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                <SiteSelector
                  sites={sites}
                  selectedSite={selectedSite}
                  onSelect={handleSelectSite}
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
                  <div data-tour="viewport-tabs" className="segmented-control" style={{ pointerEvents: 'auto', background: 'var(--color-panel-glass)', backdropFilter: 'blur(8px)' }}>
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
                        onSelect={handleSelectSite}
                      />
                    </div>
                  )}

                  {(view3DMode === 'split' || view3DMode === 'terrain') && (
                    <div style={{ flex: '1', height: '100%', position: 'relative' }}>
                      {selectedSite ? (
                        <TerrainViewer site={selectedSite} siteData={siteData} />
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          width: '100%',
                          background: 'rgba(5, 7, 13, 0.85)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '24px',
                          textAlign: 'center',
                        }}>
                          <Mountain size={36} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                            No Site Selected
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.5 }}>
                            Select a candidate landing site from the left list or 3D globe to stream its LOLA topographic mesh.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {view3DMode === 'polar' && (
                    <div style={{ flex: '1', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070D', padding: '16px' }}>
                      <OrthographicPolarMap
                        sites={sites}
                        selectedSite={selectedSite}
                        onSelectSite={handleSelectSite}
                        sunAzDeg={siteData?.time_series?.sun_az_deg?.[0] ?? 0}
                        siteData={siteData}
                        onSwitchToGlobe={() => setView3DMode('globe')}
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
          {activeWindow === 'celestial' && (
            selectedSite ? (
              <div style={{ flex: 1, height: '100%', position: 'relative' }}>
                <CelestialSimulator
                  site={selectedSite}
                  siteData={siteData}
                  onBack={() => setActiveWindow('explorer')}
                />
              </div>
            ) : (
              <WorkspaceNoSiteState
                title="Sun & Earth Celestial Simulator"
                description="Select a candidate lunar site to simulate its real-time solar elevation and direct-to-Earth libration paths."
                onReturnToExplorer={() => setActiveWindow('explorer')}
                sites={sites}
                onSelectSite={handleSelectSite}
              />
            )
          )}

          {/* WINDOW 3: 360° Horizon Skyline */}
          {activeWindow === 'horizon' && (
            selectedSite ? (
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
            ) : (
              <WorkspaceNoSiteState
                title="360° Panoramic Horizon Skyline"
                description="Select a candidate lunar site to generate its LOLA topographic silhouette and solar occultation profile."
                onReturnToExplorer={() => setActiveWindow('explorer')}
                sites={sites}
                onSelectSite={handleSelectSite}
              />
            )
          )}

          {/* WINDOW 4: Illumination Timeline Panel */}
          {activeWindow === 'timeline' && (
            selectedSite ? (
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
            ) : (
              <WorkspaceNoSiteState
                title="Illumination & Earth Visibility Timeline"
                description="Select a candidate lunar site to analyze its 720-hour light and communications timeline."
                onReturnToExplorer={() => setActiveWindow('explorer')}
                sites={sites}
                onSelectSite={handleSelectSite}
              />
            )
          )}

          {/* WINDOW 5: Lander Battery Simulation Lab */}
          {activeWindow === 'energy' && (
            selectedSite ? (
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
            ) : (
              <WorkspaceNoSiteState
                title="Lander Power & Battery Simulation Lab"
                description="Select a candidate lunar site to evaluate solar generation and battery state-of-charge over the study period."
                onReturnToExplorer={() => setActiveWindow('explorer')}
                sites={sites}
                onSelectSite={handleSelectSite}
              />
            )
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

      {/* Quick Tour (lazy-loaded, zero bundle impact on first load) */}
      <Suspense fallback={null}>
        <QuickTour
          isOpen={tourOpen}
          onOpen={() => setTourOpen(true)}
          onClose={() => setTourOpen(false)}
        />
      </Suspense>
    </div>
  )
}
