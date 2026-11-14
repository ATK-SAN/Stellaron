// Rocket Exhaust Plume GLSL Shader (STELLARON Mission Rehearsal)
// Models supersonic rocket exhaust expansion with animated shock diamonds and turbulent boundary layer.

precision mediump float;

uniform float uTime;
uniform float uThrottle; // 0.0 = off, 1.0 = full thrust
uniform vec3 uColorCore;  // bright white-blue core: vec3(0.9, 0.95, 1.0)
uniform vec3 uColorFlame; // outer flame orange/cyan: vec3(0.2, 0.6, 1.0) or vec3(1.0, 0.5, 0.1)

varying vec2 vUv;
varying vec3 vNormal;

// Pseudo-random noise
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
    if (uThrottle <= 0.01) {
        discard;
    }

    vec2 uv = vUv;
    float distFromAxis = abs(uv.x - 0.5) * 2.0; // 0 at center, 1 at edge
    float lengthProgress = uv.y;                 // 0 at nozzle, 1 at tail

    // Supersonic expansion envelope (cone flares outwards slightly then tapers)
    float expansion = 0.2 + 0.8 * lengthProgress;
    if (distFromAxis > expansion) {
        discard;
    }

    // Shock diamond pattern along the core (periodic standing waves)
    float shockDiamonds = sin(lengthProgress * 35.0 - uTime * 25.0);
    shockDiamonds = smoothstep(0.4, 0.95, shockDiamonds) * (1.0 - lengthProgress);

    // High-speed turbulence advection
    vec2 flowUv = vec2(uv.x * 4.0, uv.y * 8.0 - uTime * 15.0);
    float turb = noise(flowUv) * 0.35;

    // Density and temperature distribution
    float core = (1.0 - distFromAxis / expansion) * (1.0 - lengthProgress * 0.7);
    core = clamp(core + shockDiamonds * 0.4 + turb, 0.0, 1.0);

    // Color gradient: brilliant blue-white core transitioning to glowing expansion boundary
    vec3 color = mix(uColorFlame, uColorCore, pow(core, 1.8));

    // Intensity modulated by thrust throttle
    float alpha = pow(core, 1.2) * uThrottle * (1.0 - lengthProgress * 0.85);

    gl_FragColor = vec4(color * 1.5, alpha);
}
