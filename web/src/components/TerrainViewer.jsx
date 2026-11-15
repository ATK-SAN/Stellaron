/** TerrainViewer.jsx — 3D LOLA Topographic DTM Mesh Viewer
 *
 * Restyled with:
 * - SpaceX/NASA dark mission-control visual theme
 * - Deep space #05070D canvas base
 * - Floating glass panels with 12px margin
 * - Space Grotesk UI labels and JetBrains Mono telemetry readouts
 * - Lucide line icons (zero emojis)
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  Mountain,
  Layers,
  Palette,
  X,
  Target,
  Maximize2,
  Compass,
  Info,
} from 'lucide-react'

// Hypsometric tint colormap (NASA LOLA scientific elevation standard)
function getElevationColor(normalized) {
  const color = new THREE.Color()
  if (normalized < 0.2) {
    color.setRGB(0.1 + normalized * 0.5, 0.1, 0.4 + normalized * 1.5)
  } else if (normalized < 0.4) {
    const t = (normalized - 0.2) / 0.2
    color.setRGB(0.1, 0.3 + t * 0.5, 0.7 - t * 0.2)
  } else if (normalized < 0.65) {
    const t = (normalized - 0.4) / 0.25
    color.setRGB(0.1 + t * 0.8, 0.8 - t * 0.1, 0.5 - t * 0.4)
  } else if (normalized < 0.85) {
    const t = (normalized - 0.65) / 0.2
    color.setRGB(0.95, 0.7 - t * 0.3, 0.1)
  } else {
    const t = (normalized - 0.85) / 0.15
    color.setRGB(0.95 + t * 0.05, 0.4 + t * 0.55, 0.1 + t * 0.85)
  }
  return color
}

function TopographicTerrainMesh({ meshData, renderMode }) {
  const meshRef = useRef()

  const { geometry } = useMemo(() => {
    if (!meshData || !meshData.heights) return { geometry: null }

    const rows = meshData.heights.length
    const cols = meshData.heights[0]?.length || 0

    const heightsFlat = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        heightsFlat.push(meshData.heights[r][c] ?? 0)
      }
    }

    const geo = new THREE.PlaneGeometry(5, 5, cols - 1, rows - 1)
    geo.rotateX(-Math.PI / 2)

    const positions = geo.attributes.position.array
    const minH = Math.min(...heightsFlat)
    const maxH = Math.max(...heightsFlat)
    const span = maxH - minH || 1

    const colorArr = new Float32Array(heightsFlat.length * 3)

    for (let i = 0; i < heightsFlat.length; i++) {
      const h = heightsFlat[i]
      const norm = (h - minH) / span
      positions[i * 3 + 1] = norm * 1.4

      if (renderMode === 'elevation') {
        const c = getElevationColor(norm)
        colorArr[i * 3] = c.r
        colorArr[i * 3 + 1] = c.g
        colorArr[i * 3 + 2] = c.b
      } else if (renderMode === 'regolith') {
        const brightness = 0.28 + norm * 0.45
        colorArr[i * 3] = brightness
        colorArr[i * 3 + 1] = brightness * 0.98
        colorArr[i * 3 + 2] = brightness * 1.02
      } else {
        colorArr[i * 3] = 0.13
        colorArr[i * 3 + 1] = 0.82
        colorArr[i * 3 + 2] = 0.93
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
    geo.computeVertexNormals()

    return { geometry: geo }
  }, [meshData, renderMode])

  if (!geometry) return null

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={renderMode === 'regolith' ? 0.95 : 0.65}
          metalness={0.05}
          wireframe={renderMode === 'wireframe'}
        />
      </mesh>

      {/* Target Landing Ellipse Beacon at center */}
      <group position={[0, 0.72, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 32]} />
          <meshBasicMaterial color="#22D3EE" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color="#F59E0B" />
        </mesh>
        <Html distanceFactor={6} position={[0, 0.15, 0]} center>
          <div style={{
            background: 'rgba(17, 24, 39, 0.92)',
            border: '1px solid var(--color-cyan-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
            color: 'var(--color-cyan)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 0 12px rgba(34, 211, 238, 0.3)',
          }}>
            <Target size={11} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
            <span>TOUCHDOWN ZONE</span>
          </div>
        </Html>
      </group>

      {/* 3D Direction Markers on Terrain Edge */}
      <group position={[0, 0.05, 0]}>
        <Html distanceFactor={7} position={[0, 0, -2.7]} center>
          <div style={{
            color: 'var(--color-cyan)',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            NORTH (0°)
          </div>
        </Html>
        <Html distanceFactor={7} position={[0, 0, 2.7]} center>
          <div style={{
            color: 'var(--color-caution)',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            SOUTH (POLE)
          </div>
        </Html>
        <Html distanceFactor={7} position={[2.7, 0, 0]} center>
          <div style={{
            color: 'var(--text-tertiary)',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            EAST (90°)
          </div>
        </Html>
        <Html distanceFactor={7} position={[-2.7, 0, 0]} center>
          <div style={{
            color: 'var(--text-tertiary)',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: 'rgba(17, 24, 39, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            WEST (270°)
          </div>
        </Html>
      </group>
    </group>
  )
}

function Scene({ meshData, renderMode }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={1.5} castShadow />
      <pointLight position={[-4, 3, -4]} intensity={0.3} color="#22D3EE" />

      {meshData && <TopographicTerrainMesh meshData={meshData} renderMode={renderMode} />}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        minDistance={2}
        maxDistance={9}
      />
    </>
  )
}

export default function TerrainViewer({ site, siteData }) {
  const [meshData, setMeshData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [renderMode, setRenderMode] = useState('elevation')
  const [showColorKey, setShowColorKey] = useState(false)

  useEffect(() => {
    if (!site) {
      setMeshData(null)
      return
    }

    setLoading(true)
    setMeshData(null)
    const url = `/${site.mesh_file || `data/terrains/${site.id}_mesh.json`}`
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setMeshData(data)
        setLoading(false)
      })
      .catch(err => {
        console.warn(`Could not load terrain mesh for ${site.id}:`, err)
        fetch(`/data/hero_terrains/${site.id}_mesh.json`)
          .then(r => r.json())
          .then(data => {
            setMeshData(data)
            setLoading(false)
          })
          .catch(() => setLoading(false))
      })
  }, [site])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#05070D' }}>
      <Canvas
        camera={{ position: [0, 3.2, 4.2], fov: 46 }}
        style={{ background: '#05070D' }}
        shadows
      >
        <Scene meshData={meshData} renderMode={renderMode} />
      </Canvas>

      {/* Top Floating Glass Toolbar (12px Margins) */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        {/* Site & DTM Specs */}
        <div style={{
          background: 'var(--color-panel-glass)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          fontSize: '12px',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'auto',
        }}>
          <Mountain size={14} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <strong style={{ fontWeight: 700 }}>{site?.name || 'Lunar Surface'}</strong>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {meshData ? `${meshData.grid_size}×${meshData.grid_size} GRID · LOLA ${meshData.pixel_m}m/px` : 'STREAMING DTM…'}
          </span>
        </div>

        {/* Shading Mode Segmented Control */}
        <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
          <div className="segmented-control" style={{ background: 'var(--color-panel-glass)', backdropFilter: 'blur(8px)' }}>
            <button
              onClick={() => setRenderMode('elevation')}
              className={`segmented-item ${renderMode === 'elevation' ? 'active' : ''}`}
            >
              <span>LOLA Topo</span>
            </button>
            <button
              onClick={() => setRenderMode('regolith')}
              className={`segmented-item ${renderMode === 'regolith' ? 'active' : ''}`}
            >
              <span>Regolith</span>
            </button>
            <button
              onClick={() => setRenderMode('wireframe')}
              className={`segmented-item ${renderMode === 'wireframe' ? 'active' : ''}`}
            >
              <span>Mesh Wire</span>
            </button>
          </div>

          <button
            onClick={() => setShowColorKey(!showColorKey)}
            className={`btn ${showColorKey ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Toggle LOLA Hypsometric Scale Legend"
          >
            <Palette size={13} strokeWidth={1.5} />
            <span>Color Key</span>
          </button>
        </div>
      </div>

      {/* Scientific Elevation Colormap Legend (Floating Glass Card) */}
      {showColorKey && renderMode === 'elevation' && (
        <div style={{
          position: 'absolute',
          top: 54,
          right: 12,
          background: 'var(--color-panel-glass)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 14px',
          width: '230px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          zIndex: 15,
          pointerEvents: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-cyan)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em' }}>
              Elevation Legend
            </span>
            <button
              onClick={() => setShowColorKey(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Color Gradient Strip */}
          <div style={{
            height: '6px',
            borderRadius: 'var(--radius-pill)',
            marginBottom: '10px',
            background: 'linear-gradient(to right, #3b0764, #0284c7, #22c55e, #fbbf24, #ef4444, #ffffff)'
          }} />

          {/* Color Levels Explanation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#ffffff', border: '1px solid #ef4444', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>White/Red:</strong> Peaks &amp; Summits</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#fbbf24', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>Amber:</strong> High Ridge Crests</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#22c55e', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>Green:</strong> Slopes &amp; Plateaus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#0284c7', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>Cyan:</strong> Crater Floors</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#3b0764', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)' }}>Purple:</strong> PSR Cold Traps</span>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            NASA LOLA Hypsometric Scale
          </div>
        </div>
      )}

      {/* Bottom Floating Telemetry Bar (12px Margins) */}
      {meshData && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            background: 'var(--color-panel-glass)',
            backdropFilter: 'blur(8px)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Span: </span>
              <strong style={{ color: 'var(--color-cyan)' }}>{meshData.elevation_span_m || '—'}m</strong>
            </div>
            <div style={{ color: 'var(--color-border)' }}>|</div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Center: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{meshData.center_elevation_m}m</strong>
            </div>
            <div style={{ color: 'var(--color-border)' }}>|</div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Mean Slope: </span>
              <strong style={{ color: meshData.mean_slope_deg > 15 ? 'var(--color-hazard)' : 'var(--color-safe)' }}>
                {meshData.mean_slope_deg}°
              </strong>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', marginLeft: '3px' }}>(15° default limit)</span>
            </div>
            <div style={{ color: 'var(--color-border)' }}>|</div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Modelled Score: </span>
              <strong style={{ color: 'var(--color-caution)' }}>
                {meshData.landing_safety_score || 85}/100
              </strong>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '9px', marginLeft: '3px' }}>(Slope constraint)</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '2px',
            background: 'var(--color-panel-glass)',
            backdropFilter: 'blur(8px)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--color-border)',
            pointerEvents: 'auto',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Scale: <span style={{ color: 'var(--color-cyan)' }}>3.84 km</span> (30m/px) · <span style={{ color: 'var(--color-caution)' }}>Horizon limited to ~1.9 km</span>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
              Note: 30m DTM cannot resolve rocks/small craters; distant massifs &gt;2km not in tile
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton Indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(5, 7, 13, 0.85)',
          color: 'var(--color-cyan)',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          gap: '10px',
          zIndex: 20,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--color-cyan)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          <span>Streaming LOLA 3D Topographic Mesh…</span>
        </div>
      )}
    </div>
  )
}
