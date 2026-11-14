import re

with open(r'C:\Users\athul\.gemini\antigravity\scratch\stellaron\web\src\App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add new imports if not present
new_imports = """import CelestialSimulator from './components/CelestialSimulator'
import HorizonSkyline from './components/HorizonSkyline'
import OrthographicPolarMap from './components/OrthographicPolarMap'
import MissionPlannerHeadline from './components/MissionPlannerHeadline'"""

content = content.replace(
    "import CelestialSimulator from './components/CelestialSimulator'\nimport HorizonSkyline from './components/HorizonSkyline'",
    new_imports
)

# 2. Add Polar Radar button to 3D Viewport Toolbar
old_toolbar_buttons = """                  <button
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
                    Full Ridge/DTM View
                  </button>"""

new_toolbar_buttons = """                  <button
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
                  </button>"""

content = content.replace(old_toolbar_buttons, new_toolbar_buttons)

# 3. Handle view3DMode === 'polar' rendering in viewport
old_viewport_content = """                  {(view3DMode === 'split' || view3DMode === 'terrain') && (
                    <div style={{ flex: '1', height: '100%', position: 'relative' }}>
                      <TerrainViewer site={selectedSite} siteData={siteData} />
                    </div>
                  )}
                </div>"""

new_viewport_content = """                  {(view3DMode === 'split' || view3DMode === 'terrain') && (
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
                </div>"""

content = content.replace(old_viewport_content, new_viewport_content)

# 4. Insert MissionPlannerHeadline above description in Window 1
old_desc_header = """                {/* Simple Description for Students & Public */}
                <div style={{\n                  background: 'rgba(15, 23, 42, 0.55)',"""

new_desc_header = """                {/* 10-Second Mission Planner Headline Assessment */}
                <MissionPlannerHeadline site={selectedSite} siteData={siteData} />

                {/* Simple Description for Students & Public */}
                <div style={{\n                  background: 'rgba(15, 23, 42, 0.55)',"""

content = content.replace(old_desc_header, new_desc_header)

# 5. Apply font families to headers & stats in App.jsx
content = content.replace(
    '<h2 style={{ margin: 0, fontSize: \'1.25rem\', fontWeight: 800, color: \'#f8fafc\' }}>',
    '<h2 style={{ margin: 0, fontFamily: \'var(--font-display)\', fontSize: \'1.35rem\', fontWeight: 800, color: \'#f8fafc\' }}>'
)

content = content.replace(
    '<div style={{ fontSize: \'1.1rem\', fontWeight: 800, color: \'#fbbf24\' }}>',
    '<div style={{ fontFamily: \'var(--font-display)\', fontSize: \'1.25rem\', fontWeight: 800, color: \'#fbbf24\' }}>'
)

content = content.replace(
    '<div style={{ fontSize: \'1.1rem\', fontWeight: 800, color: \'#38bdf8\' }}>',
    '<div style={{ fontFamily: \'var(--font-display)\', fontSize: \'1.25rem\', fontWeight: 800, color: \'#38bdf8\' }}>'
)

with open(r'C:\Users\athul\.gemini\antigravity\scratch\stellaron\web\src\App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.jsx successfully.")
print("MissionPlannerHeadline included:", "MissionPlannerHeadline" in content)
print("OrthographicPolarMap included:", "OrthographicPolarMap" in content)
print("Polar radar button included:", "South Pole Radar" in content)
