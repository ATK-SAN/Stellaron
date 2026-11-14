/** ChoreographyPlayer.jsx — Interactive 3D Mission Trajectory & Rehearsal Playback
 *
 * Renders the full mission timeline from launch to lunar surface landing:
 * - Earth, Moon, and Spacecraft with animated rocket plume and trail ribbon
 * - Comms pulse beam between lunar surface and Earth
 * - Phase indicators and time scrubber
 * - Non-surface phases marked: "Illustrative path, not a trajectory design."
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { createPlumeMaterial, createTrailRibbonMaterial, createCommsPulseMaterial } from '../../shaders'

const PHASE_COLORS = {
  PRELAUNCH_HOLD: '#64748b',
  TRANSIT: '#38bdf8',
  LUNAR_ORBIT: '#a78bfa',
  DESCENT: '#fbbf24',
  SURFACE: '#34d399',
}

// ── 3D Scene Spacecraft & Bodies ──────────────────────────────────────────────
function SpacecraftMarker({ position, thrustActive, qualityTier }) {
  const plumeMat = useMemo(() => createPlumeMaterial(qualityTier), [qualityTier])
  const plumeRef = useRef()

  useFrame((state, delta) => {
    if (plumeMat.uniforms?.uTime) {
      plumeMat.uniforms.uTime.value += delta
      plumeMat.uniforms.uThrottle.value = thrustActive ? 1.0 : 0.0
    }
  })

  return (
    <group position={position}>
      {/* Spacecraft Body */}
      <mesh>
        <boxGeometry args={[0.3, 0.3, 0.45]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Solar Panel Wings */}
      <mesh position={[0.4, 0, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.3]} />
        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.4, 0, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.3]} />
        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Thruster Plume */}
      {thrustActive && (
        <mesh ref={plumeRef} position={[0, 0, 0.45]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.15, 0.6, 16, 1, true]} />
          <primitive object={plumeMat} attach="material" />
        </mesh>
      )}
    </group>
  )
}

function EarthGlobe() {
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[1.58, 32, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function MoonGlobe({ position }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial color="#64748b" roughness={0.9} metalness={0.0} />
      </mesh>
    </group>
  )
}

function TrajectoryRibbon({ points, phase, qualityTier }) {
  const colorHex = PHASE_COLORS[phase] || '#38bdf8'
  const ribbonMat = useMemo(() => createTrailRibbonMaterial(colorHex, qualityTier), [colorHex, qualityTier])

  useFrame((state, delta) => {
    if (ribbonMat.uniforms?.uTime) {
      ribbonMat.uniforms.uTime.value += delta
    }
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
      <lineBasicMaterial color={colorHex} transparent opacity={0.6} linewidth={2} />
    </line>
  )
}

function CommsPulseBeam({ startPos, endPos, active, qualityTier }) {
  const commsMat = useMemo(() => createCommsPulseMaterial(qualityTier), [qualityTier])

  useFrame((state, delta) => {
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

// ── Synthetic Trajectory Generator for Playback ──────────────────────────────
function buildSyntheticFrames() {
  const frames = []
  const moonPos = [15.0, 3.0, -4.0]
  const totalSteps = 120

  for (let i = 0; i <= totalSteps; i++) {
    const frac = i / totalSteps
    let phase = 'PRELAUNCH_HOLD'
    let craftPos = [0, 1.5, 0]
    let thrust = false
    let event = null

    if (i < 5) {
      phase = 'PRELAUNCH_HOLD'
      craftPos = [0, 1.5, 0]
      thrust = (i === 4)
      event = (i === 4) ? 'LIFTOFF' : null
    } else if (i < 65) {
      phase = 'TRANSIT'
      const tFrac = (i - 5) / 60.0
      const smooth = tFrac * tFrac * (3 - 2 * tFrac)
      craftPos = [
        moonPos[0] * smooth,
        1.5 * (1 - smooth) + moonPos[1] * smooth + Math.sin(tFrac * Math.PI) * 2.5,
        moonPos[2] * smooth + Math.sin(tFrac * Math.PI) * 1.5,
      ]
      thrust = (i === 5 || i === 35)
      event = (i === 5) ? 'TLI_BURN' : null
    } else if (i < 90) {
      phase = 'LUNAR_ORBIT'
      const oFrac = (i - 65) / 25.0
      const angle = oFrac * Math.PI * 4.0
      craftPos = [
        moonPos[0] + 1.2 * Math.cos(angle),
        moonPos[1] + 0.4 * Math.sin(angle),
        moonPos[2] + 1.2 * Math.sin(angle),
      ]
      thrust = (i === 65)
      event = (i === 65) ? 'LOI_INSERTION' : null
    } else if (i < 105) {
      phase = 'DESCENT'
      const dFrac = (i - 90) / 15.0
      const alt = (1.0 - dFrac) * 0.7
      craftPos = [
        moonPos[0] + (alt + 0.7) * 0.2,
        moonPos[1] - (0.7 + alt),
        moonPos[2],
      ]
      thrust = true
      event = (i === 90) ? 'PDI_BURN' : (i === 104 ? 'TOUCHDOWN' : null)
    } else {
      phase = 'SURFACE'
      craftPos = [
        moonPos[0] + 0.14,
        moonPos[1] - 0.7,
        moonPos[2],
      ]
      thrust = false
      event = (i === 105) ? 'SURFACE_OPS' : null
    }

    frames.push({
      step: i,
      phase,
      schematic: phase !== 'SURFACE',
      craftPos,
      thrust,
      event,
      earthPos: [0, 0, 0],
      moonPos,
    })
  }

  return frames
}

export default function ChoreographyPlayer({ qualityTier = 'High', onQualityChange }) {
  const frames = useMemo(() => buildSyntheticFrames(), [])
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev >= frames.length - 1 ? 0 : prev + 1))
    }, 100 / playSpeed)
    return () => clearInterval(interval)
  }, [isPlaying, playSpeed, frames.length])

  const curFrame = frames[currentStep] || frames[0]
  const trailPoints = useMemo(() => {
    return frames.slice(0, currentStep + 1).map(f => f.craftPos)
  }, [frames, currentStep])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#050711', position: 'relative' }}>
      {/* Non-negotiable schematic banner */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 16,
        zIndex: 10,
        background: 'rgba(7,10,24,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: '6px',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>⚠</span>
        <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontStyle: 'italic', fontWeight: 600 }}>
          Schematic phases: Illustrative path, not a trajectory design.
        </div>
      </div>

      {/* Quality Tier Selector */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 10,
        background: 'rgba(7,10,24,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tier:</span>
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
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [10, 12, 16], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[30, 20, 20]} intensity={1.5} color="#fffbeb" />
          <Stars radius={100} depth={50} count={2500} factor={4} saturation={0} fade speed={1} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

          {/* Earth */}
          <EarthGlobe />

          {/* Moon */}
          <MoonGlobe position={curFrame.moonPos} />

          {/* Trajectory Ribbon */}
          <TrajectoryRibbon points={trailPoints} phase={curFrame.phase} qualityTier={qualityTier} />

          {/* Spacecraft Marker with Plume */}
          <SpacecraftMarker position={curFrame.craftPos} thrustActive={curFrame.thrust} qualityTier={qualityTier} />

          {/* Comms Pulse Line */}
          {curFrame.phase === 'SURFACE' && (
            <CommsPulseBeam startPos={curFrame.craftPos} endPos={[0, 0, 0]} active={true} qualityTier={qualityTier} />
          )}
        </Canvas>
      </div>

      {/* Playback Controls & Timeline Scrubber Bar */}
      <div style={{
        background: '#070a18',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Play/Pause & Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? 'rgba(248,113,113,0.15)' : 'rgba(56,189,248,0.2)',
                border: `1px solid ${isPlaying ? 'rgba(248,113,113,0.4)' : 'rgba(56,189,248,0.4)'}`,
                color: isPlaying ? '#f87171' : '#38bdf8',
                borderRadius: '6px',
                padding: '5px 14px',
                fontSize: '0.74rem',
                fontWeight: 700,
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
                  padding: '4px 8px',
                  fontSize: '0.64rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Current Phase Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: `${PHASE_COLORS[curFrame.phase]}20`,
              color: PHASE_COLORS[curFrame.phase],
              border: `1px solid ${PHASE_COLORS[curFrame.phase]}50`,
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '0.68rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
            }}>
              {curFrame.phase}
            </span>
            {curFrame.event && (
              <span style={{
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.4)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
              }}>
                ✦ {curFrame.event}
              </span>
            )}
          </div>
        </div>

        {/* Time Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Launch</span>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentStep}
            onChange={e => setCurrentStep(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#38bdf8', height: '5px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Surface</span>
        </div>
      </div>
    </div>
  )
}
