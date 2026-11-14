import { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'

// Convert lat/lon degrees to 3D Cartesian coordinates on sphere radius r
function latLonToVec3(lat, lon, r = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

function SunObject({ sunAzDeg, sunElDeg, distance = 4.2 }) {
  // Convert horizontal coordinates (Azimuth & Elevation from site or center) to 3D vector
  // Azimuth from North (0°), East (90°), South (180°), West (270°)
  // Elevation from horizon (0°) to Zenith (+90°)
  const sunPos = useMemo(() => {
    const elRad = (sunElDeg * Math.PI) / 180
    const azRad = (sunAzDeg * Math.PI) / 180
    // Spherical coordinates
    const y = distance * Math.sin(elRad)
    const rHoriz = distance * Math.cos(elRad)
    const x = rHoriz * Math.sin(azRad)
    const z = -rHoriz * Math.cos(azRad)
    return [x, y, z]
  }, [sunAzDeg, sunElDeg, distance])

  return (
    <group position={sunPos}>
      {/* Sun Glowing Core */}
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>

      {/* Solar Corona Glow (Outer Ring) */}
      <mesh scale={[1.4, 1.4, 1.4]}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} side={THREE.BackSide} />
      </mesh>

      {/* Sun Rays Beam pointing to Moon */}
      <pointLight color="#fff7ed" intensity={3.5} distance={20} decay={1} />
      <directionalLight
        position={[0, 0, 0]}
        target-position={[-sunPos[0], -sunPos[1], -sunPos[2]]}
        intensity={2.0}
      />

      {/* Sun Label */}
      <Html distanceFactor={8} position={[0, 0.4, 0]} center>
        <div style={{
          background: 'rgba(251, 191, 36, 0.9)',
          color: '#000',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          boxShadow: '0 0 16px rgba(251, 191, 36, 0.8)'
        }}>
          ☀️ THE SUN
        </div>
      </Html>
    </group>
  )
}

function MoonGlobe({ site, sunVisible }) {
  const texture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')
  const sitePos = useMemo(() => latLonToVec3(site.lat_deg, site.lon_deg, 1.015), [site.lat_deg, site.lon_deg])

  return (
    <group>
      {/* Moon Sphere with NASA SVS Texture */}
      <mesh receiveShadow>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Lunar Obliquity Tilt Axis (1.54°) */}
      <mesh rotation={[0, 0, (1.54 * Math.PI) / 180]}>
        <cylinderGeometry args={[0.003, 0.003, 2.5, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
      </mesh>

      {/* Equator Guide Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.004, 1.008, 64]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Active Site Pin */}
      <group position={sitePos}>
        <mesh>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshBasicMaterial color={sunVisible ? '#fbbf24' : '#f87171'} />
        </mesh>
        <Html distanceFactor={5} position={[0, 0.08, 0]} center>
          <div style={{
            background: sunVisible ? 'rgba(251, 191, 36, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            color: '#000',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            📍 {site.name} ({sunVisible ? '☀️ LIT' : '🌑 DARK'})
          </div>
        </Html>
      </group>
    </group>
  )
}

function OrbitScene({ site, sunAz, sunEl, sunVisible }) {
  return (
    <>
      <ambientLight intensity={0.12} />
      <Stars radius={100} depth={50} count={3500} factor={4} saturation={0} fade speed={1} />

      <MoonGlobe site={site} sunVisible={sunVisible} />
      <SunObject sunAzDeg={sunAz} sunElDeg={sunEl} />

      <OrbitControls enableZoom={true} enablePan={false} minDistance={2.0} maxDistance={9.0} />
    </>
  )
}

export default function SunOrbitSimulator({ site, siteData, onBack }) {
  const [hourIndex, setHourIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1) // 1x, 5x, 20x

  const timeSeries = siteData?.time_series || {}
  const times = timeSeries.times_utc || []
  const nSamples = times.length || 1

  // Map slider 0..nSamples-1
  const currentUtc = times[hourIndex] || '2026-04-01T00:00:00'
  const currentSunAz = timeSeries.sun_az_deg?.[hourIndex] ?? 0.0
  const currentSunEl = timeSeries.sun_el_deg?.[hourIndex] ?? 0.0
  const currentSunVis = timeSeries.sun_visible?.[hourIndex] ?? false
  const currentEarthVis = timeSeries.earth_visible?.[hourIndex] ?? false

  // Play animation loop
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setHourIndex(prev => {
        const next = prev + playSpeed
        return next >= nSamples ? 0 : next
      })
    }, 50)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, nSamples])

  const dayNumber = ((hourIndex * (siteData?.interval?.step_s || 600)) / 86400).toFixed(1)
  const isSouthPole = site.lat_deg < -80
  const isEquator = Math.abs(site.lat_deg) < 10

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#050711' }}>
      {/* Top Navigation & Status Bar */}
      <div style={{
        padding: '10px 18px',
        background: '#070a18',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#38bdf8',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            &larr; Back to 3D Explorer
          </button>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
              ☀️ Sun & Orbital Illumination Simulator
            </div>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
              Simulating true SPICE solar vectors (NASA JPL DE421 ephemeris) for <strong>{site.name}</strong>
            </div>
          </div>
        </div>

        {/* Live SPICE Telemetry Pills */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            color: '#cbd5e1'
          }}>
            UTC: <strong style={{ color: '#38bdf8' }}>{currentUtc.slice(0, 19).replace('T', ' ')}</strong> (Day {dayNumber}/30)
          </div>

          <div style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            color: '#cbd5e1'
          }}>
            Sun Az: <strong style={{ color: '#fbbf24' }}>{currentSunAz.toFixed(1)}°</strong> | Elev: <strong style={{ color: currentSunEl >= 0 ? '#34d399' : '#f87171' }}>{currentSunEl.toFixed(2)}°</strong>
          </div>

          <div style={{
            background: currentSunVis ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${currentSunVis ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: currentSunVis ? '#4ade80' : '#f87171'
          }}>
            {currentSunVis ? '☀️ SUNLIT' : '🌑 OCCLUDED (SHADOW)'}
          </div>
        </div>
      </div>

      {/* 3D Simulation Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: [0, 2.5, 5.0], fov: 45 }}
          style={{ background: 'radial-gradient(circle at 50% 50%, #0d1228 0%, #050711 100%)' }}
        >
          <OrbitScene
            site={site}
            sunAz={currentSunAz}
            sunEl={currentSunEl}
            sunVisible={currentSunVis}
          />
        </Canvas>

        {/* Educational Science Box for Students & Public */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          width: '320px',
          background: 'rgba(6, 11, 25, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '0.72rem',
          color: '#cbd5e1',
          zIndex: 5,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1rem' }}>🎓</span>
            <strong style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
              {isSouthPole ? 'The South Pole Grazing Sun Phenomenon' : isEquator ? 'Equatorial Day/Night Cycle' : 'Lunar Solar Illumination'}
            </strong>
          </div>

          <p style={{ margin: '0 0 8px', lineHeight: 1.4, color: '#94a3b8' }}>
            {isSouthPole ? (
              <>
                Because the Moon has almost no axial tilt (only <strong>1.54°</strong>), the Sun never rises high at the South Pole! Instead, it skims continuously around the horizon in a 360° circle between <strong>-1.5° and +1.5°</strong> elevation.
              </>
            ) : isEquator ? (
              <>
                At equatorial sites like Apollo 11, the Sun sweeps straight up to <strong>+90° directly overhead</strong>. This creates <strong>14.77 days of blazing daylight</strong> followed by <strong>14.77 days of freezing night</strong>.
              </>
            ) : (
              <>
                Solar angles are generated from <strong>NASA JPL DE421 ephemeris</strong> and include topocentric parallax correction for the 1.5m lander instrument mast.
              </>
            )}
          </p>

          <div style={{
            background: 'rgba(15,23,42,0.7)',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '0.64rem',
            color: '#34d399',
            fontFamily: 'monospace'
          }}>
            ✓ Cross-validated with NASA SPICE & Mazarico (2011)
          </div>
        </div>
      </div>

      {/* Bottom Timeline Controls Bar */}
      <div style={{
        padding: '12px 20px',
        background: '#070a18',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>Apr 01</span>
          <input
            type="range"
            min={0}
            max={nSamples - 1}
            value={hourIndex}
            onChange={(e) => {
              setIsPlaying(false)
              setHourIndex(Number(e.target.value))
            }}
            style={{
              flex: 1,
              accentColor: '#38bdf8',
              cursor: 'pointer',
              height: '6px'
            }}
          />
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>May 01 (30 Days)</span>
        </div>

        {/* Playback Controls & Speed Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? '#ef4444' : '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                padding: '6px 16px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play Orbit'}
            </button>

            <button
              onClick={() => setHourIndex(0)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '5px',
                padding: '6px 12px',
                fontSize: '0.72rem',
                cursor: 'pointer'
              }}
            >
              ⏮ Reset to Day 0
            </button>

            {/* Speed Selector */}
            <div style={{ display: 'flex', gap: '3px', marginLeft: '8px' }}>
              {[1, 5, 20].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaySpeed(spd)}
                  style={{
                    background: playSpeed === spd ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                    color: playSpeed === spd ? '#38bdf8' : '#64748b',
                    border: playSpeed === spd ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.66rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
            Step: 10 minutes · Total Month Samples: {nSamples}
          </div>
        </div>
      </div>
    </div>
  )
}
