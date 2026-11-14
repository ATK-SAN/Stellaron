import { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Hypsometric tint colormap (NASA LOLA scientific elevation standard)
function getElevationColor(normalized) {
  // 0.0: deep purple/blue -> 0.25: cyan -> 0.5: green -> 0.75: amber/yellow -> 1.0: red/white
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
      // Exaggerate vertical scale slightly for visual clarity of subtle ridges/craters
      positions[i * 3 + 1] = norm * 1.4

      if (renderMode === 'elevation') {
        const c = getElevationColor(norm)
        colorArr[i * 3] = c.r
        colorArr[i * 3 + 1] = c.g
        colorArr[i * 3 + 2] = c.b
      } else if (renderMode === 'regolith') {
        // Authentic dusty lunar regolith with highland brightening
        const brightness = 0.28 + norm * 0.45
        colorArr[i * 3] = brightness
        colorArr[i * 3 + 1] = brightness * 0.98
        colorArr[i * 3 + 2] = brightness * 1.02
      } else {
        // Wireframe single tint
        colorArr[i * 3] = 0.22
        colorArr[i * 3 + 1] = 0.74
        colorArr[i * 3 + 2] = 0.97
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
      <group position={[0, 0.75, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </group>
    </group>
  )
}

function Scene({ meshData, renderMode }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={1.5} castShadow />
      <pointLight position={[-4, 3, -4]} intensity={0.3} color="#38bdf8" />

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
  const [renderMode, setRenderMode] = useState('elevation') // 'elevation' | 'regolith' | 'wireframe'

  useEffect(() => {
    if (!site) {
      setMeshData(null)
      return
    }

    setLoading(true)
    setMeshData(null)
    // Every site now has a dedicated terrain mesh in /data/terrains/
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
        // Fallback to hero_terrains if available
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
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 3.2, 4.2], fov: 46 }}
        style={{ background: 'radial-gradient(circle at 50% 50%, #0d1224 0%, #050711 100%)' }}
        shadows
      >
        <Scene meshData={meshData} renderMode={renderMode} />
      </Canvas>

      {/* Top Controls Toolbar */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(6, 11, 25, 0.8)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: '5px',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '0.72rem',
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'auto'
        }}>
          <span style={{ color: '#38bdf8' }}>📐</span>
          <strong>{site?.name || 'Lunar Surface'}</strong>
          <span style={{ color: '#64748b' }}>·</span>
          <span style={{ color: '#94a3b8', fontSize: '0.66rem' }}>
            {meshData ? `${meshData.grid_size}×${meshData.grid_size} Grid (LOLA ${meshData.pixel_m}m/px)` : 'Loading DTM…'}
          </span>
        </div>

        {/* Shading Mode Switcher */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(6, 11, 25, 0.8)',
          backdropFilter: 'blur(8px)',
          padding: '3px',
          borderRadius: '5px',
          border: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'auto'
        }}>
          <button
            onClick={() => setRenderMode('elevation')}
            style={{
              background: renderMode === 'elevation' ? '#0284c7' : 'transparent',
              color: renderMode === 'elevation' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.64rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            LOLA Topo
          </button>
          <button
            onClick={() => setRenderMode('regolith')}
            style={{
              background: renderMode === 'regolith' ? '#0284c7' : 'transparent',
              color: renderMode === 'regolith' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.64rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Regolith
          </button>
          <button
            onClick={() => setRenderMode('wireframe')}
            style={{
              background: renderMode === 'wireframe' ? '#0284c7' : 'transparent',
              color: renderMode === 'wireframe' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.64rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Mesh
          </button>
        </div>
      </div>

      {/* Bottom HUD: Topographic Measurements */}
      {meshData && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(6, 11, 25, 0.8)',
            backdropFilter: 'blur(8px)',
            padding: '5px 12px',
            borderRadius: '5px',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.66rem',
            color: '#cbd5e1',
            fontFamily: 'monospace'
          }}>
            <div>Elev Span: <strong style={{ color: '#38bdf8' }}>{meshData.elevation_span_m || '—'}m</strong></div>
            <div style={{ color: '#475569' }}>|</div>
            <div>Center Elev: <strong style={{ color: '#a78bfa' }}>{meshData.center_elevation_m}m</strong></div>
            <div style={{ color: '#475569' }}>|</div>
            <div>Mean Slope: <strong style={{ color: meshData.mean_slope_deg > 20 ? '#f87171' : '#34d399' }}>{meshData.mean_slope_deg}°</strong></div>
            <div style={{ color: '#475569' }}>|</div>
            <div>Safety Score: <strong style={{ color: '#fbbf24' }}>{meshData.landing_safety_score || 85}/100</strong></div>
          </div>

          <div style={{
            fontSize: '0.62rem',
            color: '#64748b',
            background: 'rgba(6, 11, 25, 0.7)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            🎯 Target Ellipse Center
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(5,7,17,0.7)',
          color: '#38bdf8',
          fontSize: '0.8rem',
          gap: '8px'
        }}>
          <span>⏳ Streaming LOLA 3D Topographic Mesh…</span>
        </div>
      )}
    </div>
  )
}
