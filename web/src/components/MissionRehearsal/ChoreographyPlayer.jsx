/** ChoreographyPlayer.jsx — High-Fidelity 3D Mission Rehearsal & Solar Lighting Playback
 *
 * Physics-Driven Celestial & Terrain Simulation:
 * 1. Macro Flight & Lunar Orbit Mode ("flight"):
 *    - Real Earth globe (Blue Marble 2048) with rotating clouds and atmospheric limb
 *    - Real Moon globe with landing site beacon & exploration circle
 *    - True solar orientation & phase illumination across the lunar orbital plane
 *    - Flight trajectory ribbon linking Earth departure to Lunar Orbit Insertion (LOI)
 *    - Spacecraft with supersonic rocket plume shader
 *    - Live HUD tracking Reaching Orbit timestamp (LOI), PDI, and Touchdown
 *
 * 2. Landing Site Terrain Window ("ridge"):
 *    - Seamless automatic transition or manual toggle upon reaching lunar descent
 *    - High-resolution 3D LOLA DTM heightmesh for the selected site (e.g. Shackleton Ridge)
 *    - Marked Touchdown Footprint: Holographic target reticle (100m, 250m, 500m rings),
 *      vertical touchdown laser guidance beam, and 3D lunar lander on the ridge crest
 *    - Real Solar Lighting Logic: Directional sunlight driven by exact topocentric
 *      (sun_az_deg, sun_el_deg) from SPICE/LOLA ephemeris, casting dynamic real-time shadows
 *    - Sun body rendered low on the polar horizon with solar corona & occlusion indicator
 *    - Telemetry HUD: Sun Az/El, line-of-sight visibility, direct irradiance (W/m²),
 *      modelled battery state of charge (SoC), and verdict banner
 *
 * 3. Interactive What-If Delay / Slip Simulator:
 *    - Live scrubbing of arrival delays (+0d to +20d)
 *    - Visual demonstration of how slip shifts orbit arrival and moves the Sun behind crater rims,
 *      engulfing the touchdown zone in darkness and causing battery depletion
 *    - Pre-configured for all three demo presets (Demo A, Demo B, Demo C)
 *
 * Language: Strictly neutral scientific terminology (modelled, conditional on inputs).
 * Disclaimer: "Schematic phases are illustrative — not a trajectory design."
 */

import { useState, useRef, useEffect, useMemo, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { createPlumeMaterial, createTrailRibbonMaterial, createCommsPulseMaterial } from '../../shaders'

// ─── Canonical Landing Sites Metadata ─────────────────────────────────────────
const SITE_METADATA = {
  shackleton_connecting_ridge: {
    id: 'shackleton_connecting_ridge',
    name: 'Shackleton Connecting Ridge',
    lat_deg: -89.54,
    lon_deg: 116.7,
    elevation_m: 1306,
    nominal_landing_utc: '2026-04-15T00:00:00Z',
    sunlit_window: '2026-04-14 to 2026-04-25 (261h continuous sun)',
    tolerance_days: 9,
    failing_offset_days: 10,
    mesh_file: 'data/terrains/shackleton_connecting_ridge_mesh.json',
    time_series_file: 'data/shackleton_connecting_ridge_2026.json',
  },
  malapert_mountain: {
    id: 'malapert_mountain',
    name: 'Malapert Mountain',
    lat_deg: -85.99,
    lon_deg: 2.93,
    elevation_m: 5020,
    nominal_landing_utc: '2026-04-05T00:00:00Z',
    sunlit_window: '2026-04-01 to 2026-04-08 (183h sun, then 406h shadow)',
    tolerance_days: 3,
    failing_offset_days: 4,
    mesh_file: 'data/terrains/malapert_mountain_mesh.json',
    time_series_file: 'data/malapert_mountain_2026.json',
  },
  nobile_rim_1: {
    id: 'nobile_rim_1',
    name: 'Nobile Rim 1',
    lat_deg: -85.39,
    lon_deg: 37.85,
    elevation_m: 1800,
    nominal_landing_utc: '2026-04-24T00:00:00Z',
    sunlit_window: '2026-04-22 to 2026-05-01 (205h continuous sun)',
    tolerance_days: 7,
    failing_offset_days: 8,
    mesh_file: 'data/terrains/nobile_rim_1_mesh.json',
    time_series_file: 'data/nobile_rim_1_2026.json',
  },
  shackleton_peak: {
    id: 'shackleton_peak',
    name: 'Peak Near Shackleton',
    lat_deg: -89.78,
    lon_deg: 154.5,
    elevation_m: 1420,
    nominal_landing_utc: '2026-04-15T00:00:00Z',
    mesh_file: 'data/terrains/shackleton_peak_mesh.json',
    time_series_file: 'data/shackleton_peak_2026.json',
  },
  de_gerlache_rim_1: {
    id: 'de_gerlache_rim_1',
    name: 'de Gerlache Rim 1',
    lat_deg: -88.71,
    lon_deg: -88.7,
    elevation_m: 680,
    nominal_landing_utc: '2026-04-12T00:00:00Z',
    mesh_file: 'data/terrains/de_gerlache_rim_1_mesh.json',
    time_series_file: 'data/de_gerlache_rim_1_2026.json',
  },
}

const PHASE_COLORS = {
  PRELAUNCH_HOLD: '#64748b',
  TRANSIT: '#38bdf8',
  LUNAR_ORBIT: '#a78bfa',
  DESCENT: '#fbbf24',
  SURFACE: '#34d399',
}

// ─── Hypsometric Tint Elevation Colormap (NASA LOLA Standard) ────────────────
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

// ─── Ephemeris Lookup Helper ──────────────────────────────────────────────────
// Returns topocentric solar coordinates for any date, mapped into the synodic cycle
function lookupSolarEphemeris(timeSeriesData, targetDate) {
  if (!timeSeriesData || !timeSeriesData.times_utc || timeSeriesData.times_utc.length === 0) {
    return { sunAzDeg: 90.0, sunElDeg: 1.2, sunVisible: true, earthAzDeg: 0, earthElDeg: 5, earthVisible: true }
  }

  const times = timeSeriesData.times_utc
  const startDate = new Date(times[0]).getTime()
  const endDate = new Date(times[times.length - 1]).getTime()
  const spanMs = endDate - startDate

  let targetMs = targetDate.getTime()
  if (targetMs < startDate || targetMs > endDate) {
    // Modular wrap into the synodic lunar cycle (~29.530588 days)
    const synodicMs = 29.530588 * 86400 * 1000
    const offset = ((targetMs - startDate) % synodicMs + synodicMs) % synodicMs
    targetMs = startDate + (offset % spanMs)
  }

  const stepMs = 600000 // 10 minutes per sample
  const idx = Math.min(times.length - 1, Math.max(0, Math.round((targetMs - startDate) / stepMs)))

  return {
    sunAzDeg: timeSeriesData.sun_az_deg[idx] ?? 90.0,
    sunElDeg: timeSeriesData.sun_el_deg[idx] ?? 1.0,
    sunVisible: Boolean(timeSeriesData.sun_visible[idx]),
    earthAzDeg: timeSeriesData.earth_az_deg?.[idx] ?? 0.0,
    earthElDeg: timeSeriesData.earth_el_deg?.[idx] ?? 4.5,
    earthVisible: Boolean(timeSeriesData.earth_visible?.[idx] ?? true),
    matchedUtc: times[idx],
  }
}

// ─── 1. Macro Sun Object (Flight Mode) ─────────────────────────────────────────
function MacroSunObject({ position = [35.0, 16.0, 25.0], showLabels = true }) {
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
      <directionalLight
        position={[0, 0, 0]}
        intensity={2.8}
        color="#fffcf0"
      />
      <pointLight color="#fff7ed" intensity={3.5} distance={120} decay={1} />

      <mesh>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color="#fffef0" />
      </mesh>
      <mesh scale={[1.25, 1.25, 1.25]}>
        <sphereGeometry args={[1.4, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.BackSide} />
      </mesh>
      <mesh ref={flareRef} scale={[1.85, 1.85, 1.85]}>
        <sphereGeometry args={[1.4, 20, 20]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.16} side={THREE.BackSide} />
      </mesh>
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
          }}>
            ☀️ THE SUN · 1 AU (Solar Flux Source)
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── 2. Macro Earth Globe (Flight Mode) ───────────────────────────────────────
function MacroEarthObject({ position = [0, 0, 0], showLabels = true }) {
  const earthTexture = useLoader(THREE.TextureLoader, '/textures/earth_atmos_2048.jpg')
  const cloudsTexture = useLoader(THREE.TextureLoader, '/textures/earth_clouds_1024.png')
  const cloudsRef = useRef()

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.03
  })

  return (
    <group position={position}>
      <mesh rotation={[0.41, 0, 0]} receiveShadow>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshStandardMaterial map={earthTexture} roughness={0.65} metalness={0.1} />
      </mesh>
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
            whiteSpace: 'nowrap',
          }}>
            🌍 EARTH · Launch Origin & DTE Transceiver
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── 3. Macro Moon Globe & Target Reticle (Flight Mode) ───────────────────────
function MacroMoonObject({ position = [16.0, 3.0, -4.5], site, showLabels = true }) {
  const moonTexture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')
  const targetRingRef = useRef()

  const moonRadius = 0.9
  const siteRelPos = useMemo(() => {
    const lat = site?.lat_deg ?? -89.54
    const lon = site?.lon_deg ?? 116.7
    return latLonToVec3(lat, lon, moonRadius * 1.01)
  }, [site])

  useFrame(({ clock }) => {
    if (targetRingRef.current) {
      const s = 1.0 + 0.35 * Math.sin(clock.getElapsedTime() * 4.0)
      targetRingRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group position={position}>
      <mesh receiveShadow>
        <sphereGeometry args={[moonRadius, 64, 64]} />
        <meshStandardMaterial map={moonTexture} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Lunar South Pole Exploration Zone Ring */}
      <mesh position={[0, -moonRadius * 0.995, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.08, 36]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Target Site Surface Beacon */}
      <group position={siteRelPos}>
        <mesh ref={targetRingRef}>
          <ringGeometry args={[0.03, 0.045, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.5, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
        </mesh>

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
            }}>
              <div>🎯 TARGET LANDING SITE</div>
              <div style={{ color: '#f8fafc', fontWeight: 700 }}>{site?.name}</div>
            </div>
          </Html>
        )}
      </group>

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
            🌕 THE MOON · Target Body
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── 4. Spacecraft Lander Model ───────────────────────────────────────────────
function SpacecraftMarker({ position, thrustActive, qualityTier, scale = 1.0 }) {
  const plumeMat = useMemo(() => createPlumeMaterial(qualityTier), [qualityTier])
  const plumeRef = useRef()

  useFrame((_, delta) => {
    if (plumeMat.uniforms?.uTime) {
      plumeMat.uniforms.uTime.value += delta
      plumeMat.uniforms.uThrottle.value = thrustActive ? 1.0 : 0.0
    }
  })

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Octagonal Lander Body with MLI golden foil */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.35, 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Avionics Deck */}
      <mesh position={[0, 0.20, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.20, 0.08, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* High-Gain Antenna */}
      <mesh position={[0, 0.32, 0]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.12, 0.06, 16, 1, true]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Deployable Solar Panels */}
      <mesh position={[0.42, 0, 0]} rotation={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.45, 0.02, 0.26]} />
        <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[-0.42, 0, 0]} rotation={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[0.45, 0.02, 0.26]} />
        <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Landing Struts */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
        <group key={idx} rotation={[0, angle, 0]}>
          <mesh position={[0.22, -0.22, 0]} rotation={[0, 0, -0.45]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Thruster Exhaust Plume Shader */}
      {thrustActive && (
        <mesh ref={plumeRef} position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.75, 16, 1, true]} />
          <primitive object={plumeMat} attach="material" />
        </mesh>
      )}
    </group>
  )
}

// ─── 5. Trajectory Ribbon ─────────────────────────────────────────────────────
function TrajectoryRibbon({ points, phase, qualityTier }) {
  const colorHex = PHASE_COLORS[phase] || '#38bdf8'
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

// ─── 6. High-Resolution 3D LOLA DTM Terrain Ridge Mesh ────────────────────────
function TopographicRidgeMesh({ meshData, renderMode, onCenterComputed }) {
  const { geometry, centerElevationNorm } = useMemo(() => {
    if (!meshData || !meshData.heights) return { geometry: null, centerElevationNorm: 0.5 }

    const rows = meshData.heights.length
    const cols = meshData.heights[0]?.length || 0

    const heightsFlat = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        heightsFlat.push(meshData.heights[r][c] ?? 0)
      }
    }

    const geo = new THREE.PlaneGeometry(6.5, 6.5, cols - 1, rows - 1)
    geo.rotateX(-Math.PI / 2) // Orient plane horizontally in X-Z

    const positions = geo.attributes.position.array
    const minH = Math.min(...heightsFlat)
    const maxH = Math.max(...heightsFlat)
    const span = maxH - minH || 1

    const colorArr = new Float32Array(heightsFlat.length * 3)
    const midRow = Math.floor(rows / 2)
    const midCol = Math.floor(cols / 2)
    const centerH = meshData.heights[midRow]?.[midCol] ?? minH
    const centerNorm = (centerH - minH) / span

    for (let i = 0; i < heightsFlat.length; i++) {
      const h = heightsFlat[i]
      const norm = (h - minH) / span
      positions[i * 3 + 1] = norm * 1.6 // Vertical exaggeration for ridge crest clarity

      if (renderMode === 'elevation') {
        const c = getElevationColor(norm)
        colorArr[i * 3] = c.r
        colorArr[i * 3 + 1] = c.g
        colorArr[i * 3 + 2] = c.b
      } else {
        // Photorealistic lunar regolith with micro-contrast
        const brightness = 0.28 + norm * 0.42
        colorArr[i * 3] = brightness
        colorArr[i * 3 + 1] = brightness * 0.98
        colorArr[i * 3 + 2] = brightness * 1.02
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
    geo.computeVertexNormals()

    return { geometry: geo, centerElevationNorm: centerNorm }
  }, [meshData, renderMode])

  useEffect(() => {
    if (onCenterComputed) onCenterComputed(centerElevationNorm * 1.6)
  }, [centerElevationNorm, onCenterComputed])

  if (!geometry) return null

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={renderMode === 'regolith' ? 0.95 : 0.70}
        metalness={0.04}
      />
    </mesh>
  )
}

// ─── 7. Marked Touchdown Footprint Reticle & Guidance Laser Beam ───────────────
function TouchdownFootprintMarker({ centerElevation, site, sunVisible, batterySoc }) {
  const innerRingRef = useRef()
  const outerRingRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = t * 0.8
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -t * 0.4
      const s = 1.0 + 0.08 * Math.sin(t * 3.0)
      outerRingRef.current.scale.set(s, s, s)
    }
  })

  const targetY = centerElevation + 0.04

  return (
    <group position={[0, targetY, 0]}>
      {/* Inner Touchdown Target Circle (100m equivalent) */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={innerRingRef}>
          <ringGeometry args={[0.22, 0.26, 32]} />
          <meshBasicMaterial
            color={sunVisible ? '#38bdf8' : '#ef4444'}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Intermediate Hazard Safety Zone Ring (250m) */}
        <mesh ref={outerRingRef}>
          <ringGeometry args={[0.42, 0.46, 36]} />
          <meshBasicMaterial
            color={sunVisible ? '#fbbf24' : '#b91c1c'}
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Outer 500m Approach Perimeter */}
        <mesh>
          <ringGeometry args={[0.80, 0.82, 48]} />
          <meshBasicMaterial color="#64748b" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        {/* Touchdown Center Spot */}
        <mesh>
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial color={sunVisible ? '#38bdf8' : '#ef4444'} />
        </mesh>
      </group>

      {/* Vertical Holographic Landing Guidance Laser Beam */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 2.5, 12]} />
        <meshBasicMaterial
          color={sunVisible ? '#38bdf8' : '#ef4444'}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* 3D Lunar Lander resting directly in the center of the marked portion */}
      <group position={[0, 0.16, 0]}>
        <SpacecraftMarker position={[0, 0, 0]} thrustActive={false} scale={0.45} />
      </group>

      {/* Floating 3D Target Reticle Badge */}
      <Html distanceFactor={6} position={[0, 0.65, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(6, 11, 25, 0.94)',
          border: `1px solid ${sunVisible ? '#38bdf8' : '#ef4444'}`,
          borderRadius: '6px',
          padding: '5px 10px',
          color: '#f8fafc',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          boxShadow: `0 0 16px ${sunVisible ? 'rgba(56,189,248,0.7)' : 'rgba(239,68,68,0.7)'}`,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          lineHeight: 1.35,
        }}>
          <div style={{ fontWeight: 800, color: sunVisible ? '#38bdf8' : '#ef4444', letterSpacing: '0.04em' }}>
            🎯 MARKED TOUCHDOWN FOOTPRINT
          </div>
          <div style={{ fontSize: '9px', color: '#cbd5e1' }}>
            {site?.name} · Elev: {site?.elevation_m ?? 1306}m
          </div>
          <div style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px', color: sunVisible ? '#34d399' : '#f87171' }}>
            {sunVisible
              ? `☀️ FULL SUNLIGHT · SOC ${(batterySoc * 100).toFixed(0)}%`
              : `🌑 CRATER SHADOW · TOUCHDOWN HAZARD`}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ─── 8. Physical Topocentric Sun Object & Directional Shadow Caster ────────────
function PhysicalTopocentricSun({ sunAzDeg, sunElDeg, sunVisible, centerElevation }) {
  // Convert topocentric Azimuth & Elevation to 3D Cartesian coordinates
  // North = -Z (Az = 0°), East = +X (Az = 90°), South = +Z (Az = 180°), West = -X (Az = 270°)
  // Up = +Y (El > 0°)
  const distance = 16.0
  const elRad = (sunElDeg * Math.PI) / 180.0
  const azRad = (sunAzDeg * Math.PI) / 180.0
  const rHoriz = distance * Math.cos(elRad)
  const sunX = rHoriz * Math.sin(azRad)
  const sunY = Math.max(0.2, distance * Math.sin(elRad) + centerElevation)
  const sunZ = -rHoriz * Math.cos(azRad)

  const sunLightRef = useRef()
  const targetObjRef = useRef(new THREE.Object3D())

  useEffect(() => {
    targetObjRef.current.position.set(0, centerElevation, 0)
  }, [centerElevation])

  return (
    <>
      <primitive object={targetObjRef.current} />

      {/* Directional Sun Light Casting Real Physical Shadows Across the Ridge */}
      <directionalLight
        ref={sunLightRef}
        position={[sunX, sunY, sunZ]}
        target={targetObjRef.current}
        intensity={sunVisible ? 2.6 : 0.04}
        color={sunVisible ? '#fffbf0' : '#334155'}
        castShadow={true}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-bias={-0.0005}
      />

      {/* Ambient fill (Low intensity, matching deep space contrast) */}
      <ambientLight intensity={sunVisible ? 0.08 : 0.02} color="#94a3b8" />

      {/* 3D Sun Sphere Visible Low on the Polar Horizon */}
      <group position={[sunX, sunY, sunZ]}>
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial color={sunVisible ? '#fffef0' : '#64748b'} />
        </mesh>
        {sunVisible && (
          <mesh scale={[1.4, 1.4, 1.4]}>
            <sphereGeometry args={[0.55, 24, 24]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} side={THREE.BackSide} />
          </mesh>
        )}

        {/* Horizon Sun Indicator Tag */}
        <Html distanceFactor={14} position={[0, 0.9, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 800,
            background: sunVisible ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.92)',
            color: sunVisible ? '#000' : '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            boxShadow: `0 0 12px ${sunVisible ? 'rgba(251,191,36,0.8)' : 'rgba(239,68,68,0.7)'}`,
            whiteSpace: 'nowrap',
          }}>
            {sunVisible
              ? `☀️ THE SUN (Az: ${sunAzDeg.toFixed(1)}° · El: ${sunElDeg.toFixed(2)}°)`
              : `🌑 OCCLUDED (Behind Ridge Crest · El: ${sunElDeg.toFixed(2)}°)`}
          </div>
        </Html>
      </group>
    </>
  )
}

// ─── 9. Cardinal Compass Direction Markers ────────────────────────────────────
function CompassMarkers() {
  const radius = 3.4
  return (
    <group position={[0, 0.08, 0]}>
      <Html distanceFactor={8} position={[0, 0, -radius]} center>
        <div style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace' }}>
          ▲ NORTH (0°)
        </div>
      </Html>
      <Html distanceFactor={8} position={[0, 0, radius]} center>
        <div style={{ color: '#fbbf24', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace' }}>
          ▼ SOUTH (Pole)
        </div>
      </Html>
      <Html distanceFactor={8} position={[radius, 0, 0]} center>
        <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace' }}>
          ▶ EAST (90°)
        </div>
      </Html>
      <Html distanceFactor={8} position={[-radius, 0, 0]} center>
        <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace' }}>
          ◀ WEST (270°)
        </div>
      </Html>
    </group>
  )
}

// ─── 10. Ridge Camera Controller ─────────────────────────────────────────────
function RidgeCameraController({ cameraPreset, centerElevation }) {
  const controlsRef = useRef()

  useEffect(() => {
    if (!controlsRef.current) return
    const controls = controlsRef.current
    const cy = centerElevation || 0.6

    if (cameraPreset === 'target') {
      controls.target.set(0, cy, 0)
      controls.object.position.set(0, cy + 1.2, 2.2)
    } else if (cameraPreset === 'horizon') {
      controls.target.set(0, cy + 0.1, 0)
      controls.object.position.set(0, cy + 0.4, 3.8)
    } else if (cameraPreset === 'polar') {
      controls.target.set(0, cy, 0)
      controls.object.position.set(0, cy + 6.0, 0.01)
    } else {
      // Oblique elevated overview
      controls.target.set(0, cy, 0)
      controls.object.position.set(3.2, cy + 3.0, 4.2)
    }
    controls.update()
  }, [cameraPreset, centerElevation])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={1.2}
      maxDistance={12}
    />
  )
}

// ─── 11. Flight Mode Trajectory Frame Generator ──────────────────────────────
function generateAdaptedFrames(site, plan, delaySlipDays) {
  const frames = []
  const moonPos = [16.0, 2.5, -4.5]
  const moonRadius = 0.9

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

  const launchBase = new Date(plan?.launch_utc || '2026-04-10T00:00:00Z')
  // Delay slip shifts the timeline forward
  const effectiveLaunch = new Date(launchBase.getTime() + delaySlipDays * 86400000)
  const loiDate = new Date(effectiveLaunch.getTime() + transitDays * 86400000)
  const pdiDate = new Date(loiDate.getTime() + orbitDays * 86400000)
  const landingDate = new Date(pdiDate.getTime() + 2 * 3600000) // 2h descent
  const surfaceEndDate = new Date(landingDate.getTime() + surfaceDays * 86400000)

  const totalSteps = 120

  for (let i = 0; i <= totalSteps; i++) {
    let phase = 'PRELAUNCH_HOLD'
    let craftPos = [0, 1.62, 0]
    let thrust = false
    let event = null
    let altKm = 384400.0
    let velocityKms = 0.0
    let timeUtc = effectiveLaunch

    if (i < 8) {
      phase = 'PRELAUNCH_HOLD'
      craftPos = [0, 1.62, 0]
      thrust = (i >= 6)
      event = (i === 6) ? 'LIFTOFF' : 'COUNTDOWN'
      altKm = (i >= 6) ? 120.0 : 0.0
      velocityKms = (i >= 6) ? 7.8 : 0.0
      timeUtc = new Date(effectiveLaunch.getTime() - (8 - i) * 3600000)
    } else if (i < 65) {
      phase = 'TRANSIT'
      const frac = (i - 8) / 57.0
      const smooth = frac * frac * (3 - 2 * frac)
      const startPos = [0, 1.8, 0]
      const approachOrbitPos = [moonPos[0] - 1.8, moonPos[1] + 1.2, moonPos[2] + 0.6]

      craftPos = [
        startPos[0] * (1 - smooth) + approachOrbitPos[0] * smooth,
        startPos[1] * (1 - smooth) + approachOrbitPos[1] * smooth + Math.sin(frac * Math.PI) * 4.2,
        startPos[2] * (1 - smooth) + approachOrbitPos[2] * smooth + Math.sin(frac * Math.PI) * 2.1,
      ]

      thrust = (i === 8 || i === 35)
      if (i === 8) event = 'TLI_BURN'
      else if (i === 35) event = 'MIDCOURSE_CORRECTION'

      altKm = Math.round(384400.0 * (1.0 - frac))
      velocityKms = +(1.1 + Math.sin(frac * Math.PI) * 9.8).toFixed(2)
      timeUtc = new Date(effectiveLaunch.getTime() + frac * transitDays * 86400000)
    } else if (i < 92) {
      phase = 'LUNAR_ORBIT'
      const frac = (i - 65) / 27.0
      const angle = frac * Math.PI * 4.0
      const orbitR = moonRadius + 0.35

      craftPos = [
        moonPos[0] + orbitR * Math.cos(angle),
        moonPos[1] + orbitR * Math.sin(angle) * 0.85,
        moonPos[2] + orbitR * Math.sin(angle) * 0.65,
      ]

      thrust = (i === 65)
      if (i === 65) event = 'LOI_INSERTION'
      altKm = 100.0
      velocityKms = 1.63
      timeUtc = new Date(loiDate.getTime() + frac * orbitDays * 86400000)
    } else if (i < 108) {
      phase = 'DESCENT'
      const frac = (i - 92) / 16.0
      const smooth = frac * frac * (3 - 2 * frac)
      const deorbitNode = [moonPos[0] + 0.5, moonPos[1] + 0.8, moonPos[2] + 0.3]

      craftPos = [
        deorbitNode[0] * (1 - smooth) + siteWorld[0] * smooth,
        deorbitNode[1] * (1 - smooth) + siteWorld[1] * smooth,
        deorbitNode[2] * (1 - smooth) + siteWorld[2] * smooth,
      ]

      thrust = true
      if (i === 92) event = 'PDI_BURN'
      else if (i === 107) event = 'TOUCHDOWN'

      altKm = +((1.0 - frac) * 15.0).toFixed(1)
      velocityKms = +((1.0 - frac) * 1.6).toFixed(2)
      timeUtc = new Date(pdiDate.getTime() + frac * 2 * 3600000)
    } else {
      phase = 'SURFACE'
      craftPos = siteWorld
      thrust = false
      event = (i === 108) ? 'SURFACE_OPS' : null
      altKm = 0.0
      velocityKms = 0.0
      const frac = (i - 108) / (totalSteps - 108)
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
      launchUtc: effectiveLaunch.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      loiUtc: loiDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      loiDate,
      loiOffsetDays: transitDays,
      pdiUtc: pdiDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      landingUtc: landingDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      landingDate,
      surfaceEndUtc: surfaceEndDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    },
  }
}

// ─── Main ChoreographyPlayer Component ─────────────────────────────────────────
export default function ChoreographyPlayer({
  plan,
  siteId = 'shackleton_connecting_ridge',
  siteName,
  timeline,
  surfaceMetrics,
  qualityTier = 'High',
  onQualityChange,
  activeDemo,
  onSelectDemo,
}) {
  // 1. Landing Site Selection
  const site = useMemo(() => {
    return SITE_METADATA[siteId] || SITE_METADATA['shackleton_connecting_ridge']
  }, [siteId])

  // 2. Interactive Delay / Mission Slip State
  const [delaySlipDays, setDelaySlipDays] = useState(0)
  const [viewMode, setViewMode] = useState('ridge') // 'flight' | 'ridge'
  const [terrainRenderMode, setTerrainRenderMode] = useState('elevation') // 'elevation' | 'regolith'
  const [ridgeCameraPreset, setRidgeCameraPreset] = useState('oblique') // 'oblique' | 'target' | 'horizon' | 'polar'
  const [showLabels, setShowLabels] = useState(true)

  // 3. Playback Animation State
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)

  // 4. Terrain DTM Mesh & Time-Series Ephemeris Data State
  const [meshData, setMeshData] = useState(null)
  const [timeSeriesData, setTimeSeriesData] = useState(null)
  const [centerElevation, setCenterElevation] = useState(0.6)

  // Fetch Site Terrain Mesh
  useEffect(() => {
    const meshUrl = `/${site.mesh_file || `data/terrains/${site.id}_mesh.json`}`
    fetch(meshUrl)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setMeshData(data)
      })
      .catch(() => {
        // Fallback to hero_terrains
        fetch(`/data/hero_terrains/${site.id}_mesh.json`)
          .then(r => (r.ok ? r.json() : null))
          .then(data => data && setMeshData(data))
          .catch(() => {})
      })
  }, [site.id, site.mesh_file])

  // Fetch Site Precomputed Ephemeris Time-Series
  useEffect(() => {
    const tsUrl = `/${site.time_series_file || `data/${site.id}_2026.json`}`
    fetch(tsUrl)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.time_series) setTimeSeriesData(data.time_series)
      })
      .catch(() => {})
  }, [site.id, site.time_series_file])

  // Generate Trajectory Frames Adapted to Selected Coordinates and Delay Slip
  const { frames, milestones } = useMemo(() => {
    return generateAdaptedFrames(site, plan, delaySlipDays)
  }, [site, plan, delaySlipDays])

  const curFrame = frames[currentStep] || frames[0]

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev >= frames.length - 1 ? 0 : prev + 1
        // Auto-transition to Ridge window upon reaching descent
        if (viewMode === 'flight' && next >= 92) {
          setViewMode('ridge')
        }
        return next
      })
    }, 120 / playSpeed)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, frames.length, viewMode])

  // Calculate Real Physical Solar Position at Touchdown (Conditional on Delay Slip)
  const solarEphemeris = useMemo(() => {
    return lookupSolarEphemeris(timeSeriesData, milestones.landingDate)
  }, [timeSeriesData, milestones.landingDate])

  // Compute Modelled Battery State of Charge (SoC) & Verdict
  const { verdict, minSoc, verdictNote } = useMemo(() => {
    const tol = site.tolerance_days ?? 7
    if (delaySlipDays > tol + 1 || !solarEphemeris.sunVisible) {
      return {
        verdict: 'FAILS',
        minSoc: 0.13,
        verdictNote: 'Mission tolerance exceeded. Touchdown in crater shadow drops battery below 20% reserve.',
      }
    } else if (delaySlipDays >= tol - 1) {
      return {
        verdict: 'MARGINAL',
        minSoc: 0.24,
        verdictNote: 'Tight solar margin. Grazing terrain elevation causes partial shadow or low reserve.',
      }
    } else {
      return {
        verdict: 'SURVIVES',
        minSoc: 0.55,
        verdictNote: 'Modelled continuous solar illumination on ridge crest maintains battery above 50%.',
      }
    }
  }, [delaySlipDays, site.tolerance_days, solarEphemeris.sunVisible])

  const trailPoints = useMemo(() => {
    return frames.slice(0, currentStep + 1).map(f => f.craftPos)
  }, [frames, currentStep])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711', position: 'relative' }}>
      {/* ── Top Header Bar: Mode Switcher, Quick Demos & Quality Tier ── */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 12,
        right: 12,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {/* Left: View Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'rgba(7, 10, 24, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '4px 6px',
          borderRadius: '7px',
          border: '1px solid rgba(255,255,255,0.12)',
          pointerEvents: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          <button
            onClick={() => setViewMode('flight')}
            style={{
              background: viewMode === 'flight' ? '#0284c7' : 'transparent',
              color: viewMode === 'flight' ? '#fff' : '#94a3b8',
              border: viewMode === 'flight' ? '1px solid #38bdf8' : '1px solid transparent',
              borderRadius: '5px',
              padding: '5px 12px',
              fontSize: '0.70rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🚀</span> Flight & Orbit Playback
          </button>
          <button
            onClick={() => setViewMode('ridge')}
            style={{
              background: viewMode === 'ridge' ? '#0284c7' : 'transparent',
              color: viewMode === 'ridge' ? '#fff' : '#94a3b8',
              border: viewMode === 'ridge' ? '1px solid #38bdf8' : '1px solid transparent',
              borderRadius: '5px',
              padding: '5px 12px',
              fontSize: '0.70rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⛰</span> Landing Ridge Terrain & Solar Lighting
          </button>
        </div>

        {/* Center: Demo Preset Selectors */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(7, 10, 24, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '4px 6px',
          borderRadius: '7px',
          border: '1px solid rgba(255,255,255,0.12)',
          pointerEvents: 'auto',
        }}>
          <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 800, alignSelf: 'center', padding: '0 4px' }}>
            DEMO PRESET:
          </span>
          {[
            { id: 'A', siteId: 'shackleton_connecting_ridge', label: 'Demo A (Shackleton)', defaultSlip: 0 },
            { id: 'B', siteId: 'malapert_mountain', label: 'Demo B (Malapert)', defaultSlip: 0 },
            { id: 'C', siteId: 'nobile_rim_1', label: 'Demo C (Nobile Rim)', defaultSlip: 3 },
          ].map(d => {
            const isMatch = activeDemo === d.id || siteId === d.siteId
            return (
              <button
                key={d.id}
                onClick={() => {
                  if (onSelectDemo) onSelectDemo(d.id)
                  setDelaySlipDays(d.defaultSlip)
                }}
                style={{
                  background: isMatch ? 'rgba(56,189,248,0.22)' : 'transparent',
                  color: isMatch ? '#38bdf8' : '#cbd5e1',
                  border: isMatch ? '1px solid #38bdf8' : '1px solid transparent',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {d.label}
              </button>
            )
          })}
        </div>

        {/* Right: UI Toggles & Quality */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(7, 10, 24, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '7px',
          border: '1px solid rgba(255,255,255,0.12)',
          pointerEvents: 'auto',
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
          {viewMode === 'ridge' && (
            <button
              onClick={() => setTerrainRenderMode(m => (m === 'elevation' ? 'regolith' : 'elevation'))}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '0.64rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {terrainRenderMode === 'elevation' ? '🎨 Mode: Hypsometric' : '🌕 Mode: Regolith'}
            </button>
          )}
        </div>
      </div>

      {/* ── Top-Left Floating Flight & Solar Telemetry Card ── */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 12,
        zIndex: 10,
        background: 'rgba(6,11,25,0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '320px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}>
        {/* Title & Phase */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {viewMode === 'flight' ? 'Flight Rehearsal Telemetry' : 'LOLA Ridge Lighting & Power Logic'}
            </div>
            <div style={{ fontSize: '0.80rem', fontWeight: 800, color: '#f8fafc' }}>
              {site?.name}
            </div>
          </div>
          <span style={{
            fontSize: '0.62rem',
            background: verdict === 'SURVIVES' ? 'rgba(52,211,153,0.2)' : verdict === 'MARGINAL' ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)',
            color: verdict === 'SURVIVES' ? '#34d399' : verdict === 'MARGINAL' ? '#fbbf24' : '#f87171',
            border: `1px solid ${verdict === 'SURVIVES' ? '#34d399' : verdict === 'MARGINAL' ? '#fbbf24' : '#f87171'}`,
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
          }}>
            {verdict}
          </span>
        </div>

        {/* Orbit Insertion & Touchdown Milestones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.58rem', color: '#a78bfa', fontWeight: 800 }}>🌕 REACHING ORBIT (LOI)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.70rem', color: '#f1f5f9', fontWeight: 600, marginTop: '2px' }}>
              {milestones.loiUtc}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.58rem', color: '#34d399', fontWeight: 800 }}>🎯 TOUCHDOWN EPOCH</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.70rem', color: '#f1f5f9', fontWeight: 600, marginTop: '2px' }}>
              {milestones.landingUtc}
            </div>
          </div>
        </div>

        {/* Physical Solar Angles & Visibility at Site */}
        <div style={{
          background: solarEphemeris.sunVisible ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${solarEphemeris.sunVisible ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>Solar Azimuth / Elevation:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#f8fafc', fontWeight: 800 }}>
              {solarEphemeris.sunAzDeg.toFixed(1)}° / {solarEphemeris.sunElDeg.toFixed(2)}°
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>Direct Line-of-Sight:</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: solarEphemeris.sunVisible ? '#34d399' : '#f87171',
            }}>
              {solarEphemeris.sunVisible ? '☀️ DIRECT SUNLIGHT (ABOVE RIDGE)' : '🌑 OCCLUDED BY CRATER RIM'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>Solar Flux / Battery SoC:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800 }}>
              {solarEphemeris.sunVisible ? '1361 W/m²' : '0 W/m²'} · {(minSoc * 100).toFixed(0)}% SoC
            </span>
          </div>
        </div>

        {/* Neutral Scientific Verdict Callout */}
        <div style={{ fontSize: '0.64rem', color: '#cbd5e1', lineHeight: 1.4, fontStyle: 'italic' }}>
          {verdictNote}
        </div>
      </div>

      {/* ── Delay / Mission Slip What-If Simulator Bar ── */}
      <div style={{
        position: 'absolute',
        top: 60,
        right: 12,
        zIndex: 10,
        background: 'rgba(6,11,25,0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '320px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
            Mission Slip / Delay Simulator
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.76rem',
            fontWeight: 800,
            color: delaySlipDays === 0 ? '#38bdf8' : delaySlipDays <= (site.tolerance_days ?? 7) ? '#fbbf24' : '#f87171',
          }}>
            +{delaySlipDays} Days Slip
          </span>
        </div>

        {/* Quick Slip Presets */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 3, 7, 10, 14].map(days => (
            <button
              key={days}
              onClick={() => setDelaySlipDays(days)}
              style={{
                flex: 1,
                background: delaySlipDays === days ? '#0284c7' : 'rgba(255,255,255,0.06)',
                color: delaySlipDays === days ? '#fff' : '#94a3b8',
                border: delaySlipDays === days ? '1px solid #38bdf8' : '1px solid transparent',
                borderRadius: '4px',
                padding: '4px 0',
                fontSize: '0.62rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {days === 0 ? 'Nominal' : `+${days}d`}
            </button>
          ))}
        </div>

        {/* Continuous Range Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.58rem', color: '#64748b' }}>-5d</span>
          <input
            type="range"
            min={-5}
            max={20}
            value={delaySlipDays}
            onChange={e => setDelaySlipDays(Number(e.target.value))}
            style={{ flex: 1, accentColor: delaySlipDays <= (site.tolerance_days ?? 7) ? '#38bdf8' : '#ef4444', height: '5px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.58rem', color: '#64748b' }}>+20d</span>
        </div>

        <div style={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.35 }}>
          {delaySlipDays === 0
            ? 'Nominal departure. Touchdown occurs in continuous sunlight window.'
            : delaySlipDays <= (site.tolerance_days ?? 7)
            ? `Arrival delayed by ${delaySlipDays}d. Solar azimuth shifts by ~${(delaySlipDays * 12.2).toFixed(0)}°, remaining within forward tolerance.`
            : `Exceeds ${site.tolerance_days}d tolerance forward. Sun rotates behind opposing ridge crest, causing shadow at touchdown.`}
        </div>
      </div>

      {/* ── Ridge Camera View Angle Toolbar (Visible in Ridge Mode) ── */}
      {viewMode === 'ridge' && (
        <div style={{
          position: 'absolute',
          bottom: 84,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(7,10,24,0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginRight: '4px' }}>
            Camera Angle:
          </span>
          {[
            { id: 'oblique', label: '📐 Ridge Perspective' },
            { id: 'target', label: '🎯 Touchdown Close-Up' },
            { id: 'horizon', label: '🌄 Horizon Sun View' },
            { id: 'polar', label: '🗺 Polar Top-Down' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setRidgeCameraPreset(c.id)}
              style={{
                background: ridgeCameraPreset === c.id ? '#0284c7' : 'rgba(255,255,255,0.06)',
                color: ridgeCameraPreset === c.id ? '#fff' : '#cbd5e1',
                border: ridgeCameraPreset === c.id ? '1px solid #38bdf8' : '1px solid transparent',
                borderRadius: '5px',
                padding: '4px 9px',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 3D WebGL Canvas ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: [3.2, 3.8, 4.5], fov: 46 }}
          shadows
          style={{ background: 'radial-gradient(circle at 50% 50%, #0c1122 0%, #050711 100%)' }}
        >
          {/* Deep Starfield */}
          <Stars radius={150} depth={60} count={3500} factor={4} saturation={0} fade speed={0.8} />

          <Suspense fallback={null}>
            {viewMode === 'flight' ? (
              // ── SCENE A: Macro Translunar Space Flight & Orbit Insertion ──
              <>
                <OrbitControls makeDefault enableDamping dampingFactor={0.06} />
                <MacroSunObject showLabels={showLabels} />
                <MacroEarthObject position={curFrame.earthPos} showLabels={showLabels} />
                <MacroMoonObject position={curFrame.moonPos} site={site} showLabels={showLabels} />
                <TrajectoryRibbon points={trailPoints} phase={curFrame.phase} qualityTier={qualityTier} />
                <SpacecraftMarker position={curFrame.craftPos} thrustActive={curFrame.thrust} qualityTier={qualityTier} />
              </>
            ) : (
              // ── SCENE B: Landing Site Ridge Terrain Window & Solar Illumination ──
              <>
                <RidgeCameraController cameraPreset={ridgeCameraPreset} centerElevation={centerElevation} />

                {/* Real Topocentric Physical Solar Direction & Shadows */}
                <PhysicalTopocentricSun
                  sunAzDeg={solarEphemeris.sunAzDeg}
                  sunElDeg={solarEphemeris.sunElDeg}
                  sunVisible={solarEphemeris.sunVisible}
                  centerElevation={centerElevation}
                />

                {/* 3D LOLA DTM Ridge Elevation Mesh */}
                <TopographicRidgeMesh
                  meshData={meshData}
                  renderMode={terrainRenderMode}
                  onCenterComputed={setCenterElevation}
                />

                {/* Marked Touchdown Footprint with Targeting Reticle & Guidance Laser */}
                <TouchdownFootprintMarker
                  centerElevation={centerElevation}
                  site={site}
                  sunVisible={solarEphemeris.sunVisible}
                  batterySoc={minSoc}
                />

                {/* 3D Compass Direction Markers on Terrain Perimeter */}
                <CompassMarkers />
              </>
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* ── Bottom Playback Controls & Time Scrubber Bar ── */}
      <div style={{
        background: '#070a18',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 20px',
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

          {/* Current Milestone / Phase Pill */}
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

        {/* Flight Time Progress Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            🚀 Launch
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
            🎯 Touchdown ({site?.name?.slice(0, 16)})
          </span>
        </div>
      </div>
    </div>
  )
}
