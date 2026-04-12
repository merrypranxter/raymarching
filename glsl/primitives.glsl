// primitives.glsl — Signed Distance Functions (SDFs) for common primitives.
//
// An SDF returns the *signed* distance from a query point p to the surface:
//   < 0  →  inside the surface
//   = 0  →  on the surface
//   > 0  →  outside the surface
//
// Reference: https://iquilezles.org/articles/distfunctions/

// ------------------------------------------------------------
// Sphere centred at the origin with radius r.
// The simplest SDF: just subtract the radius from the point's length.
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// ------------------------------------------------------------
// Axis-aligned Box centred at the origin with half-extents b.
// The "max(q, 0)" term handles the exterior; the "min(maxq, 0)" handles
// the interior so the field is negative inside.
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Rounded Box — like sdBox but with filleted edges of radius r.
float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// ------------------------------------------------------------
// Torus in the XZ plane.  t.x = major radius, t.y = tube radius.
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// Capped Torus — open arc spanning angle 'an' (radians).
float sdCappedTorus(vec3 p, vec2 sc, float ra, float rb) {
    p.x = abs(p.x);
    float k = (sc.y * p.x > sc.x * p.y) ? dot(p.xy, sc) : length(p.xy);
    return sqrt(dot(p, p) + ra * ra - 2.0 * ra * k) - rb;
}

// ------------------------------------------------------------
// Infinite Cylinder aligned to the Y-axis with radius r.
float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}

// Capped Cylinder from (0,-h) to (0,+h) with radius r.
float sdCappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// ------------------------------------------------------------
// Capsule / Line segment from point a to point b with radius r.
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b - a;
    vec3 ap = p - a;
    float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    return length(ap - ab * t) - r;
}

// ------------------------------------------------------------
// Infinite Plane.  n must be normalised.  d is the plane's distance
// from the origin (signed: positive side is where n points).
float sdPlane(vec3 p, vec3 n, float d) {
    return dot(p, n) + d;
}

// ------------------------------------------------------------
// Cone with half-angle defined by (sin(a), cos(a)), capped at height h.
float sdCone(vec3 p, vec2 c, float h) {
    vec2 q = h * vec2(c.x / c.y, -1.0);
    vec2 w = vec2(length(p.xz), p.y);
    vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
    vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
    float k = sign(q.y);
    float d = min(dot(a, a), dot(b, b));
    float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
    return sqrt(d) * sign(s);
}

// ------------------------------------------------------------
// Hexagonal Prism aligned to the Y-axis.
// h.x = circumradius (XZ), h.y = half-height (Y).
float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
    vec2 d = vec2(length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
                  p.z - h.y);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
