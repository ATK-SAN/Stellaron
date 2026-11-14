// Trajectory Trail Ribbon GLSL Shader (STELLARON Mission Rehearsal)
// Renders the orbital flight path ribbon trailing behind the spacecraft with glowing edges and fade-out.

precision mediump float;

uniform float uTime;
uniform vec3 uColor;       // Phase color (e.g. #38bdf8 for transit, #a78bfa for orbit)
uniform float uFadeLength; // Normalized length over which the trail fades

varying vec2 vUv;
varying float vAlpha;

void main() {
    // vUv.x: cross-track coordinate [-1.0 .. 1.0]
    // vUv.y: along-track coordinate [0.0 (oldest) .. 1.0 (head at spacecraft)]

    float crossTrack = abs(vUv.x);
    float alongTrack = vUv.y;

    // Glowing core ribbon with soft feathering on edges
    float edgeGlow = 1.0 - smoothstep(0.0, 1.0, crossTrack);
    edgeGlow = pow(edgeGlow, 2.5);

    // Fade out towards tail
    float tailFade = smoothstep(0.0, uFadeLength, alongTrack);

    // Subtle pulsing shimmer along the path
    float shimmer = 0.95 + 0.05 * sin(alongTrack * 40.0 - uTime * 6.0);

    vec3 finalColor = uColor * (1.0 + edgeGlow * 0.8) * shimmer;
    float finalAlpha = edgeGlow * tailFade * 0.85;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
