// Earth-Moon Comms Pulse GLSL Shader (STELLARON Mission Rehearsal)
// Models animated direct-to-Earth (DTE) radio frequency pulses travelling along the geometric line-of-sight.

precision mediump float;

uniform float uTime;
uniform bool uCommsActive; // True when line-of-sight is unobstructed
uniform vec3 uPulseColor;  // Cyan #38bdf8 when active, red #f87171 during blackout
uniform float uPulseSpeed; // Transmission propagation speed

varying vec2 vUv;

void main() {
    if (!uCommsActive) {
        // Subtle dotted red indicator during blackout
        float dotted = step(0.5, fract(vUv.y * 30.0));
        gl_FragColor = vec4(1.0, 0.25, 0.25, dotted * 0.35);
        return;
    }

    // vUv.y: along-beam coordinate [0.0 = Lander, 1.0 = Earth]
    // vUv.x: cross-beam coordinate [-1.0 .. 1.0]

    float crossBeam = abs(vUv.x);
    float beamCore = 1.0 - smoothstep(0.0, 1.0, crossBeam);
    beamCore = pow(beamCore, 3.0);

    // Repeated propagating microwave wave packets
    float wavePhase = vUv.y * 50.0 - uTime * uPulseSpeed;
    float pulse = sin(wavePhase);
    pulse = smoothstep(0.2, 0.98, pulse);

    // Base continuous carrier beam + travelling RF pulses
    float intensity = beamCore * (0.35 + 0.65 * pulse);

    vec3 color = uPulseColor * (1.0 + pulse * 0.8);
    float alpha = intensity * 0.9;

    gl_FragColor = vec4(color, alpha);
}
