// dithering.glsl — Screen-space dithering to remove colour banding.
//
// When rendering smooth gradients in 8-bit colour, you get visible
// "steps" called banding.  Dithering adds a small, structured random
// offset before quantisation so the eye perceives a smooth gradient.

// ------------------------------------------------------------
// Bayer Matrix Ordered Dithering (4x4)
//
// Classic deterministic pattern — each pixel gets a fixed threshold
// based on its screen position.  Produces a regular, retro-look grid.
//
//   color  — linear HDR colour (before gamma correction)
//   fragCoord — gl_FragCoord.xy
//   amount — dither strength (1.0/255.0 for 8-bit, larger for effect)
// ------------------------------------------------------------
vec3 ditheredBayer(vec3 color, vec2 fragCoord, float amount) {
    // 4x4 Bayer matrix values normalised to [0, 1]
    const mat4 bayerMatrix = mat4(
         0.0 / 16.0,  8.0 / 16.0,  2.0 / 16.0, 10.0 / 16.0,
        12.0 / 16.0,  4.0 / 16.0, 14.0 / 16.0,  6.0 / 16.0,
         3.0 / 16.0, 11.0 / 16.0,  1.0 / 16.0,  9.0 / 16.0,
        15.0 / 16.0,  7.0 / 16.0, 13.0 / 16.0,  5.0 / 16.0
    );
    int ix = int(mod(fragCoord.x, 4.0));
    int iy = int(mod(fragCoord.y, 4.0));
    float threshold = bayerMatrix[iy][ix];
    return color + (threshold - 0.5) * amount;
}

// ------------------------------------------------------------
// Blue-Noise Dithering (hash approximation)
//
// Uses a screen-space hash to approximate blue noise.
// Less patterned than Bayer — looks more like film grain.
// This is the technique used in AAA game engines (e.g. Unreal / Frostbite).
//
//   color  — linear HDR colour
//   uv     — normalised screen UV (vTexCoord or gl_FragCoord / u_resolution)
//   amount — dither strength (1.0/255.0 for 8-bit, 0.01–0.05 for art)
// ------------------------------------------------------------
vec3 applyDither(vec3 color, vec2 uv, float amount) {
    float d = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
    return color + (d - 0.5) * amount;
}

// Single-channel variant (useful for monochrome or depth buffers).
float applyDither1(float v, vec2 uv, float amount) {
    float d = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
    return v + (d - 0.5) * amount;
}

// ------------------------------------------------------------
// Gamma Correction
//
// Monitors display in sRGB (~gamma 2.2).  Linear light values must
// be gamma-corrected before output to look perceptually correct.
//
// Apply as the *last* step before gl_FragColor.
// ------------------------------------------------------------
vec3 linearToSRGB(vec3 c) {
    // piecewise IEC 61966-2-1 standard
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

// Fast approximation (single pow).
vec3 gammaCorrect(vec3 c) {
    return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}
