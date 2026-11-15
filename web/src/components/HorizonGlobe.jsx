/** HorizonGlobe.jsx — 3D Interactive Lunar Globe (NASA SVS LROC Mosaic)
 *
 * Restyled with:
 * - SpaceX/NASA dark mission-control visual theme
 * - Deep space #05070D base
 * - Floating glass panels with 12px margin
 * - Space Grotesk UI labels and JetBrains Mono telemetry readouts
 * - Lucide line icons (zero emojis)
 */

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { Globe, Layers, Check, Tag } from 'lucide-react'

// Convert lat/lon degrees to 3D Cartesian coordinates on sphere of radius r
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
          color="#22D3EE"
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
            <meshBasicMaterial color="#22D3EE" transparent opacity={0.6} />
          </mesh>
          {/* North Pole Pin */}
          <group position={[0, 1.05, 0]}>
            <mesh>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#22D3EE" />
            </mesh>
            <Html distanceFactor={5} position={[0, 0.08, 0]} center>
              <div style={{
                background: 'rgba(17, 24, 39, 0.90)',
                border: '1px solid var(--color-cyan-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 7px',
                color: 'var(--color-cyan)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}>
                NORTH POLE (+90°)
              </div>
            </Html>
          </group>

          {/* South Pole Pin & Artemis Target Ring */}
          <group position={[0, -1.05, 0]}>
            <mesh>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#F59E0B" />
            </mesh>
            <Html distanceFactor={5} position={[0, -0.08, 0]} center>
              <div style={{
                background: 'rgba(17, 24, 39, 0.90)',
                border: '1px solid var(--color-caution-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 7px',
                color: 'var(--color-caution)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}>
                SOUTH POLE (-90°) · ARTEMIS ZONE
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
            <meshBasicMaterial color="#10B981" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* Equator Label (fixed screen size) */}
          <Html position={[1.05, 0, 0]} center occlude style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(17, 24, 39, 0.85)',
              border: '1px solid var(--color-safe-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              color: 'var(--color-safe)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}>
              EQUATOR (0° LAT)
            </div>
          </Html>
        </group>
      )}

      {/* Artemis South Pole Exploration Circle (85°S to 90°S) */}
      <mesh position={[0, -0.996, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.085, 0.095, 48]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function SiteMarker({ site, isSelected, onClick, showLabels }) {
  const markerRef = useRef()
  const ringRef = useRef()
  const [hovered, setHovered] = useState(false)
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
  const baseColor = isSelected ? '#22D3EE' : isHero ? '#F59E0B' : isLimited ? '#EF4444' : '#9CA3AF'

  // Label display: selected always visible; hero sites visible when showLabels on; hovered visible
  const shouldShowLabel = isSelected || (showLabels && isHero) || hovered

  return (
    <group position={pos}>
      {/* Beacon sphere */}
      <mesh
        ref={markerRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(site)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
        }}
      >
        <sphereGeometry args={[isSelected ? 0.024 : 0.016, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={isSelected ? 3.0 : hovered ? 2.2 : 1.2}
        />
      </mesh>

      {/* Pulsing target ring for selected site */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.035, 0.045, 24]} />
          <meshBasicMaterial color="#22D3EE" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Site Name Label (constant 11px screen size, occluded on backface) */}
      {shouldShowLabel && (
        <Html position={[0, 0.045, 0]} center occlude style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: `1px solid ${baseColor}`,
            boxShadow: `0 0 10px ${baseColor}40`,
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: baseColor }} />
            <strong style={{ fontWeight: isSelected ? 700 : 500 }}>{site.name}</strong>
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ sites, selectedSite, onSelect, showGrid, showPoles, showLabels }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 3, 5]} intensity={1.6} />
      <pointLight position={[-6, -4, -4]} intensity={0.25} color="#22D3EE" />

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
          showLabels={showLabels}
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
  const [showLabels, setShowLabels] = useState(() => {
    try {
      const saved = localStorage.getItem('stellaron_globe_labels')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  // Keyboard shortcut: L toggles site labels
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'l' || e.key === 'L') {
        setShowLabels(prev => {
          const next = !prev
          try { localStorage.setItem('stellaron_globe_labels', JSON.stringify(next)) } catch {}
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#05070D' }}>
      <Canvas
        camera={{ position: [0, -0.4, 2.3], fov: 45 }}
        style={{ background: '#05070D' }}
      >
        <Scene
          sites={sites}
          selectedSite={selectedSite}
          onSelect={onSelect}
          showGrid={showGrid}
          showPoles={showPoles}
          showLabels={showLabels}
        />
      </Canvas>

      {/* Overlay Title (Floating Glass Panel, 12px Margins) */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        fontSize: '11px',
        color: 'var(--text-secondary)',
        background: 'var(--color-panel-glass)',
        backdropFilter: 'blur(8px)',
        padding: '5px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 10,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-cyan)', boxShadow: '0 0 6px var(--color-cyan)' }} />
        <span style={{ fontFamily: 'var(--font-mono)' }}>3D LUNAR GLOBE · NASA SVS LROC MOSAIC</span>
      </div>

      {/* Layer Controls (Floating Glass Buttons, 12px Margins) */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: '6px',
        background: 'var(--color-panel-glass)',
        backdropFilter: 'blur(8px)',
        padding: '4px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        zIndex: 10,
      }}>
        <button
          data-tour="labels-toggle"
          onClick={() => {
            setShowLabels(prev => {
              const next = !prev
              try { localStorage.setItem('stellaron_globe_labels', JSON.stringify(next)) } catch {}
              return next
            })
          }}
          className={`btn ${showLabels ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '3px 8px', fontSize: '11px' }}
          aria-pressed={showLabels}
          title="Toggle Site Labels (Keyboard shortcut: L)"
        >
          <Tag size={12} strokeWidth={1.5} />
          <span>Labels</span>
        </button>
        <button
          onClick={() => setShowPoles(!showPoles)}
          className={`btn ${showPoles ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '3px 8px', fontSize: '11px' }}
        >
          {showPoles && <Check size={12} strokeWidth={2} />}
          <span>Poles &amp; Axis</span>
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`btn ${showGrid ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '3px 8px', fontSize: '11px' }}
        >
          {showGrid && <Check size={12} strokeWidth={2} />}
          <span>Equator</span>
        </button>
      </div>

      {/* Telemetry Guide Footer */}
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
          fontSize: '11px',
          color: 'var(--text-secondary)',
          background: 'var(--color-panel-glass)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          border: '1px solid var(--color-border)',
        }}>
          Axial Tilt: <span style={{ color: 'var(--color-cyan)' }}>1.54°</span> (nearly perpendicular to ecliptic)
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  )
}
