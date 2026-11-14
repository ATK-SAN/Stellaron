import { useRef, useMemo, useState } from 'react'
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

function TexturedMoon({ selectedSite, showGrid, showPoles }) {
  const meshRef = useRef()
  // Load real NASA SVS LROC color mosaic texture
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
      meshRef.current.rotation.y += delta * 0.03
    }
  })

  return (
    <group ref={meshRef}>
      {/* Lunar Body */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.92}
          metalness={0.05}
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

      {/* Rotational Axis of the Moon (1.54° axial tilt to ecliptic) */}
      {showPoles && (
        <group>
          {/* Axis Rod */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 2.5, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
          </mesh>
          {/* North Pole Pin */}
          <group position={[0, 1.05, 0]}>
            <mesh>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <Html distanceFactor={5} position={[0, 0.08, 0]} center>
              <div style={{
                background: 'rgba(6, 11, 25, 0.85)',
                border: '1px solid #38bdf8',
                borderRadius: '4px',
                padding: '2px 6px',
                color: '#38bdf8',
                fontSize: '10px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                fontWeight: 700
              }}>
                NORTH POLE (+90°)
              </div>
            </Html>
          </group>

          {/* South Pole Pin & Artemis Target Ring */}
          <group position={[0, -1.05, 0]}>
            <mesh>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <Html distanceFactor={5} position={[0, -0.08, 0]} center>
              <div style={{
                background: 'rgba(6, 11, 25, 0.85)',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
                padding: '2px 6px',
                color: '#fbbf24',
                fontSize: '10px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                fontWeight: 700
              }}>
                SOUTH POLE (-90°) · Artemis Zone
              </div>
            </Html>
          </group>
        </group>
      )}

      {/* Equator Ring (0° Latitude) */}
      {showGrid && (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.004, 1.008, 64]} />
            <meshBasicMaterial color="#34d399" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* Equator Label */}
          <Html distanceFactor={5} position={[1.05, 0, 0]} center>
            <div style={{
              background: 'rgba(6, 11, 25, 0.8)',
              border: '1px solid #34d399',
              borderRadius: '3px',
              padding: '1px 5px',
              color: '#34d399',
              fontSize: '9px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}>
              EQUATOR (0° LAT)
            </div>
          </Html>
        </group>
      )}

      {/* Artemis South Pole Exploration Circle (85°S to 90°S) */}
      <mesh position={[0, -0.996, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.085, 0.095, 48]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} side={THREE.DoubleSide} />
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

      {/* Pulsing target ring for selected site */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.035, 0.045, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Site Name Label */}
      {isSelected && (
        <Html distanceFactor={4} position={[0, 0.06, 0]} center>
          <div style={{
            background: 'rgba(6, 11, 25, 0.9)',
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

function Scene({ sites, selectedSite, onSelect, showGrid, showPoles }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 3, 5]} intensity={1.6} />
      <pointLight position={[-6, -4, -4]} intensity={0.25} color="#38bdf8" />

      {/* Deep Space Stars */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      <TexturedMoon
        selectedSite={selectedSite}
        showGrid={showGrid}
        showPoles={showPoles}
      />

      {sites.map((site) => (
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
        minDistance={1.4}
        maxDistance={4.5}
        autoRotate={!selectedSite}
        autoRotateSpeed={0.5}
      />
    </>
  )
}

export default function HorizonGlobe({ sites, selectedSite, onSelect }) {
  const [showPoles, setShowPoles] = useState(true)
  const [showGrid, setShowGrid] = useState(true)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, -0.4, 2.3], fov: 45 }}
        style={{ background: 'radial-gradient(circle at 50% 50%, #0d1326 0%, #050711 100%)' }}
      >
        <Scene
          sites={sites}
          selectedSite={selectedSite}
          onSelect={onSelect}
          showGrid={showGrid}
          showPoles={showPoles}
        />
      </Canvas>

      {/* Overlay Title */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 12,
        fontSize: '0.68rem',
        color: '#94a3b8',
        background: 'rgba(6, 11, 25, 0.75)',
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
        <span>3D Lunar Globe · NASA SVS LROC Mosaic</span>
      </div>

      {/* Educational Layers Toggle Controls */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 12,
        display: 'flex',
        gap: '4px',
        background: 'rgba(6, 11, 25, 0.8)',
        backdropFilter: 'blur(8px)',
        padding: '3px',
        borderRadius: '5px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <button
          onClick={() => setShowPoles(!showPoles)}
          style={{
            background: showPoles ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            color: showPoles ? '#38bdf8' : '#64748b',
            border: showPoles ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '0.62rem',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {showPoles ? '✓ Poles & Axis' : 'Poles & Axis'}
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          style={{
            background: showGrid ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
            color: showGrid ? '#34d399' : '#64748b',
            border: showGrid ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid transparent',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '0.62rem',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {showGrid ? '✓ Equator' : 'Equator'}
        </button>
      </div>

      {/* Educational Guide Footer */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 12,
        right: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{
          fontSize: '0.62rem',
          color: '#cbd5e1',
          background: 'rgba(6, 11, 25, 0.75)',
          padding: '2px 8px',
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          Axial Tilt: <span style={{ color: '#38bdf8' }}>1.54°</span> (nearly perpendicular to Sun!)
        </div>
        <div style={{
          fontSize: '0.62rem',
          color: '#64748b',
          fontFamily: 'monospace'
        }}>
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  )
}
