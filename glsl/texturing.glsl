// texturing.glsl — UV-free texturing techniques for SDF surfaces.
//
// SDFs don't have traditional UV coordinates, so we use projection-
// based methods that work anywhere on a surface without seams.

// Requires noise(vec3) from noise.glsl.

// ------------------------------------------------------------
// Triplanar Mapping
//
// Projects a 2D signal (noise or texture sample) from three
// axis-aligned planes, then blends them using the surface normal.
// The blend is smooth and seam-free regardless of surface orientation.
//
//   p      — world-space hit position
//   n      — surface normal (normalised)
//   scale  — UV scale factor
// Returns a single float sample (for greyscale textures / displacement).
// ------------------------------------------------------------
float triplanarSample(vec3 p, vec3 n, float scale) {
    vec3 blending = abs(n);
    // Sharpen the blend — raise to a power to reduce bleed at 45-degrees
    blending = pow(blending, vec3(4.0));
    blending /= blending.x + blending.y + blending.z + 0.0001;

    float xSample = noise(p.yzx * scale);
    float ySample = noise(p.zxy * scale);
    float zSample = noise(p.xyz * scale);

    return xSample * blending.x + ySample * blending.y + zSample * blending.z;
}

// Triplanar — returns a vec3 colour (use for coloured procedural textures).
vec3 triplanarColor(vec3 p, vec3 n, float scale) {
    vec3 blending = abs(n);
    blending = pow(blending, vec3(4.0));
    blending /= blending.x + blending.y + blending.z + 0.0001;

    vec3 xCol = vec3(noise(p.yzx * scale),
                     noise(p.yzx * scale * 2.1 + vec3(3.7, 1.3, 0.0)),
                     noise(p.yzx * scale * 0.7 + vec3(5.2, 9.1, 0.0)));
    vec3 yCol = vec3(noise(p.zxy * scale),
                     noise(p.zxy * scale * 2.1 + vec3(3.7, 1.3, 0.0)),
                     noise(p.zxy * scale * 0.7 + vec3(5.2, 9.1, 0.0)));
    vec3 zCol = vec3(noise(p.xyz * scale),
                     noise(p.xyz * scale * 2.1 + vec3(3.7, 1.3, 0.0)),
                     noise(p.xyz * scale * 0.7 + vec3(5.2, 9.1, 0.0)));

    return xCol * blending.x + yCol * blending.y + zCol * blending.z;
}

// ------------------------------------------------------------
// Normal Mapping via Bump Mapping
//
// Perturbs the surface normal using a noise-derived height field.
// Gives the impression of micro-surface detail without extra geometry.
// ------------------------------------------------------------
vec3 bumpNormal(vec3 p, vec3 n, float bumpScale, float bumpStrength) {
    const float eps = 0.002;
    float h0 = triplanarSample(p,              n, bumpScale);
    float hx = triplanarSample(p + vec3(eps, 0, 0), n, bumpScale);
    float hy = triplanarSample(p + vec3(0, eps, 0), n, bumpScale);
    float hz = triplanarSample(p + vec3(0, 0, eps), n, bumpScale);
    vec3 bumpGrad = vec3(hx - h0, hy - h0, hz - h0) / eps;
    return normalize(n + bumpStrength * (bumpGrad - dot(bumpGrad, n) * n));
}

// ------------------------------------------------------------
// Colour Palettes (cosine colour palette — Inigo Quilez technique)
//
// Generates a smooth, cyclic colour ramp from four vec3 parameters:
//   colour = a + b * cos(2π(c*t + d))
//
// t ranges over [0, 1]; tweak a/b/c/d for different palettes.
// See https://iquilezles.org/articles/palettes/
// ------------------------------------------------------------
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

// Pre-built palettes (pass a t value in [0,1]):
vec3 paletteSunset(float t) {
    return cosinePalette(t,
        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
        vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
}
vec3 paletteCyberpunk(float t) {
    return cosinePalette(t,
        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
        vec3(2.0, 1.0, 0.0), vec3(0.5, 0.2, 0.25));
}
vec3 paletteBioluminescent(float t) {
    return cosinePalette(t,
        vec3(0.2, 0.5, 0.5), vec3(0.2, 0.4, 0.4),
        vec3(2.0, 1.0, 1.0), vec3(0.0, 0.25, 0.5));
}
