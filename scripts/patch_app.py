import re

# Read the current App.jsx
with open(r'C:\Users\athul\.gemini\antigravity\scratch\stellaron\web\src\App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix imports — add CelestialSimulator and HorizonSkyline
old_import = "import SunOrbitSimulator from './components/SunOrbitSimulator'\n\n// Clean pages / windows\n// 'explorer' | 'sun_sim' | 'timeline' | 'energy' | 'nasa' | 'provenance'"
new_import = """import SunOrbitSimulator from './components/SunOrbitSimulator'
import CelestialSimulator from './components/CelestialSimulator'
import HorizonSkyline from './components/HorizonSkyline'

// Clean pages / windows
// 'explorer' | 'celestial' | 'horizon' | 'sun_sim' | 'timeline' | 'energy' | 'nasa'"""

content = content.replace(old_import, new_import)

# 2. Add skylineStep state after activeWindow
old_state = "  const [activeWindow, setActiveWindow] = useState('explorer')\n  const [skylineStep, setSkylineStep] = useState(0)"
new_state = """  const [activeWindow, setActiveWindow] = useState('explorer')
  const [skylineStep, setSkylineStep] = useState(0)"""

# (should already be there from previous edit, check)
if "setSkylineStep" not in content:
    content = content.replace(
        "  const [activeWindow, setActiveWindow] = useState('explorer')",
        "  const [activeWindow, setActiveWindow] = useState('explorer')\n  const [skylineStep, setSkylineStep] = useState(0)"
    )

# 3. Update nav buttons to include celestial & horizon
old_nav = """          { id: 'explorer', label: '🪐 3D Site Explorer', icon: '🪐' },
            { id: 'celestial', label: '☀️🌍 Sun & Earth Simulator', icon: '☀️' },
            { id: 'horizon', label: '🌅 Horizon Skyline', icon: '🌅' },
            { id: 'timeline', label: '📈 Illumination Timeline', icon: '📈' },
            { id: 'energy', label: '⚡ Lander Battery Lab', icon: '⚡' },
            { id: 'nasa', label: '🔬 NASA Cross-Check', icon: '🔬' },"""

# Check what's there now
if "'celestial'" not in content:
    old_nav_check = "{ id: 'explorer', label: '🪐 3D Site Explorer', icon: '🪐' },"
    new_nav = """{ id: 'explorer', label: '🪐 3D Site Explorer', icon: '🪐' },
            { id: 'celestial', label: '☀️🌍 Sun & Earth Simulator', icon: '☀️' },
            { id: 'horizon', label: '🌅 Horizon Skyline', icon: '🌅' },"""
    content = content.replace(old_nav_check, new_nav, 1)

# 4. Add Celestial & Horizon action cards to the explorer grid (before the Timeline button)
old_button = """                    <button
                      onClick={() => setActiveWindow('sun_sim')}"""
new_buttons = """                    <button
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
                      onClick={() => setActiveWindow('sun_sim')}"""

content = content.replace(old_button, new_buttons, 1)

# 5. Add new windows right BEFORE the closing </main> area
# Insert after: {activeWindow === 'sun_sim' block ends (after the closing )}
old_window2_close = """          {/* WINDOW 3: Dedicated Illumination Timeline */}"""
new_windows_inject = """          {/* WINDOW 2b: Dedicated Sun + Earth Dual Celestial Simulator */}
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

          {/* WINDOW 3: Dedicated Illumination Timeline */}"""

content = content.replace(old_window2_close, new_windows_inject, 1)

# Write it back
with open(r'C:\Users\athul\.gemini\antigravity\scratch\stellaron\web\src\App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File is now {len(content.splitlines())} lines.")
print("celestial in content:", "'celestial'" in content)
print("horizon in content:", "'horizon'" in content)
print("HorizonSkyline import:", "HorizonSkyline" in content)
print("CelestialSimulator import:", "CelestialSimulator" in content)
