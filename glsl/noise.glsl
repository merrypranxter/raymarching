// noise.glsl — Procedural noise functions for surface displacement,
//              domain warping, and organic texture generation.

// ------------------------------------------------------------
// Hash functions — deterministic pseudo-random scalars from scalars/vectors
// ------------------------------------------------------------

float hash11(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// ------------------------------------------------------------
// Value Noise — trilinear interpolation of random values on a grid.
// Returns values in [0, 1].
// ------------------------------------------------------------
float valueNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    // Smooth Hermite interpolation (C2 continuity)
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(mix(hash13(i + vec3(0, 0, 0)),
                       hash13(i + vec3(1, 0, 0)), u.x),
                   mix(hash13(i + vec3(0, 1, 0)),
                       hash13(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(hash13(i + vec3(0, 0, 1)),
                       hash13(i + vec3(1, 0, 1)), u.x),
                   mix(hash13(i + vec3(0, 1, 1)),
                       hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}

// Convenience alias used by other modules.
float noise(vec3 p) { return valueNoise3(p); }

// ------------------------------------------------------------
// Fractal Brownian Motion (FBM) — layered noise octaves.
//
// Each octave doubles the frequency and halves the amplitude,
// producing a self-similar, cloud-like signal.
//
//   octaves   — number of noise layers (4–8 is typical)
//   lacunarity — frequency multiplier per octave (default ~2.0)
//   gain      — amplitude multiplier per octave  (default ~0.5)
// ------------------------------------------------------------
float fbm(vec3 p, int octaves, float lacunarity, float gain) {
    float value  = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {           // unrolled upper bound for WebGL 1.0
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        frequency  *= lacunarity;
        amplitude  *= gain;
    }
    return value;
}

// Convenience: FBM with sensible defaults
float fbm(vec3 p) {
    return fbm(p, 5, 2.0, 0.5);
}

// ------------------------------------------------------------
// Domain-Warped FBM ("Alien Terrain" look).
// Warps the query position using fbm before sampling a second fbm.
// Reference: https://iquilezles.org/articles/warp/
// ------------------------------------------------------------
float fbmWarp(vec3 p) {
    vec3 q = vec3(fbm(p + vec3(0.0, 0.0, 0.0)),
                  fbm(p + vec3(5.2, 1.3, 2.7)),
                  fbm(p + vec3(9.1, 3.7, 5.5)));
    return fbm(p + 4.0 * q);
}

// ------------------------------------------------------------
// Gradient / Simplex-style 2D noise (useful for animated patterns).
// ------------------------------------------------------------
float gradientNoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash12(i + vec2(0.0, 0.0));
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
