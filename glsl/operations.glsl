// operations.glsl — Constructive Solid Geometry (CSG) on SDFs,
//                   plus smooth blending operators.
//
// Because SDFs encode the *distance* to a surface, you can combine
// them using only arithmetic — no polygon clipping required.

// ------------------------------------------------------------
// Standard Boolean Operations
// ------------------------------------------------------------

// Union: the nearest surface wins.
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

// Subtraction: carve shape d2 out of d1.
// We negate d2 so we are "inside" d2 where we want to remove material.
float opSubtraction(float d1, float d2) {
    return max(-d2, d1);
}

// Intersection: keep only where both shapes overlap.
float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

// Complement: flip inside/outside.
float opComplement(float d) {
    return -d;
}

// ------------------------------------------------------------
// Material-aware versions (return vec2 where .x = dist, .y = material ID)
// ------------------------------------------------------------
vec2 opUnionMat(vec2 a, vec2 b) {
    return (a.x < b.x) ? a : b;
}

vec2 opSubtractionMat(vec2 a, vec2 b) {
    return (-b.x > a.x) ? vec2(-b.x, b.y) : a;
}

vec2 opIntersectionMat(vec2 a, vec2 b) {
    return (a.x > b.x) ? a : b;
}

// ------------------------------------------------------------
// Smooth Blending (the "organic mercury" effect)
// ------------------------------------------------------------
// Smooth Union — the most used operator in SDF art.
// k controls the blend radius: larger k = wider melt zone.
// Returns .x = blended distance, .y = blend factor (0=d1, 1=d2).
vec2 opSmoothUnionBlend(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    float dist = mix(d2, d1, h) - k * h * (1.0 - h);
    return vec2(dist, h);
}

float opSmoothUnion(float d1, float d2, float k) {
    return opSmoothUnionBlend(d1, d2, k).x;
}

// Smooth Subtraction — carve with softened edges.
float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

// Smooth Intersection — softened overlap region.
float opSmoothIntersection(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

// Material-aware smooth union: blends material IDs proportionally.
vec2 opSmoothUnionMat(vec2 a, vec2 b, float k) {
    vec2 res = opSmoothUnionBlend(a.x, b.x, k);
    float matID = mix(b.y, a.y, res.y); // interpolate material
    return vec2(res.x, matID);
}

// ------------------------------------------------------------
// Domain Transformations (applied to p before querying the SDF)
// ------------------------------------------------------------

// Round edges by subtracting a small constant from the distance.
float opRound(float d, float r) {
    return d - r;
}

// Hollow out a solid by taking the absolute value of its SDF.
float opOnion(float d, float thickness) {
    return abs(d) - thickness;
}

// Scale an SDF uniformly (you must also scale the returned distance).
float opScale(float d, float s) {
    return d / s;
}
