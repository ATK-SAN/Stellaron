/** ChoreographyPlayer.jsx — Detailed 3D Mission Trajectory & Flight Rehearsal Playback
 *
 * Full Celestial Visualisation:
 * - Earth: Textured globe (2048px NASA Blue Marble) with rotating cloud layer & atmospheric Rayleigh glow
 * - Moon: Textured globe (1024px NASA LROC mosaic) with shadow terminator & South Pole exploration circle
 * - Sun: Radiant 3D Sun body with directional lighting, multi-tier corona & solar lens flare halos
 * - Target Landing Site: Pulsing landing beacon & coordinate target ring adapting to user selection
 * - Spacecraft: Detailed lunar lander model with solar arrays & supersonic rocket plume shader
 * - Trajectory: Trajectory ribbon adapting directly to touchdown at the selected site's latitude/longitude
 * - Flight Dynamics HUD: Real-time UTC clock, LOI orbit arrival timestamp, PDI, Touchdown, distance & telemetry
 * - Camera Controls: Seamless free look + one-click camera mode presets
 * - Non-surface phases marked: "Illustrative path, not a trajectory design."
 */

import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { createPlumeMaterial, createTrailRibbonMaterial, createCommsPulseMaterial } from '../../shaders'

// ─── 14 Canonical Landing Sites Metadata ─────────────────────────────────────
export const SITE_METADATA = {
  shackleton_connecting_ridge: { name: 'Shackleton Connecting Ridge', lat_deg: -89.54, lon_deg: 116.7, elevation_m: 1250 },
  shackleton_peak: { name: 'Peak Near Shackleton', lat_deg: -89.78, lon_deg: 154.5, elevation_m: 1420 },
  de_gerlache_rim_1: { name: 'de Gerlache Rim 1', lat_deg: -88.71, lon_deg: -88.7, elevation_m: 680 },
  de_gerlache_rim_2: { name: 'de Gerlache Rim 2', lat_deg: -88.34, lon_deg: -68.8, elevation_m: 520 },
  connecting_ridge_ext: { name: 'Connecting Ridge Extension', lat_deg: -89.44, lon_deg: -137.4, elevation_m: 950 },
  malapert_mountain: { name: 'Malapert Mountain', lat_deg: -85.99, lon_deg: 2.93, elevation_m: 5020 },
  haworth_rim: { name: 'Haworth Rim', lat_deg: -87.87, lon_deg: -5.1, elevation_m: -350 },
  nobile_rim_1: { name: 'Nobile Rim 1', lat_deg: -85.39, lon_deg: 37.85, elevation_m: 1800 },
  amundsen_rim: { name: 'Amundsen Rim', lat_deg: -84.5, lon_deg: 82.8, elevation_m: 1650 },
  faustini_rim_a: { name: 'Faustini Rim A', lat_deg: -87.1, lon_deg: 86.0, elevation_m: 850 },
  apollo_11: { name: 'Apollo 11 (Mare Tranquillitatis)', lat_deg: 0.67, lon_deg: 23.47, elevation_m: -2574 },
  apollo_12: { name: 'Apollo 12 (Oceanus Procellarum)', lat_deg: -3.01, lon_deg: -23.42, elevation_m: -1820 },
  apollo_17: { name: 'Apollo 17 (Taurus-Littrow)', lat_deg: 20.19, lon_deg: 30.77, elevation_m: -2520 },
  change_4: { name: "Chang'e 4 (Von Kármán)", lat_deg: -45.46, lon_deg: 177.6, elevation_m: -5930 },
}

const PHASE_COLORS = {
  PRELAUNCH_HOLD: '#64748b',
  TRANSIT: '#38bdf8',
  LUNAR_ORBIT: '#a78bfa',
  DESCENT: '#fbbf24',
  SURFACE: '#34d399',
}

// Coordinate transform: lat/lon to 3D Cartesian coordinates on sphere of radius r
function latLonToVec3(lat, lon, r = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

// ── 1. The Radiant Sun (3D Light Source & Coronal Halos) ──────────────────────
function SunObject({ position = [35.0, 16.0, 25.0], showLabels = true }) {
  const flareRef = useRef()

  useFrame(({ clock }) => {
    if (flareRef.current) {
      const t = clock.getElapsedTime()
      flareRef.current.rotation.z = t * 0.05
      const s = 1.0 + 0.05 * Math.sin(t * 2.5)
      flareRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group position={position}>
      {/* Primary Directional Sun Light illuminating Earth & Moon */}
      <directionalLight
        position={[0, 0, 0]}
        target-position={[-35.0, -16.0, -25.0]}
        intensity={2.8}
        color="#fffcf0"
      />
      {/* Point light for local omnidirectional radiation */}
      <pointLight color="#fff7ed" intensity={3.5} distance={120} decay={1} />

      {/* Sun Core Disk */}
      <mesh>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color="#fffef0" />
      </mesh>

      {/* Inner Coronal Atmosphere */}
      <mesh scale={[1.25, 1.25, 1.25]}>
        <sphereGeometry args={[1.4, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.BackSide} />
      </mesh>

      {/* Outer Golden Corona Halo */}
      <mesh ref={flareRef} scale={[1.85, 1.85, 1.85]}>
        <sphereGeometry args={[1.4, 20, 20]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.16} side={THREE.BackSide} />
      </mesh>

      {/* Extreme Optical Lens Flare Ring */}
      <mesh rotation={[Math.PI / 4, Math.PI / 6, 0]}>
        <ringGeometry args={[1.6, 3.2, 48]} />
        <meshBasicMaterial color="#fef08a" transparent opacity={0.10} side={THREE.DoubleSide} />
      </mesh>

      {showLabels && (
        <Html position={[0, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 800,
            background: 'rgba(251, 191, 36, 0.92)',
            color: '#000',
            padding: '3px 8px',
            borderRadius: '4px',
            boxShadow: '0 0 16px rgba(251,191,36,0.9)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}>
            ☀️ THE SUN · 1 AU (Solar Power Source)
          </div>
        </Html>
      )}
    </group>
  )
}

// ── 2. Detailed Earth Globe with Atmosphere & Clouds ─────────────────────────
function EarthObject({ position = [0, 0, 0], showLabels = true }) {
  const earthTexture = useLoader(THREE.TextureLoader, '/textures/earth_atmos_2048.jpg')
  const cloudsTexture = useLoader(THREE.TextureLoader, '/textures/earth_clouds_1024.png')
  const cloudsRef = useRef()

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.03
  })

  return (
    <group position={position}>
      {/* Solid Textured Earth (23.4° axial tilt) */}
      <mesh rotation={[0.41, 0, 0]} receiveShadow>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshStandardMaterial map={earthTexture} roughness={0.65} metalness={0.1} />
      </mesh>

      {/* Rotating Cloud Layer */}
      <mesh ref={cloudsRef} rotation={[0.41, 0, 0]} scale={[1.02, 1.02, 1.02]}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <meshStandardMaterial
          map={cloudsTexture}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Rayleigh Atmospheric Scattering Limb */}
      <mesh scale={[1.15, 1.15, 1.15]}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>

      {showLabels && (
        <Html position={[0, 2.1, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(2, 132, 199, 0.90)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            boxShadow: '0 0 12px rgba(56,189,248,0.7)',
            whiteSpace: 'nowrap',
          }}>
            🌍 EARTH · Launch Origin & DTE Transceiver
          </div>
        </Html>
      )}
    </group>
  )
}

// ── 3. Detailed Moon Globe & South Pole Target Site ───────────────────────────
function MoonObject({ position = [16.0, 3.0, -4.5], site, showLabels = true }) {
  const moonTexture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')
  const targetRingRef = useRef()

  const moonRadius = 0.9
  const siteRelPos = useMemo(() => {
    const lat = site?.lat_deg ?? -89.54
    const lon = site?.lon_deg ?? 116.7
    return latLonToVec3(lat, lon, moonRadius * 1.01)
  }, [site])

  const siteWorldPos = useMemo(() => [
    position[0] + siteRelPos[0],
    position[1] + siteRelPos[1],
    position[2] + siteRelPos[2],
  ], [position, siteRelPos])

  useFrame(({ clock }) => {
    if (targetRingRef.current) {
      const s = 1.0 + 0.35 * Math.sin(clock.getElapsedTime() * 4.0)
      targetRingRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group position={position}>
      {/* Textured Lunar Sphere with crater shadows */}
      <mesh receiveShadow>
        <sphereGeometry args={[moonRadius, 64, 64]} />
        <meshStandardMaterial
          map={moonTexture}
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>

      {/* Lunar South Pole Exploration Zone Marker (Artemis circle) */}
      <mesh position={[0, -moonRadius * 0.995, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.08, 36]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Target Landing Site Surface Beacon & Reticle */}
      <group position={siteRelPos}>
        {/* Pulsing Concentric Reticle Ring */}
        <mesh ref={targetRingRef}>
          <ringGeometry args={[0.03, 0.045, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* Solid Center Touchdown Target */}
        <mesh>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        {/* Vertical Holographic Guidance Beacon Beam */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.5, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
        </mesh>

        {/* Landing Site Holographic Label Tag */}
        {showLabels && (
          <Html position={[0, 0.55, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 800,
              background: 'rgba(6, 11, 25, 0.95)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '3px 8px',
              borderRadius: '5px',
              boxShadow: '0 0 14px rgba(56,189,248,0.7)',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}>
              <div>🎯 TARGET LANDING SITE</div>
              <div style={{ color: '#f8fafc', fontWeight: 700 }}>{site?.name || 'Shackleton Ridge'}</div>
              <div style={{ color: '#94a3b8', fontSize: '9px' }}>
                Lat: {site?.lat_deg?.toFixed(2)}° · Lon: {site?.lon_deg?.toFixed(2)}° · Elev: {site?.elevation_m ?? 1250}m
              </div>
            </div>
          </Html>
        )}
      </group>

      {/* Moon Title Label */}
      {showLabels && (
        <Html position={[0, 1.4, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(100, 116, 139, 0.85)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            🌕 THE MOON · Target Body (384,400 km)
          </div>
        </Html>
      )}
    </group>
  )
}

// ── 4. Detailed Spacecraft with Animated Rocket Plume ─────────────────────────
function SpacecraftMarker({ position, thrustActive, qualityTier }) {
  const plumeMat = useMemo(() => createPlumeMaterial(qualityTier), [qualityTier])
  const plumeRef = useRef()

  useFrame((_, delta) => {
    if (plumeMat.uniforms?.uTime) {
      plumeMat.uniforms.uTime.value += delta
      plumeMat.uniforms.uThrottle.value = thrustActive ? 1.0 : 0.0
    }
  })

  return (
    <group position={position}>
      {/* Octagonal Lander Body with MLI insulation foil */}
      <mesh>
        <cylinderGeometry args={[0.22, 0.28, 0.35, 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Equipment Avionics Deck */}
      <mesh position={[0, 0.20, 0]}>
        <cylinderGeometry args={[0.18, 0.20, 0.08, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* High-Gain Dish Antenna pointing back towards Earth */}
      <mesh position={[0, 0.32, 0]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.12, 0.06, 16, 1, true]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Deployable Solar Array Panels (Left & Right) */}
      <mesh position={[0.42, 0, 0]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.45, 0.02, 0.26]} />
        <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[-0.42, 0, 0]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.45, 0.02, 0.26]} />
        <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Quad Landing Gear Struts */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
        <group key={idx} rotation={[0, angle, 0]}>
          <mesh position={[0.22, -0.22, 0]} rotation={[0, 0, -0.45]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Supersonic Rocket Thruster Exhaust Plume Shader */}
      {thrustActive && (
        <mesh ref={plumeRef} position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.75, 16, 1, true]} />
          <primitive object={plumeMat} attach="material" />
        </mesh>
      )}
    </group>
  )
}

// ── 5. Flight Trajectory Ribbon ───────────────────────────────────────────────
function TrajectoryRibbon({ points, phase, qualityTier }) {
  const colorHex = PHASE_COLORS[phase] || '#38bdf8'
  const ribbonMat = useMemo(() => createTrailRibbonMaterial(colorHex, qualityTier), [colorHex, qualityTier])

  useFrame((_, delta) => {
    if (ribbonMat.uniforms?.uTime) ribbonMat.uniforms.uTime.value += delta
  })

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    if (points.length < 2) return geo
    const flatPoints = []
    points.forEach(p => flatPoints.push(p[0], p[1], p[2]))
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flatPoints, 3))
    return geo
  }, [points])

  return (
    <line geometry={lineGeo}>
      <lineBasicMaterial color={colorHex} transparent opacity={0.65} linewidth={2} />
    </line>
  )
}

// ── 6. Direct-to-Earth (DTE) Comms Pulse Beam ─────────────────────────────────
function CommsPulseBeam({ startPos, endPos, active, qualityTier }) {
  const commsMat = useMemo(() => createCommsPulseMaterial(qualityTier), [qualityTier])

  useFrame((_, delta) => {
    if (commsMat.uniforms?.uTime) {
      commsMat.uniforms.uTime.value += delta
      commsMat.uniforms.uCommsActive.value = active
    }
  })

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      startPos[0], startPos[1], startPos[2],
      endPos[0], endPos[1], endPos[2],
    ], 3))
    return geo
  }, [startPos, endPos])

  return (
    <line geometry={lineGeo}>
      <primitive object={commsMat} attach="material" />
    </line>
  )
}

// ── 7. Camera Rig Glide Controller ───────────────────────────────────────────
function CameraController({ cameraMode, craftPos, sitePos, moonPos }) {
  const controlsRef = useRef()

  useEffect(() => {
    if (!controlsRef.current) return
    const controls = controlsRef.current

    if (cameraMode === 'earth') {
      controls.target.set(0, 0, 0)
      controls.object.position.set(0, 2.5, 6.0)
    } else if (cameraMode === 'chase') {
      controls.target.set(craftPos[0], craftPos[1], craftPos[2])
      controls.object.position.set(craftPos[0] + 1.8, craftPos[1] + 1.2, craftPos[2] + 2.8)
    } else if (cameraMode === 'orbit') {
      controls.target.set(moonPos[0], moonPos[1], moonPos[2])
      controls.object.position.set(moonPos[0] + 3.2, moonPos[1] + 2.5, moonPos[2] + 4.0)
    } else if (cameraMode === 'site') {
      controls.target.set(sitePos[0], sitePos[1], sitePos[2])
      controls.object.position.set(sitePos[0] + 0.8, sitePos[1] + 0.5, sitePos[2] + 1.2)
    } else {
      // overview
      controls.target.set(8.0, 1.5, -2.0)
      controls.object.position.set(10.0, 14.0, 24.0)
    }
    controls.update()
  }, [cameraMode, craftPos, sitePos, moonPos])

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.06} />
}

// ── 8. Trajectory Frame Generator Adapting to Selected Site Coordinates ───────
function generateAdaptedFrames(site, plan) {
  const frames = []
  const moonPos = [16.0, 2.5, -4.5]
  const moonRadius = 0.9

  // Real landing site coordinates on Moon globe
  const lat = site?.lat_deg ?? -89.54
  const lon = site?.lon_deg ?? 116.7
  const siteRel = latLonToVec3(lat, lon, moonRadius * 1.01)
  const siteWorld = [
    moonPos[0] + siteRel[0],
    moonPos[1] + siteRel[1],
    moonPos[2] + siteRel[2],
  ]

  const transitDays = Number(plan?.transit_days ?? 4.0)
  const orbitDays = Number(plan?.orbit_hold_days ?? 1.0)
  const surfaceDays = Number(plan?.surface_days ?? 14.0)

  const launchDate = new Date(plan?.launch_utc || '2026-04-01T00:00:00Z')
  const loiDate = new Date(launchDate.getTime() + transitDays * 86400000)
  const pdiDate = new Date(loiDate.getTime() + orbitDays * 86400000)
  const landingDate = new Date(pdiDate.getTime() + 2 * 3600000) // 2h descent
  const surfaceEndDate = new Date(landingDate.getTime() + surfaceDays * 86400000)

  const totalSteps = 140

  for (let i = 0; i <= totalSteps; i++) {
    let phase = 'PRELAUNCH_HOLD'
    let craftPos = [0, 1.62, 0]
    let thrust = false
    let event = null
    let altKm = 384400.0
    let velocityKms = 0.0
    let timeUtc = launchDate

    if (i < 8) {
      // Phase 1: PRELAUNCH HOLD
      phase = 'PRELAUNCH_HOLD'
      craftPos = [0, 1.62, 0]
      thrust = (i >= 6)
      event = (i === 6) ? 'LIFTOFF' : 'COUNTDOWN'
      altKm = (i >= 6) ? 120.0 : 0.0
      velocityKms = (i >= 6) ? 7.8 : 0.0
      timeUtc = new Date(launchDate.getTime() - (8 - i) * 3600000)
    } else if (i < 70) {
      // Phase 2: TRANSLUNAR TRANSIT
      phase = 'TRANSIT'
      const frac = (i - 8) / 62.0
      const smooth = frac * frac * (3 - 2 * frac)

      // Arcing transfer trajectory approaching lunar orbit insertion
      const startPos = [0, 1.8, 0]
      const approachOrbitPos = [moonPos[0] - 1.8, moonPos[1] + 1.2, moonPos[2] + 0.6]

      craftPos = [
        startPos[0] * (1 - smooth) + approachOrbitPos[0] * smooth,
        startPos[1] * (1 - smooth) + approachOrbitPos[1] * smooth + Math.sin(frac * Math.PI) * 4.2,
        startPos[2] * (1 - smooth) + approachOrbitPos[2] * smooth + Math.sin(frac * Math.PI) * 2.1,
      ]

      thrust = (i === 8 || i === 38)
      if (i === 8) event = 'TLI_BURN'
      else if (i === 38) event = 'MIDCOURSE_CORRECTION'

      altKm = Math.round(384400.0 * (1.0 - frac))
      velocityKms = +(1.1 + Math.sin(frac * Math.PI) * 9.8).toFixed(2)
      timeUtc = new Date(launchDate.getTime() + frac * transitDays * 86400000)
    } else if (i < 98) {
      // Phase 3: LUNAR ORBIT HOLD
      phase = 'LUNAR_ORBIT'
      const frac = (i - 70) / 28.0
      const angle = frac * Math.PI * 4.0 // 2 polar revolutions around Moon
      const orbitR = moonRadius + 0.35 // 100 km orbit scale

      craftPos = [
        moonPos[0] + orbitR * Math.cos(angle),
        moonPos[1] + orbitR * Math.sin(angle) * 0.85,
        moonPos[2] + orbitR * Math.sin(angle) * 0.65,
      ]

      thrust = (i === 70)
      if (i === 70) event = 'LOI_INSERTION'
      altKm = 100.0
      velocityKms = 1.63
      timeUtc = new Date(loiDate.getTime() + frac * orbitDays * 86400000)
    } else if (i < 118) {
      // Phase 4: POWERED DESCENT INITIATION (PDI) SPIRALING DIRECTLY TO SITE
      phase = 'DESCENT'
      const frac = (i - 98) / 20.0
      const smooth = frac * frac * (3 - 2 * frac)

      // Start from deorbit node, curve and touch down EXACTLY on siteWorld!
      const deorbitNode = [moonPos[0] + 0.5, moonPos[1] + 0.8, moonPos[2] + 0.3]
      craftPos = [
        deorbitNode[0] * (1 - smooth) + siteWorld[0] * smooth,
        deorbitNode[1] * (1 - smooth) + siteWorld[1] * smooth,
        deorbitNode[2] * (1 - smooth) + siteWorld[2] * smooth,
      ]

      thrust = true
      if (i === 98) event = 'PDI_BURN'
      else if (i === 117) event = 'TOUCHDOWN'

      altKm = +((1.0 - frac) * 15.0).toFixed(1)
      velocityKms = +((1.0 - frac) * 1.6).toFixed(2)
      timeUtc = new Date(pdiDate.getTime() + frac * 2 * 3600000)
    } else {
      // Phase 5: SURFACE OPERATIONS (Sitting precisely on the target site!)
      phase = 'SURFACE'
      craftPos = siteWorld
      thrust = false
      event = (i === 118) ? 'SURFACE_OPS' : null
      altKm = 0.0
      velocityKms = 0.0
      const frac = (i - 118) / (totalSteps - 118)
      timeUtc = new Date(landingDate.getTime() + frac * surfaceDays * 86400000)
    }

    frames.push({
      step: i,
      phase,
      schematic: phase !== 'SURFACE',
      craftPos,
      thrust,
      event,
      altKm,
      velocityKms,
      timeUtc: timeUtc.toISOString(),
      earthPos: [0, 0, 0],
      moonPos,
      siteWorldPos: siteWorld,
    })
  }

  return {
    frames,
    milestones: {
      launchUtc: launchDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      loiUtc: loiDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      loiOffsetDays: transitDays,
      pdiUtc: pdiDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      landingUtc: landingDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      surfaceEndUtc: surfaceEndDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    },
  }
}

// ── Main ChoreographyPlayer Component ─────────────────────────────────────────
export default function ChoreographyPlayer({
  plan,
  siteId = 'shackleton_connecting_ridge',
  siteName,
  timeline,
  surfaceMetrics,
  qualityTier = 'High',
  onQualityChange,
}) {
  const site = useMemo(() => {
    return SITE_METADATA[siteId] || SITE_METADATA['shackleton_connecting_ridge']
  }, [siteId])

  const { frames, milestones } = useMemo(() => {
    return generateAdaptedFrames(site, plan)
  }, [site, plan])

  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)
  const [cameraMode, setCameraMode] = useState('overview') // 'overview' | 'earth' | 'chase' | 'orbit' | 'site'
  const [showLabels, setShowLabels] = useState(true)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev >= frames.length - 1 ? 0 : prev + 1))
    }, 120 / playSpeed)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, frames.length])

  const curFrame = frames[currentStep] || frames[0]

  const trailPoints = useMemo(() => {
    return frames.slice(0, currentStep + 1).map(f => f.craftPos)
  }, [frames, currentStep])

  // Sun 3D Position
  const sunPosition = [35.0, 16.0, 25.0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711', position: 'relative' }}>
      {/* ── Top Left: Non-negotiable Schematic Notice Banner ── */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 16,
        zIndex: 10,
        background: 'rgba(7,10,24,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(251,191,36,0.35)',
        borderRadius: '6px',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      }}>
        <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>⚠</span>
        <div>
          <div style={{ fontSize: '0.70rem', color: '#fbbf24', fontStyle: 'italic', fontWeight: 700 }}>
            Schematic phases: Illustrative path, not a trajectory design.
          </div>
          <div style={{ fontSize: '0.60rem', color: '#94a3b8' }}>
            Surface physics is real SPICE ephemeris & LOLA horizon evaluation.
          </div>
        </div>
      </div>

      {/* ── Top Right: Quality Tier & UI Toggles ── */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 10,
        background: 'rgba(7,10,24,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        padding: '5px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <button
          onClick={() => setShowLabels(!showLabels)}
          style={{
            background: showLabels ? 'rgba(56,189,248,0.2)' : 'transparent',
            border: '1px solid rgba(56,189,248,0.3)',
            color: showLabels ? '#38bdf8' : '#64748b',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '0.64rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showLabels ? '🏷 Labels: ON' : '🏷 Labels: OFF'}
        </button>

        <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Shaders:</span>
        {['Low', 'Medium', 'High'].map(t => (
          <button
            key={t}
            onClick={() => onQualityChange && onQualityChange(t)}
            style={{
              background: qualityTier === t ? '#0284c7' : 'transparent',
              color: qualityTier === t ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.64rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Floating Flight Dynamics & Orbit Milestone HUD ── */}
      <div style={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 10,
        background: 'rgba(6,11,25,0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '260px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
          <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Mission Telemetry & Milestones
          </div>
          <span style={{
            fontSize: '0.62rem',
            background: `${PHASE_COLORS[curFrame.phase]}25`,
            color: PHASE_COLORS[curFrame.phase],
            border: `1px solid ${PHASE_COLORS[curFrame.phase]}60`,
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
          }}>
            {curFrame.phase}
          </span>
        </div>

        {/* Current Playback Time */}
        <div>
          <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase' }}>Simulation Time (UTC)</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
            {curFrame.timeUtc.slice(0, 16).replace('T', ' ')} UTC
          </div>
        </div>

        {/* Critical Orbit Insertion Timestamp (LOI) */}
        <div style={{
          background: curFrame.phase === 'LUNAR_ORBIT' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${curFrame.phase === 'LUNAR_ORBIT' ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '5px',
          padding: '6px 8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#a78bfa', fontWeight: 700 }}>
            <span>🌕 LUNAR ORBIT INSERTION (LOI)</span>
            <span>T+{milestones.loiOffsetDays}d</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#f1f5f9', fontWeight: 600, marginTop: '2px' }}>
            {milestones.loiUtc}
          </div>
        </div>

        {/* Touchdown Timestamp */}
        <div style={{
          background: curFrame.phase === 'SURFACE' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${curFrame.phase === 'SURFACE' ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '5px',
          padding: '6px 8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: '#34d399', fontWeight: 700 }}>
            <span>🎯 SITE TOUCHDOWN</span>
            <span>{site?.name?.slice(0, 16)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#f1f5f9', fontWeight: 600, marginTop: '2px' }}>
            {milestones.landingUtc}
          </div>
        </div>

        {/* Live Dynamics Numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.64rem', marginTop: '2px' }}>
          <div style={{ background: 'rgba(5,7,17,0.5)', padding: '4px 6px', borderRadius: '4px' }}>
            <span style={{ color: '#64748b' }}>Dist to Moon: </span>
            <span style={{ color: '#f1f5f9', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {curFrame.altKm > 0 ? `${curFrame.altKm.toLocaleString()} km` : 'ON SURFACE'}
            </span>
          </div>
          <div style={{ background: 'rgba(5,7,17,0.5)', padding: '4px 6px', borderRadius: '4px' }}>
            <span style={{ color: '#64748b' }}>Velocity: </span>
            <span style={{ color: '#f1f5f9', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {curFrame.velocityKms} km/s
            </span>
          </div>
        </div>

        {/* Engine Thrust Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem' }}>
          <span style={{ color: '#64748b' }}>Engine Propulsion:</span>
          <span style={{
            color: curFrame.thrust ? '#fbbf24' : '#64748b',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
          }}>
            {curFrame.thrust ? '🔥 THRUST FIRING (100%)' : 'IDLE / COAST'}
          </span>
        </div>
      </div>

      {/* ── Camera View Preset Buttons ── */}
      <div style={{
        position: 'absolute',
        bottom: 82,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: 'rgba(7,10,24,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}>
        <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginRight: '4px' }}>
          Camera:
        </span>
        {[
          { id: 'overview', label: '🌐 System Overview' },
          { id: 'earth', label: '🌍 Earth Departure' },
          { id: 'chase', label: '🚀 Spacecraft Chase' },
          { id: 'orbit', label: '🌕 Lunar Orbit (LOI)' },
          { id: 'site', label: '🎯 Landing Site Reticle' },
        ].map(cam => (
          <button
            key={cam.id}
            onClick={() => setCameraMode(cam.id)}
            style={{
              background: cameraMode === cam.id ? '#0284c7' : 'rgba(255,255,255,0.06)',
              color: cameraMode === cam.id ? '#fff' : '#cbd5e1',
              border: cameraMode === cam.id ? '1px solid #38bdf8' : '1px solid transparent',
              borderRadius: '5px',
              padding: '4px 9px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cam.label}
          </button>
        ))}
      </div>

      {/* ── 3D WebGL Canvas ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [10, 14, 24], fov: 45 }}>
          {/* Subtle Ambient Fill Light (Space has dark, physical shadows) */}
          <ambientLight intensity={0.12} />

          {/* Deep Starfield Backdrop */}
          <Stars radius={150} depth={60} count={3500} factor={4} saturation={0} fade speed={0.8} />

          {/* Smooth Glide OrbitControls with free-look navigation */}
          <CameraController
            cameraMode={cameraMode}
            craftPos={curFrame.craftPos}
            sitePos={curFrame.siteWorldPos}
            moonPos={curFrame.moonPos}
          />

          <Suspense fallback={null}>
            {/* 1. The Radiant Sun (Light Source + Coronal Halos) */}
            <SunObject position={sunPosition} showLabels={showLabels} />

            {/* 2. Detailed Textured Earth with Atmosphere & Rotating Clouds */}
            <EarthObject position={curFrame.earthPos} showLabels={showLabels} />

            {/* 3. Detailed Textured Moon with Landing Site Beacon */}
            <MoonObject position={curFrame.moonPos} site={site} showLabels={showLabels} />

            {/* 4. Trajectory Ribbon Arcing from Earth to Target Landing Site */}
            <TrajectoryRibbon points={trailPoints} phase={curFrame.phase} qualityTier={qualityTier} />

            {/* 5. Spacecraft Marker with Plume Shader */}
            <SpacecraftMarker position={curFrame.craftPos} thrustActive={curFrame.thrust} qualityTier={qualityTier} />

            {/* 6. Direct-to-Earth (DTE) Comms Microwave Pulse Beam */}
            {curFrame.phase === 'SURFACE' && (
              <CommsPulseBeam
                startPos={curFrame.siteWorldPos}
                endPos={curFrame.earthPos}
                active={true}
                qualityTier={qualityTier}
              />
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* ── Playback Controls & Time Scrubber Bar ── */}
      <div style={{
        background: '#070a18',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Play/Pause & Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? 'rgba(248,113,113,0.18)' : 'rgba(56,189,248,0.22)',
                border: `1px solid ${isPlaying ? 'rgba(248,113,113,0.5)' : 'rgba(56,189,248,0.5)'}`,
                color: isPlaying ? '#f87171' : '#38bdf8',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play 3D'}
            </button>
            {[1, 5, 20].map(s => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                style={{
                  background: playSpeed === s ? '#0284c7' : 'rgba(255,255,255,0.06)',
                  color: playSpeed === s ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Current Event Milestone Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: `${PHASE_COLORS[curFrame.phase]}25`,
              color: PHASE_COLORS[curFrame.phase],
              border: `1px solid ${PHASE_COLORS[curFrame.phase]}60`,
              borderRadius: '4px',
              padding: '3px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
            }}>
              {curFrame.phase}
            </span>
            {curFrame.event && (
              <span style={{
                background: 'rgba(251,191,36,0.18)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.5)',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}>
                ✦ {curFrame.event}
              </span>
            )}
          </div>
        </div>

        {/* Time Slider & Progress Axis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            🚀 Launch (T+0)
          </span>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentStep}
            onChange={e => setCurrentStep(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#38bdf8', height: '6px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            🎯 Touchdown ({site?.name?.slice(0, 14)}...)
          </span>
        </div>
      </div>
    </div>
  )
}
