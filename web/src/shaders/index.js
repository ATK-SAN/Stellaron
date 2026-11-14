/** Shaders Module for STELLARON Mission Rehearsal (Section 7)
 * Quality Tiers: Low (standard Three.js materials), Medium, High (Full GLSL shaders)
 */

import * as THREE from 'three'

// 1. Rocket Exhaust Plume Shader
export const plumeVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const plumeFragmentShader = `
  precision mediump float;
  uniform float uTime;
  uniform float uThrottle;
  uniform vec3 uColorCore;
  uniform vec3 uColorFlame;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    if (uThrottle <= 0.01) { discard; }
    vec2 uv = vUv;
    float distFromAxis = abs(uv.x - 0.5) * 2.0;
    float lengthProgress = uv.y;
    float expansion = 0.2 + 0.8 * lengthProgress;
    if (distFromAxis > expansion) { discard; }

    float shockDiamonds = sin(lengthProgress * 35.0 - uTime * 25.0);
    shockDiamonds = smoothstep(0.4, 0.95, shockDiamonds) * (1.0 - lengthProgress);

    vec2 flowUv = vec2(uv.x * 4.0, uv.y * 8.0 - uTime * 15.0);
    float turb = noise(flowUv) * 0.35;

    float core = (1.0 - distFromAxis / expansion) * (1.0 - lengthProgress * 0.7);
    core = clamp(core + shockDiamonds * 0.4 + turb, 0.0, 1.0);

    vec3 color = mix(uColorFlame, uColorCore, pow(core, 1.8));
    float alpha = pow(core, 1.2) * uThrottle * (1.0 - lengthProgress * 0.85);

    gl_FragColor = vec4(color * 1.5, alpha);
  }
`

// 2. Trajectory Ribbon Shader
export const trailRibbonVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const trailRibbonFragmentShader = `
  precision mediump float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFadeLength;
  varying vec2 vUv;

  void main() {
    float crossTrack = abs(vUv.x * 2.0 - 1.0);
    float alongTrack = vUv.y;
    float edgeGlow = pow(1.0 - smoothstep(0.0, 1.0, crossTrack), 2.5);
    float tailFade = smoothstep(0.0, uFadeLength, alongTrack);
    float shimmer = 0.95 + 0.05 * sin(alongTrack * 40.0 - uTime * 6.0);

    vec3 finalColor = uColor * (1.0 + edgeGlow * 0.8) * shimmer;
    float finalAlpha = edgeGlow * tailFade * 0.85;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`

// 3. Comms Pulse Shader
export const commsPulseVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const commsPulseFragmentShader = `
  precision mediump float;
  uniform float uTime;
  uniform bool uCommsActive;
  uniform vec3 uPulseColor;
  uniform float uPulseSpeed;
  varying vec2 vUv;

  void main() {
    if (!uCommsActive) {
      float dotted = step(0.5, fract(vUv.y * 30.0));
      gl_FragColor = vec4(1.0, 0.25, 0.25, dotted * 0.35);
      return;
    }
    float crossBeam = abs(vUv.x * 2.0 - 1.0);
    float beamCore = pow(1.0 - smoothstep(0.0, 1.0, crossBeam), 3.0);
    float wavePhase = vUv.y * 50.0 - uTime * uPulseSpeed;
    float pulse = smoothstep(0.2, 0.98, sin(wavePhase));
    float intensity = beamCore * (0.35 + 0.65 * pulse);

    vec3 color = uPulseColor * (1.0 + pulse * 0.8);
    gl_FragColor = vec4(color, intensity * 0.9);
  }
`

// 4. Material Factory by Quality Tier
export function createPlumeMaterial(qualityTier = 'High') {
  if (qualityTier === 'Low') {
    return new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
  }

  return new THREE.ShaderMaterial({
    vertexShader: plumeVertexShader,
    fragmentShader: plumeFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uThrottle: { value: 1.0 },
      uColorCore: { value: new THREE.Color(0.9, 0.95, 1.0) },
      uColorFlame: { value: new THREE.Color(0.2, 0.6, 1.0) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function createTrailRibbonMaterial(colorHex = 0x38bdf8, qualityTier = 'High') {
  if (qualityTier === 'Low') {
    return new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })
  }

  return new THREE.ShaderMaterial({
    vertexShader: trailRibbonVertexShader,
    fragmentShader: trailRibbonFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Color(colorHex) },
      uFadeLength: { value: 0.35 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function createCommsPulseMaterial(qualityTier = 'High') {
  if (qualityTier === 'Low') {
    return new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
    })
  }

  return new THREE.ShaderMaterial({
    vertexShader: commsPulseVertexShader,
    fragmentShader: commsPulseFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uCommsActive: { value: true },
      uPulseColor: { value: new THREE.Color(0x38bdf8) },
      uPulseSpeed: { value: 12.0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
