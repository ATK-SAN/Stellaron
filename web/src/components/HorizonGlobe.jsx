import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

// Convert lat/lon degrees to 3D position on a unit sphere
function latLonToVec3(lat, lon, r = 1.02) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

function Moon() {
  const meshRef = useRef()
  // Slow rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05
    }
  })

  // Procedural moon-like material: gray with subtle noise
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#888896'),
      roughness: 0.95,
      metalness: 0.0,
    })
  }, [])

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[1, 48, 48]} />
    </mesh>
  )
}

function SiteMarker({ site, isSelected, onClick }) {
  const meshRef = useRef()
  const pos = latLonToVec3(site.lat_deg, site.lon_deg)

  useFrame((state) => {
    if (isSelected && meshRef.current) {
      const t = state.clock.getElapsedTime()
      meshRef.current.scale.setScalar(1 + 0.3 * Math.sin(t * 3))
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1)
    }
  })

  const color = isSelected
    ? '#4fc3f7'
    : site.coverage === 'hero'
      ? '#ffd700'
      : site.coverage === 'verified'
        ? '#c0c0c0'
        : '#666688'

  const size = isSelected ? 0.025 : 0.014

  return (
    <mesh
      ref={meshRef}
      position={pos}
      onClick={(e) => { e.stopPropagation(); onClick(site) }}
    >
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 2 : 0.8}
      />
    </mesh>
  )
}

function Scene({ sites, selectedSite, onSelect }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <pointLight position={[-5, -3, -5]} intensity={0.3} color="#4080ff" />

      <Moon />

      {sites.map(site => (
        <SiteMarker
          key={site.id}
          site={site}
          isSelected={selectedSite?.id === site.id}
          onClick={onSelect}
        />
      ))}

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={1.5}
        maxDistance={4}
        autoRotate={!selectedSite}
        autoRotateSpeed={0.3}
      />
    </>
  )
}

export default function HorizonGlobe({ sites, selectedSite, onSelect }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.5], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      <Scene sites={sites} selectedSite={selectedSite} onSelect={onSelect} />
    </Canvas>
  )
}
