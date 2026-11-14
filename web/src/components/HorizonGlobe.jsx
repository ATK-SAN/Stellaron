import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'

// Convert lat/lon degrees to 3D Cartesian coordinates on a sphere of radius r
function latLonToVec3(lat, lon, r = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

function TexturedMoon({ selectedSite }) {
  const meshRef = useRef()
  // Load real NASA SVS LROC color mosaic texture from public/textures
  const texture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')

  useMemo(() => {
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
    }
  }, [texture])

  // Gentle subtle rotation if no site selected
  useFrame((_, delta) => {
    if (meshRef.current && !selectedSite) {
      meshRef.current.rotation.y += delta * 0.04
    }
  })

  return (
    <group ref={meshRef}>
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.92}
          metalness={0.05}
          bumpScale={0.03}
        />
      </mesh>

      {/* Atmospheric limb / lunar glow ring */}
      <mesh scale={[1.02, 1.02, 1.02]}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

function SiteMarker({ site, isSelected, onClick }) {
  const markerRef = useRef()
  const ringRef = useRef()
  const pos = useMemo(() => latLonToVec3(site.lat_deg, site.lon_deg, 1.015), [site.lat_deg, site.lon_deg])

  useFrame((state) => {
    if (markerRef.current) {
      const t = state.clock.getElapsedTime()
      if (isSelected) {
        markerRef.current.scale.setScalar(1.0 + 0.35 * Math.sin(t * 4))
        if (ringRef.current) {
          ringRef.current.scale.setScalar(1.0 + 0.6 * ((Math.sin(t * 3) + 1) / 2))
          ringRef.current.material.opacity = 0.8 - 0.5 * ((Math.sin(t * 3) + 1) / 2)
        }
      } else {
        markerRef.current.scale.setScalar(1.0)
      }
    }
  })

  const isHero = site.coverage === 'hero'
  const isLimited = site.coverage === 'limited'
  const baseColor = isSelected ? '#38bdf8' : isHero ? '#fbbf24' : isLimited ? '#f87171' : '#a78bfa'

  return (
    <group position={pos}>
      {/* Beacon sphere */}
      <mesh
        ref={markerRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(site)
        }}
      >
        <sphereGeometry args={[isSelected ? 0.024 : 0.016, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={isSelected ? 3.0 : 1.2}
        />
      </mesh>

      {/* Pulsing beacon target ring for selected site */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.035, 0.045, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Lightweight label on hover or when selected */}
      {isSelected && (
        <Html distanceFactor={4} position={[0, 0.05, 0]} center>
          <div style={{
            background: 'rgba(6, 11, 25, 0.85)',
            border: `1px solid ${baseColor}`,
            boxShadow: `0 0 12px ${baseColor}60`,
            borderRadius: '4px',
            padding: '2px 8px',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ color: baseColor }}>●</span>
            <strong>{site.name}</strong>
          </div>
        </Html>
      )}
    </group>
  )
}

function SouthPoleTargetRing() {
  // Highlights the Artemis South Pole exploration zone (< 85°S)
  const pos = [0, -1.005, 0]
  return (
    <mesh position={pos} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.07, 0.08, 48]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Scene({ sites, selectedSite, onSelect }) {
  const controlsRef = useRef()

  return (
    <>
      <ambientLight intensity={0.45} />
      {/* Sunlight vector from simulated solar angle */}
      <directionalLight position={[6, 3, 5]} intensity={1.6} castShadow />
      <pointLight position={[-6, -4, -4]} intensity={0.25} color="#38bdf8" />

      {/* Deep Space Stars */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      <TexturedMoon selectedSite={selectedSite} />
      <SouthPoleTargetRing />

      {sites.map((site) => (
        <SiteMarker
          key={site.id}
          site={site}
          isSelected={selectedSite?.id === site.id}
          onClick={onSelect}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        minDistance={1.4}
        maxDistance={4.5}
        autoRotate={!selectedSite}
        autoRotateSpeed={0.5}
      />
    </>
  )
}

export default function HorizonGlobe({ sites, selectedSite, onSelect }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, -0.5, 2.3], fov: 45 }}
        style={{ background: 'radial-gradient(circle at 50% 50%, #0d1326 0%, #050711 100%)' }}
      >
        <Scene sites={sites} selectedSite={selectedSite} onSelect={onSelect} />
      </Canvas>

      <div style={{
        position: 'absolute',
        top: 10,
        left: 12,
        fontSize: '0.68rem',
        color: '#94a3b8',
        background: 'rgba(6, 11, 25, 0.7)',
        backdropFilter: 'blur(8px)',
        padding: '3px 8px',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.08)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
        <span>NASA SVS Global Mosaic · Interactive 3D Orbit</span>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: '0.64rem',
        color: '#64748b',
        pointerEvents: 'none',
        fontFamily: 'monospace'
      }}>
        Left-Click: Rotate · Scroll: Zoom
      </div>
    </div>
  )
}
