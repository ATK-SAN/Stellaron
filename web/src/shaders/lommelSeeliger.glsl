// Lommel-Seeliger Lunar Reflectance GLSL Shader (STELLARON Mission Rehearsal)
// Physically models the diffuse backscattering reflectance of the lunar regolith.
// Equation: R(i, e, alpha) = [cos(i) / (cos(i) + cos(e))] * f(alpha)

precision mediump float;

uniform vec3 uSunDirection;      // Unit vector pointing towards the Sun
uniform vec3 uCameraPosition;    // Camera position in world space
uniform vec3 uLunarAlbedo;       // Average lunar albedo (default ~0.12)
uniform float uOppositionFactor; // Opposition surge enhancement factor

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Lunar phase function approximation f(alpha)
float lunarPhaseFunction(float cosAlpha) {
    float alpha = acos(clamp(cosAlpha, -1.0, 1.0)); // Phase angle in radians
    // Empirical lunar phase function (Hapke / Buratti 1984)
    float linearTerm = 1.0 - 0.45 * (alpha / 3.14159265);
    // Opposition surge (strong brightening at near-zero phase angle)
    float surge = 1.0 + uOppositionFactor * exp(-alpha / 0.08);
    return max(0.0, linearTerm * surge);
}

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(uCameraPosition - vWorldPosition);

    float cos_i = dot(N, L); // Cosine of incidence angle
    float cos_e = dot(N, V); // Cosine of emission angle
    float cos_alpha = dot(L, V); // Cosine of phase angle

    // Night side shadow
    if (cos_i <= 0.0) {
        gl_FragColor = vec4(0.01, 0.01, 0.02, 1.0); // Deep lunar shadow
        return;
    }

    // Ensure valid emission angle on limb
    cos_e = max(0.001, cos_e);

    // Lommel-Seeliger diffuse scattering law
    float lommelSeeliger = cos_i / (cos_i + cos_e);

    // Combine with phase function and lunar albedo
    float phaseTerm = lunarPhaseFunction(cos_alpha);
    vec3 radiance = uLunarAlbedo * lommelSeeliger * phaseTerm * 2.2;

    // Subtle earthshine contribution on dark side if facing Earth
    radiance += vec3(0.008, 0.012, 0.016);

    gl_FragColor = vec4(radiance, 1.0);
}
