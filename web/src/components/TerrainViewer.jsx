import { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

function HeroTerrain({ meshData }) {
  const meshRef = useRef()

  const { geometry, colors } = useMemo(() => {
    if (!meshData) return { geometry: null, colors: null }

    const rows = meshData.heights.length
    const cols = meshData.heights[0]?.length || 0

    // Flatten 2D heights to 1D
    const heightsFlat = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        heightsFlat.push(meshData.heights[r][c] ?? 0)
      }
    }

    const geo = new THREE.PlaneGeometry(4, 4, cols - 1, rows - 1)
    geo.rotateX(-Math.PI / 2)

    const positions = geo.attributes.position.array
    const minH = Math.min(...heightsFlat)
    const maxH = Math.max(...heightsFlat)
    const range = maxH - minH || 1

    // Apply height displacement on Y axis
    const colorArr = new Float32Array(heightsFlat.length * 3)
    for (let i = 0; i < heightsFlat.length; i++) {
      const h = heightsFlat[i]
      const normalized = (h - minH) / range
      positions[i * 3 + 1] = normalized * 1.2  // vertical scale

      // Color gradient: dark gray → light gray (moon terrain)
      const brightness = 0.25 + normalized * 0.5
      colorArr[i * 3] = brightness
      colorArr[i * 3 + 1] = brightness
      colorArr[i * 3 + 2] = brightness + 0.05
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
    geo.computeVertexNormals()

    return { geometry: geo, colors: colorArr }
  }, [meshData])

  if (!geometry) return null

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.0} />
    </mesh>
  )
}

function FlatPlane({ site }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4, 4, 32, 32]} />
      <meshStandardMaterial color="#444455" roughness={0.95} wireframe={false} />
    </mesh>
  )
}

function Scene({ site, siteData, heroMesh }) {
  const isHero = site?.coverage === 'hero'
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 3]} intensity={1.0} castShadow />
      <pointLight position={[-3, 3, -3]} intensity={0.2} color="#4080ff" />

      {isHero && heroMesh
        ? <HeroTerrain meshData={heroMesh} />
        : <FlatPlane site={site} />
      }

      <OrbitControls enablePan={false} minDistance={2} maxDistance={8} />
    </>
  )
}

export default function TerrainViewer({ site, siteData }) {
  const [heroMesh, setHeroMesh] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!site || site.coverage !== 'hero') {
      setHeroMesh(null)
      return
    }

    setLoading(true)
    setHeroMesh(null)
    const url = `/data/hero_terrains/${site.id}_mesh.json`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setHeroMesh(data)
        setLoading(false)
      })
      .catch(err => {
        console.warn(`No hero mesh for ${site.id}:`, err.message)
        setLoading(false)
      })
  }, [site])

  const label = site
    ? `${site.name} · ${site.coverage === 'hero' ? (heroMesh ? 'DTM Terrain' : loading ? 'Loading mesh…' : 'No mesh file') : 'Schematic View'}`
    : null

  return (
    <>
      <Canvas
        camera={{ position: [0, 3, 5], fov: 45 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        shadows
      >
        {site && (
          <Scene site={site} siteData={siteData} heroMesh={heroMesh} />
        )}
        {!site && (
          <ambientLight intensity={0.3} />
        )}
      </Canvas>

      {label && (
        <div className="terrain-label">
          <strong>{site?.name}</strong>
          {site.coverage === 'hero' ? '🗺 DTM Terrain Mesh' : '📐 Schematic Flat Plane'}
          {site.coverage !== 'hero' && (
            <div style={{ marginTop: 2, fontSize: '0.65rem', opacity: 0.7 }}>
              Hero terrain not available for this site
            </div>
          )}
        </div>
      )}

      {!site && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
          <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>🌑</span>
          <span>Select a site</span>
        </div>
      )}
    </>
  )
}
