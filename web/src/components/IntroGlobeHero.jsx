import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// Convert spherical coordinates to 3D position
function latLonToVec3(lat, lon, r = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

// 4 Hero Candidate Sites from real library
const HERO_SITES = [
  { id: 'shackleton_connecting_ridge', name: 'Shackleton Ridge', lat: -89.54, lon: 116.7 },
  { id: 'malapert_mountain', name: 'Malapert Mountain', lat: -85.99, lon: 2.93 },
  { id: 'de_gerlache_rim_1', name: 'de Gerlache Rim', lat: -88.71, lon: -88.35 },
  { id: 'haworth_rim', name: 'Haworth Rim', lat: -87.87, lon: -5.18 },
]

function RotatingMoon() {
  const groupRef = useRef()
  const texture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')

  useMemo(() => {
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.minFilter = THREE.LinearMipmapLinearFilter
    }
  }, [texture])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12
    }
  })

  return (
    <group ref={groupRef} rotation={[0.4, 0, 0]}>
      {/* Lunar sphere */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[1.0, 48, 48]} />
        <meshStandardMaterial map={texture} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Hero Site Markers */}
      {HERO_SITES.map(site => {
        const pos = latLonToVec3(site.lat, site.lon, 1.02)
        return (
          <mesh key={site.id} position={pos}>
            <sphereGeometry args={[0.022, 12, 12]} />
            <meshBasicMaterial color="#22D3EE" />
          </mesh>
        )
      })}
    </group>
  )
}

function StaticFallback({ className }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src="/intro/hero-globe-fallback.webp"
        alt="Moon Globe with Candidate Sites"
        width="440"
        height="440"
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '50%',
          filter: 'drop-shadow(0 0 32px rgba(34, 211, 238, 0.25))',
        }}
      />
    </div>
  )
}

export default function IntroGlobeHero() {
  const [useStatic, setUseStatic] = useState(true)

  useEffect(() => {
    // Check reduced motion or narrow screen or WebGL availability
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 768
    let hasWebGL = false
    try {
      const canvas = document.createElement('canvas')
      hasWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
    } catch {
      hasWebGL = false
    }

    if (!reducedMotion && !isMobile && hasWebGL) {
      setUseStatic(false)
    }
  }, [])

  if (useStatic) {
    return <StaticFallback />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Suspense fallback={<StaticFallback />}>
        <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 2, 2]} intensity={1.4} />
          <RotatingMoon />
        </Canvas>
      </Suspense>
    </div>
  )
}
