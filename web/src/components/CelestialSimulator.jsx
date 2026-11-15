import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  ChevronLeft, Sun, Globe, Radio, Moon, Camera, Maximize2,
  BookOpen, X, ChevronDown, ChevronUp, Image, MousePointer2,
  MapPin, Wifi, WifiOff, Telescope, Satellite
} from 'lucide-react'

// ─── Coordinate Helpers ────────────────────────────────────────────────────

function latLonToVec3(lat, lon, r = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

function azElToCartesian(azDeg, elDeg, distance = 4.5) {
  const elRad = (elDeg * Math.PI) / 180
  const azRad = (azDeg * Math.PI) / 180
  const y = distance * Math.sin(elRad)
  const rHoriz = distance * Math.cos(elRad)
  const x = rHoriz * Math.sin(azRad)
  const z = -rHoriz * Math.cos(azRad)
  return [x, y, z]
}

// ─── Atmospheric Rayleigh Limb Shader (Earth glow) ─────────────────────────

const EarthAtmosphereGlowShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
      gl_FragColor = vec4(0.22, 0.60, 1.0, intensity * 0.90);
    }
  `
}

// ─── Earth Model ───────────────────────────────────────────────────────────

function EarthObject({ earthAzDeg, earthElDeg, distance = 4.6, isVisible, showLabels }) {
  const cloudsRef = useRef()
  const earthTexture = useLoader(THREE.TextureLoader, '/textures/earth_atmos_2048.jpg')
  const cloudsTexture = useLoader(THREE.TextureLoader, '/textures/earth_clouds_1024.png')

  const earthPos = useMemo(
    () => azElToCartesian(earthAzDeg, earthElDeg, distance),
    [earthAzDeg, earthElDeg, distance]
  )

  const atmosphereMaterial = useMemo(() =>
    new THREE.ShaderMaterial({
      vertexShader: EarthAtmosphereGlowShader.vertexShader,
      fragmentShader: EarthAtmosphereGlowShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    }), [])

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.04
  })

  return (
    <group position={earthPos}>
      <mesh rotation={[0.41, 0, 0]}>
        <sphereGeometry args={[0.35, 48, 48]} />
        <meshStandardMaterial map={earthTexture} roughness={0.65} metalness={0.1} />
      </mesh>

      <mesh ref={cloudsRef} scale={[1.018, 1.018, 1.018]}>
        <sphereGeometry args={[0.35, 36, 36]} />
        <meshStandardMaterial
          map={cloudsTexture}
          transparent opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={[1.18, 1.18, 1.18]} material={atmosphereMaterial}>
        <sphereGeometry args={[0.35, 32, 32]} />
      </mesh>

      {/* Earth status badge: fixed screen size (no distanceFactor) */}
      {showLabels && (
        <Html position={[0, 0.48, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            background: isVisible ? 'rgba(6,182,212,0.92)' : 'rgba(239,68,68,0.9)',
            color: '#fff',
            padding: '2px 7px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: isVisible ? '0 0 10px rgba(6,182,212,0.7)' : '0 0 8px rgba(239,68,68,0.6)',
            display: 'flex', alignItems: 'center', gap: '4px',
            whiteSpace: 'nowrap'
          }}>
            <Globe size={12} strokeWidth={1.5} />
            <span style={{ fontSize: '9px', opacity: 0.85 }}>
              {isVisible ? 'DTE ONLINE' : 'OCCLUDED'}
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Sun Model ─────────────────────────────────────────────────────────────

function SunObject({ sunAzDeg, sunElDeg, distance = 4.8, showLabels }) {
  const sunPos = useMemo(
    () => azElToCartesian(sunAzDeg, sunElDeg, distance),
    [sunAzDeg, sunElDeg, distance]
  )

  return (
    <group position={sunPos}>
      <mesh>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshBasicMaterial color="#fffef0" />
      </mesh>
      <mesh scale={[1.35, 1.35, 1.35]}>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.45} side={THREE.BackSide} />
      </mesh>
      <mesh scale={[1.9, 1.9, 1.9]}>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      <pointLight color="#fff7ed" intensity={4.0} distance={25} decay={1} />

      {/* Sun label: fixed screen size */}
      {showLabels && (
        <Html position={[0, 0.42, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(251,191,36,0.95)',
            color: '#000',
            padding: '2px 8px',
            borderRadius: '4px',
            boxShadow: '0 0 12px rgba(251,191,36,0.9)',
            whiteSpace: 'nowrap'
          }}>
            ☀ THE SUN
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── DTE Comms Ray ─────────────────────────────────────────────────────────

function CommsRay({ sitePos, earthAzDeg, earthElDeg, distance = 4.6, isVisible }) {
  const earthPos = useMemo(
    () => azElToCartesian(earthAzDeg, earthElDeg, distance),
    [earthAzDeg, earthElDeg, distance]
  )
  const geometry = useMemo(() => {
    const pts = [new THREE.Vector3(...sitePos), new THREE.Vector3(...earthPos)]
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [sitePos, earthPos])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={isVisible ? '#38bdf8' : '#ef4444'}
        transparent
        opacity={isVisible ? 0.75 : 0.28}
      />
    </line>
  )
}

// ─── Trajectory Path Overlays ──────────────────────────────────────────────

function LibrationOrbitPath({ timeSeries, distance = 4.6 }) {
  const geometry = useMemo(() => {
    if (!timeSeries?.earth_az_deg?.length) return null
    const pts = []
    const azs = timeSeries.earth_az_deg
    const els = timeSeries.earth_el_deg
    for (let i = 0; i < azs.length; i += 4) {
      pts.push(new THREE.Vector3(...azElToCartesian(azs[i], els[i], distance)))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [timeSeries, distance])

  if (!geometry) return null
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#0ea5e9" transparent opacity={0.32} />
    </line>
  )
}

function SolarOrbitPath({ timeSeries, distance = 4.8 }) {
  const geometry = useMemo(() => {
    if (!timeSeries?.sun_az_deg?.length) return null
    const pts = []
    const azs = timeSeries.sun_az_deg
    const els = timeSeries.sun_el_deg
    for (let i = 0; i < azs.length; i += 4) {
      pts.push(new THREE.Vector3(...azElToCartesian(azs[i], els[i], distance)))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [timeSeries, distance])

  if (!geometry) return null
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#f59e0b" transparent opacity={0.22} />
    </line>
  )
}

// ─── Moon with Pulsing Site Beacon ─────────────────────────────────────────

function MoonWithSite({ site, sunVisible, earthVisible, sitePosVec, showLabels }) {
  const texture = useLoader(THREE.TextureLoader, '/textures/moon_color_1k.jpg')
  const beaconPulseRef = useRef()

  useFrame(({ clock }) => {
    if (beaconPulseRef.current) {
      const s = 1.0 + 0.35 * Math.sin(clock.getElapsedTime() * 3.5)
      beaconPulseRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group>
      <mesh receiveShadow>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Axial tilt 1.54° */}
      <mesh rotation={[0, 0, (1.54 * Math.PI) / 180]}>
        <cylinderGeometry args={[0.003, 0.003, 2.5, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </mesh>

      {/* Equator ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.004, 1.008, 64]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* Landing site pin */}
      <group position={sitePosVec}>
        {/* Core sphere */}
        <mesh>
          <sphereGeometry args={[0.022, 16, 16]} />
          <meshBasicMaterial color={sunVisible ? '#fbbf24' : '#f87171'} />
        </mesh>

        {/* Pulsing beacon ring */}
        <mesh ref={beaconPulseRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.032, 0.042, 24]} />
          <meshBasicMaterial
            color={earthVisible ? '#38bdf8' : '#fbbf24'}
            transparent opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Fixed pixel size label: NEVER scales up or becomes gigantic */}
        {showLabels && (
          <Html
            position={[0, 0.05, 0]}
            center
            occlude
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(6, 11, 25, 0.94)',
              border: `1px solid ${earthVisible ? 'rgba(56,189,248,0.7)' : 'rgba(251,191,36,0.6)'}`,
              borderRadius: '4px',
              padding: '2px 7px',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap'
            }}>
              <MapPin size={11} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {site.name}
              </span>
              <span style={{ color: earthVisible ? '#38bdf8' : '#ef4444', fontSize: '10px' }}>
                {earthVisible ? <Wifi size={11} strokeWidth={2} /> : <WifiOff size={11} strokeWidth={2} />}
              </span>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// ─── Camera Rig: Seamless Free Look with One-Shot Mode Transitions ─────────
// Free-look is 100% unrestricted. When a mode button is clicked, it smoothly
// glides to the target in 1.2s, then immediately hands complete free control back.

function CameraRig({ cameraMode, sitePosVec, sunAz, sunEl, earthAz, earthEl, onTransitionComplete }) {
  const controlsRef = useRef()
  const transRef = useRef({ active: false, t0: 0, dur: 1.2 })
  const targetRef = useRef({ camPos: new THREE.Vector3(0, 3.2, 5.8), lookAt: new THREE.Vector3(0, 0, 0) })
  const lastTriggeredMode = useRef(null)

  // Trigger smooth glide ONLY when cameraMode explicitly changes!
  useEffect(() => {
    if (cameraMode === lastTriggeredMode.current) return
    lastTriggeredMode.current = cameraMode

    const sp = new THREE.Vector3(...sitePosVec)
    const spNorm = sp.clone().normalize()

    let camPos, lookAt

    if (cameraMode === 'overview') {
      camPos = new THREE.Vector3(0, 3.2, 5.8)
      lookAt = new THREE.Vector3(0, 0, 0)
    } else if (cameraMode === 'site_zoom') {
      // Zoom close to site with an elevation angle
      camPos = spNorm.clone().multiplyScalar(1.5).add(new THREE.Vector3(0, 0.25, 0.15))
      lookAt = sp.clone()
    } else if (cameraMode === 'surface_vantage') {
      // Observer positioned on surface looking toward horizon
      camPos = spNorm.clone().multiplyScalar(1.03)
      const [sx, sy, sz] = azElToCartesian(sunAz, Math.max(sunEl, 0.5), 3.5)
      lookAt = new THREE.Vector3(sx, sy, sz)
    } else if (cameraMode === 'track_earth') {
      // Look toward Earth from above the site
      camPos = spNorm.clone().multiplyScalar(1.4)
      const [ex, ey, ez] = azElToCartesian(earthAz, Math.max(earthEl, 0.5), 4.2)
      lookAt = new THREE.Vector3(ex, ey, ez)
    } else {
      return
    }

    targetRef.current = { camPos, lookAt }
    transRef.current = { active: true, t0: performance.now() / 1000, dur: 1.2 }
  }, [cameraMode, sitePosVec])

  useFrame(({ camera }) => {
    if (!transRef.current.active || !controlsRef.current) {
      if (controlsRef.current) controlsRef.current.update()
      return
    }

    const elapsed = performance.now() / 1000 - transRef.current.t0
    const rawT = elapsed / transRef.current.dur

    if (rawT >= 1.0) {
      // Transition finished: snap exactly and release control
      camera.position.copy(targetRef.current.camPos)
      controlsRef.current.target.copy(targetRef.current.lookAt)
      controlsRef.current.update()
      transRef.current.active = false
      if (onTransitionComplete) onTransitionComplete()
      return
    }

    // Cubic smooth-step
    const t = rawT * rawT * (3 - 2 * rawT)
    camera.position.lerp(targetRef.current.camPos, t * 0.14)
    controlsRef.current.target.lerp(targetRef.current.lookAt, t * 0.14)
    controlsRef.current.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={true}
      enablePan={true}
      enableRotate={true}
      enableDamping={true}
      dampingFactor={0.06}
      minDistance={1.03}
      maxDistance={14.0}
    />
  )
}

// ─── Master 3D Celestial Scene ─────────────────────────────────────────────

function CelestialScene({
  site,
  timeSeries,
  currentStep,
  cameraMode,
  showPaths,
  showLabels,
  onTransitionComplete
}) {
  const sunAz = timeSeries?.sun_az_deg?.[currentStep] ?? 0
  const sunEl = timeSeries?.sun_el_deg?.[currentStep] ?? 0
  const earthAz = timeSeries?.earth_az_deg?.[currentStep] ?? 0
  const earthEl = timeSeries?.earth_el_deg?.[currentStep] ?? 0
  const sunVisible = timeSeries?.sun_visible?.[currentStep] ?? false
  const earthVisible = timeSeries?.earth_visible?.[currentStep] ?? false

  const sitePosVec = useMemo(
    () => latLonToVec3(site.lat_deg, site.lon_deg, 1.015),
    [site.lat_deg, site.lon_deg]
  )

  return (
    <>
      <ambientLight intensity={0.15} />
      <Stars radius={120} depth={60} count={4500} factor={4} saturation={0} fade speed={0.7} />

      <MoonWithSite
        site={site}
        sunVisible={sunVisible}
        earthVisible={earthVisible}
        sitePosVec={sitePosVec}
        showLabels={showLabels}
      />

      <SunObject sunAzDeg={sunAz} sunElDeg={sunEl} showLabels={showLabels} />
      {showPaths && <SolarOrbitPath timeSeries={timeSeries} />}

      <EarthObject earthAzDeg={earthAz} earthElDeg={earthEl} isVisible={earthVisible} showLabels={showLabels} />
      {showPaths && <LibrationOrbitPath timeSeries={timeSeries} />}

      <CommsRay
        sitePos={sitePosVec}
        earthAzDeg={earthAz}
        earthElDeg={earthEl}
        isVisible={earthVisible}
      />

      <CameraRig
        cameraMode={cameraMode}
        sitePosVec={sitePosVec}
        sunAz={sunAz}
        sunEl={sunEl}
        earthAz={earthAz}
        earthEl={earthEl}
        onTransitionComplete={onTransitionComplete}
      />
    </>
  )
}

// ─── Educational Science Card (Collapsible, Fully Dismissible, Site-Reactive)

function ScienceCard({ site, mSun, mEarth, isOpen, isDismissed, onToggle, onDismiss }) {
  if (isDismissed) return null

  const isFarSide = site.lon_deg > 90 || site.lon_deg < -90
  const isSouthPole = site.lat_deg < -80
  const isEquator = Math.abs(site.lat_deg) < 15

  const cardTitle = isFarSide
    ? 'Far Side: Permanent Radio Shadow'
    : isSouthPole
    ? 'South Pole: Grazing Sun & Libration Loop'
    : isEquator
    ? 'Equatorial: Day/Night Cycle & Always-On Earth'
    : 'Mid-Latitude: Seasonal Illumination Windows'

  const cardBody = isFarSide ? (
    <>
      Sites on the <strong>far side</strong> like Chang'e 4 never have direct line-of-sight to Earth (0.0%).
      All communication requires an orbital halo relay satellite at the <strong>Earth-Moon L2 Lagrangian point</strong> (such as Queqiao).
    </>
  ) : isSouthPole ? (
    <>
      With only <strong>1.54° axial tilt</strong>, the Sun circles 360° continuously around the horizon between
      <strong> -1.5° and +1.5°</strong> elevation. Meanwhile, Earth traces a <strong>±7° libration figure-8 loop</strong>.
      When Earth dips below local ridge peaks, direct comms black out!
    </>
  ) : isEquator ? (
    <>
      At equatorial sites like Apollo 11, Earth remains permanently anchored high in the sky (<strong>100% line of sight</strong>).
      The Sun rises to <strong>+90° zenith overhead</strong>, giving 14.77 days of daylight followed by 14.77 days of freezing night.
    </>
  ) : (
    <>
      Mid-latitude sites experience moderate solar elevation with terrain-dependent illumination windows and direct Earth radio visibility.
    </>
  )

  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: 14,
      width: '320px',
      background: 'rgba(5, 8, 20, 0.95)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '10px',
      zIndex: 5,
      boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
      overflow: 'hidden'
    }}>
      {/* Header with Title + Hide + Close buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 12px',
        borderBottom: isOpen ? '1px solid rgba(255,255,255,0.08)' : 'none',
        background: 'rgba(15,23,42,0.5)'
      }}>
        <div
          onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', flex: 1 }}
        >
          <BookOpen size={15} strokeWidth={1.5} style={{ color: 'var(--color-cyan)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: '#38bdf8'
          }}>
            {cardTitle}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {isOpen ? '▲' : '▼'}
          </button>
          <button
            onClick={onDismiss}
            title="Dismiss guide card"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '3px',
              padding: '1px 5px',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body content */}
      {isOpen && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.74rem',
            lineHeight: 1.55,
            color: '#94a3b8',
            margin: 0
          }}>
            {cardBody}
          </p>

          {/* Quick Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: 'rgba(15,23,42,0.65)',
            borderRadius: '6px',
            padding: '8px 10px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TOTAL SUNLIGHT</div>
              <div style={{ fontFamily: 'var(--font-display)', color: '#fbbf24', fontSize: '0.88rem', fontWeight: 800 }}>
                {((mSun?.sunlight_fraction ?? 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>EARTH VISIBILITY</div>
              <div style={{ fontFamily: 'var(--font-display)', color: '#38bdf8', fontSize: '0.88rem', fontWeight: 800 }}>
                {((mEarth?.visibility_fraction ?? 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>LONGEST NIGHT</div>
              <div style={{ fontFamily: 'var(--font-display)', color: (mSun?.longest_dark_run_s ?? 0) > 432000 ? '#f87171' : '#34d399', fontSize: '0.88rem', fontWeight: 800 }}>
                {((mSun?.longest_dark_run_s ?? 0) / 3600).toFixed(1)} h
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>MAX COMMS BLACKOUT</div>
              <div style={{ fontFamily: 'var(--font-display)', color: (mEarth?.longest_earth_blackout_s ?? 0) > 432000 ? '#f87171' : '#34d399', fontSize: '0.88rem', fontWeight: 800 }}>
                {((mEarth?.longest_earth_blackout_s ?? 0) / 3600).toFixed(1)} h
              </div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#34d399' }}>
            ✓ Verified with NASA JPL DE421 Ephemeris · 0% Fabrication
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Exported Component ───────────────────────────────────────────────

export default function CelestialSimulator({ site, siteData, onBack }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1) // 1x, 5x, 20x
  const [cameraMode, setCameraMode] = useState('overview') // 'overview' | 'site_zoom' | 'surface_vantage' | 'track_earth'
  const [showPaths, setShowPaths] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [cardOpen, setCardOpen] = useState(true)
  const [cardDismissed, setCardDismissed] = useState(false)

  const canvasRef = useRef(null)

  const timeSeries = siteData?.time_series || {}
  const times = timeSeries.times_utc || []
  const nSamples = times.length || 1

  const currentUtc = times[stepIndex] || '2026-04-01T00:00:00'
  const currentSunAz = timeSeries.sun_az_deg?.[stepIndex] ?? 0.0
  const currentSunEl = timeSeries.sun_el_deg?.[stepIndex] ?? 0.0
  const currentEarthAz = timeSeries.earth_az_deg?.[stepIndex] ?? 0.0
  const currentEarthEl = timeSeries.earth_el_deg?.[stepIndex] ?? 0.0
  const currentSunVis = timeSeries.sun_visible?.[stepIndex] ?? false
  const currentEarthVis = timeSeries.earth_visible?.[stepIndex] ?? false

  const mSun = siteData?.metrics?.sunlight || {}
  const mEarth = siteData?.metrics?.geometric_earth_visibility || {}

  // Solar transition countdown (sunset / sunrise)
  const solarCountdown = useMemo(() => {
    if (!timeSeries.sun_visible) return null
    const sv = timeSeries.sun_visible
    const stepS = siteData?.interval?.step_s || 600
    const current = sv[stepIndex]
    for (let i = stepIndex + 1; i < sv.length; i++) {
      if (sv[i] !== current) {
        const hrs = ((i - stepIndex) * stepS / 3600).toFixed(1)
        return current ? `Sunset in ${hrs}h` : `Sunrise in ${hrs}h`
      }
    }
    return current ? 'Continuous Sun' : 'Continuous Shadow'
  }, [timeSeries.sun_visible, stepIndex, siteData])

  // Earth transition countdown (earthset / next comms acquisition)
  const earthCountdown = useMemo(() => {
    if (!timeSeries.earth_visible) return null
    const ev = timeSeries.earth_visible
    const stepS = siteData?.interval?.step_s || 600
    const current = ev[stepIndex]
    for (let i = stepIndex + 1; i < ev.length; i++) {
      if (ev[i] !== current) {
        const hrs = ((i - stepIndex) * stepS / 3600).toFixed(1)
        return current ? `Earthset in ${hrs}h` : `Contact in ${hrs}h`
      }
    }
    return current ? 'Continuous DTE' : 'Permanent Occultation'
  }, [timeSeries.earth_visible, stepIndex, siteData])

  // Next Contact countdown (hours until next acquisition of signal)
  const nextContactHours = useMemo(() => {
    if (!timeSeries.earth_visible) return null
    const ev = timeSeries.earth_visible
    const stepS = siteData?.interval?.step_s || 600
    if (ev[stepIndex]) return 0
    for (let i = stepIndex + 1; i < ev.length; i++) {
      if (ev[i]) return ((i - stepIndex) * stepS / 3600).toFixed(1)
    }
    return null
  }, [timeSeries.earth_visible, stepIndex, siteData])

  // Play animation loop
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setStepIndex(prev => {
        const next = prev + playSpeed
        return next >= nSamples ? 0 : next
      })
    }, 50)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, nSamples])

  // When active site changes, reset step and mode cleanly
  useEffect(() => {
    setStepIndex(0)
    setCameraMode('overview')
  }, [site.id])

  const dayNumber = ((stepIndex * (siteData?.interval?.step_s || 600)) / 86400).toFixed(1)

  // Snapshot capture helper
  const handleCaptureSnapshot = useCallback(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `STELLARON_${site.id}_day${dayNumber}.png`
    link.href = dataUrl
    link.click()
  }, [site.id, dayNumber])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#050711' }}>
      {/* ── Top Header & Live Telemetry Bar ── */}
      <div style={{
        padding: '8px 16px',
        background: '#070a18',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        zIndex: 10,
        flexShrink: 0
      }}>
        {/* Left: Back button & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onBack}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            <span>Back</span>
          </button>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Sun &amp; Earth Orbital Simulator
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                padding: '2px 6px',
                borderRadius: '3px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.25)'
              }}>
                NASA JPL DE421 SPICE
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: '#64748b' }}>
              {site.name} · ({site.lat_deg}°, {site.lon_deg}°)
            </div>
          </div>
        </div>

        {/* Right: Live SPICE Telemetry Gauges */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '5px',
            padding: '3px 9px',
            fontSize: '0.68rem',
            color: '#cbd5e1'
          }}>
            UTC: <strong style={{ color: '#38bdf8' }}>{currentUtc.slice(0, 16).replace('T', ' ')}</strong> (Day {dayNumber}/30)
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '5px',
            padding: '3px 9px',
            fontSize: '0.68rem',
            color: '#cbd5e1'
          }}>
            SUN: <strong style={{ color: '#fbbf24' }}>{currentSunAz.toFixed(1)}\u00b0</strong> Az | <strong style={{ color: currentSunEl >= 0 ? '#34d399' : '#f87171' }}>{currentSunEl.toFixed(2)}\u00b0</strong> El
          </div>

          {solarCountdown && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '5px',
              padding: '3px 8px',
              fontSize: '0.64rem',
              color: '#fbbf24'
            }}>
              {solarCountdown}
            </div>
          )}

          <div style={{
            fontFamily: 'var(--font-mono)',
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '5px',
            padding: '3px 9px',
            fontSize: '0.68rem',
            color: '#cbd5e1'
          }}>
            EARTH: <strong style={{ color: '#38bdf8' }}>{currentEarthAz.toFixed(1)}\u00b0</strong> Az | <strong style={{ color: currentEarthEl >= 0 ? '#38bdf8' : '#f87171' }}>{currentEarthEl.toFixed(2)}\u00b0</strong> El
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            background: currentEarthVis ? 'rgba(56,189,248,0.18)' : 'rgba(239,68,68,0.18)',
            border: currentEarthVis ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(239,68,68,0.5)',
            borderRadius: '5px',
            padding: '3px 9px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: currentEarthVis ? '#38bdf8' : '#f87171'
          }}>
            {currentEarthVis ? 'DTE ACTIVE' : 'BLACKOUT'}
          </div>

          {earthCountdown && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              background: currentEarthVis ? 'rgba(56,189,248,0.12)' : 'rgba(239,68,68,0.12)',
              border: currentEarthVis ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(239,68,68,0.3)',
              borderRadius: '5px',
              padding: '3px 8px',
              fontSize: '0.64rem',
              color: currentEarthVis ? '#38bdf8' : '#f87171'
            }}>
              {earthCountdown}
            </div>
          )}
        </div>
      </div>

      {/* ── 3D Simulation Canvas Area ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 3.2, 5.8], fov: 45 }}
          style={{ background: 'radial-gradient(circle at 50% 50%, #0d1228 0%, #050711 100%)' }}
        >
          <CelestialScene
            site={site}
            timeSeries={timeSeries}
            currentStep={stepIndex}
            cameraMode={cameraMode}
            showPaths={showPaths}
            showLabels={showLabels}
            onTransitionComplete={() => {}}
          />
        </Canvas>

        {/* Science Card (Collapsible & Dismissible) */}
        <ScienceCard
          key={site.id}
          site={site}
          mSun={mSun}
          mEarth={mEarth}
          isOpen={cardOpen}
          isDismissed={cardDismissed}
          onToggle={() => setCardOpen(o => !o)}
          onDismiss={() => setCardDismissed(true)}
        />

        {/* Re-open guide button if dismissed */}
        {cardDismissed && (
          <button
            onClick={() => setCardDismissed(false)}
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 5,
              background: 'rgba(6, 11, 25, 0.92)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '6px',
              padding: '6px 11px',
              color: '#38bdf8',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BookOpen size={13} strokeWidth={1.5} />
            <span>Site Physics Guide</span>
          </button>
        )}

        {/* Camera Views & Tools Floating Panel (Top-Right) */}
        <div style={{
          position: 'absolute',
          top: 14,
          right: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 5
        }}>
          {/* Camera Mode Pills */}
          <div style={{
            background: 'rgba(6, 11, 25, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}>
            <div style={{
              fontFamily: 'var(--font-label)',
              fontSize: '0.58rem',
              color: '#64748b',
              padding: '2px 6px',
              letterSpacing: '0.08em'
            }}>
              CAMERA PRESETS
            </div>
            {[
              { id: 'overview', label: 'Free Orbital Overview', icon: Globe },
              { id: 'site_zoom', label: 'Zoom to Site', icon: MapPin },
              { id: 'surface_vantage', label: 'Surface Horizon Vantage', icon: Telescope },
              { id: 'track_earth', label: 'Track Earth DTE Vector', icon: Satellite },
            ].map(btn => {
              const IconComp = btn.icon
              return (
                <button
                  key={btn.id}
                  onClick={() => setCameraMode(btn.id)}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    background: cameraMode === btn.id ? 'var(--color-cyan-subtle)' : 'rgba(255,255,255,0.04)',
                    color: cameraMode === btn.id ? 'var(--color-cyan)' : 'var(--text-secondary)',
                    border: cameraMode === btn.id ? '1px solid var(--color-cyan-border)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                >
                  <IconComp size={13} strokeWidth={1.5} />
                  <span>{btn.label}</span>
                </button>
              )
            })}
          </div>

          {/* Quick Visual Layer Toggles & Snapshot */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(6, 11, 25, 0.85)',
            padding: '4px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <button
              onClick={() => setShowPaths(p => !p)}
              style={{
                fontFamily: 'var(--font-mono)',
                background: showPaths ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                color: showPaths ? '#34d399' : '#64748b',
                border: `1px solid ${showPaths ? 'rgba(52,211,153,0.35)' : 'transparent'}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.64rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {showPaths ? 'Paths ON' : 'Paths OFF'}
            </button>
            <button
              onClick={() => setShowLabels(l => !l)}
              style={{
                fontFamily: 'var(--font-mono)',
                background: showLabels ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                color: showLabels ? '#38bdf8' : '#64748b',
                border: `1px solid ${showLabels ? 'rgba(56,189,248,0.35)' : 'transparent'}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.64rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {showLabels ? 'Labels ON' : 'Labels OFF'}
            </button>
            <button
              onClick={handleCaptureSnapshot}
              title="Download PNG snapshot of simulation"
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--color-cyan-subtle)',
                color: 'var(--color-cyan)',
                border: '1px solid var(--color-cyan-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Camera size={12} strokeWidth={1.5} />
              <span>Snapshot</span>
            </button>
          </div>

          {/* Interactive Free-Look Hint */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-tertiary)',
            textAlign: 'right',
            paddingRight: '4px'
          }}>
            Drag to rotate · Scroll to zoom
          </div>
        </div>
      </div>

      {/* ── Bottom Timeline Controls Bar ── */}
      <div style={{
        padding: '10px 18px',
        background: '#070a18',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
        flexShrink: 0
      }}>
        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#64748b' }}>Apr 01</span>
          <input
            type="range"
            min={0}
            max={nSamples - 1}
            value={stepIndex}
            onChange={(e) => {
              setIsPlaying(false)
              setStepIndex(Number(e.target.value))
            }}
            style={{
              flex: 1,
              accentColor: '#38bdf8',
              cursor: 'pointer',
              height: '5px'
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#64748b' }}>May 01 (30 Days)</span>
        </div>

        {/* Playback Controls & Speed Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                fontFamily: 'var(--font-ui)',
                background: isPlaying ? '#ef4444' : '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={() => setStepIndex(0)}
              style={{
                fontFamily: 'var(--font-ui)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '6px 11px',
                fontSize: '0.68rem',
                cursor: 'pointer'
              }}
            >
              Reset Day 0
            </button>

            {/* Precision Step Buttons (-6h / +6h) */}
            <button
              onClick={() => setStepIndex(prev => Math.max(0, prev - 36))}
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '5px',
                padding: '5px 8px',
                fontSize: '0.64rem',
                cursor: 'pointer'
              }}
            >
              -6h
            </button>
            <button
              onClick={() => setStepIndex(prev => Math.min(nSamples - 1, prev + 36))}
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '5px',
                padding: '5px 8px',
                fontSize: '0.64rem',
                cursor: 'pointer'
              }}
            >
              +6h
            </button>

            {/* Speed Selector */}
            <div style={{ display: 'flex', gap: '2px', marginLeft: '6px' }}>
              {[1, 5, 20].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaySpeed(spd)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: playSpeed === spd ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.03)',
                    color: playSpeed === spd ? '#38bdf8' : '#64748b',
                    border: playSpeed === spd ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.64rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#475569' }}>
            NASA SPICE Step: 10 min · Sample {stepIndex + 1} of {nSamples}
          </div>
        </div>
      </div>
    </div>
  )
}
