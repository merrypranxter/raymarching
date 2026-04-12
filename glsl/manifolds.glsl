// manifolds.glsl — Domain manipulation for non-Euclidean and modular space.
//
// These functions transform the query point p *before* it is passed to
// any SDF.  Because the SDF never "sees" the raw position, you get
// mathematically exact geometry in distorted / repeated space.

// ------------------------------------------------------------
// Space Repetition
// ------------------------------------------------------------

// Tile space with period c.  A single object appears as an infinite grid.
//   p = the query point
//   c = period vector (spacing between repetitions on each axis)
vec3 repeatSpace(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Limit the repetition to a finite number of tiles on each axis.
//   lim = max tile index in each direction (e.g. vec3(3) gives a 7x7x7 grid)
vec3 repeatLimited(vec3 p, float c, vec3 lim) {
    return p - c * clamp(round(p / c), -lim, lim);
}

// Mirror / Reflective symmetry along all three axes.
vec3 opSymXYZ(vec3 p) {
    return abs(p);
}

// Mirror along X only.
vec3 opSymX(vec3 p) {
    return vec3(abs(p.x), p.y, p.z);
}

// Radial symmetry: n-fold around the Y axis.
vec3 opRadialSymmetry(vec3 p, float n) {
    float angle = 2.0 * 3.14159265 / n;
    float a = atan(p.z, p.x);
    a = mod(a, angle) - angle * 0.5;
    return vec3(cos(a), p.y, sin(a)) * length(p.xz);
}

// ------------------------------------------------------------
// Rotation Helpers
// ------------------------------------------------------------
mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 rotateX(vec3 p, float a) { p.yz = rot2(a) * p.yz; return p; }
vec3 rotateY(vec3 p, float a) { p.xz = rot2(a) * p.xz; return p; }
vec3 rotateZ(vec3 p, float a) { p.xy = rot2(a) * p.xy; return p; }

// ------------------------------------------------------------
// Warping / Bending
// ------------------------------------------------------------

// Twist around the Y axis.  k is twist rate (radians per unit height).
vec3 twistY(vec3 p, float k) {
    float s = sin(k * p.y);
    float c = cos(k * p.y);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xz, p.y);
}

// Bend the space around the Y axis.  k is bend curvature.
vec3 bendY(vec3 p, float k) {
    float s = sin(k * p.x);
    float c = cos(k * p.x);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xy, p.z);
}

// Cheap "cheap displacement" — adds a noise-driven ripple to any SDF.
// Call AFTER the SDF value is computed:  d += displaceAmount(p, t);
float displaceAmount(vec3 p, float t) {
    return sin(4.0 * p.x + t) * sin(4.0 * p.y + t) * sin(4.0 * p.z + t) * 0.1;
}

// ------------------------------------------------------------
// Folding (used for fractals — see fractals.glsl)
// ------------------------------------------------------------

// Fold along the plane defined by normal n (must be normalised).
vec3 planeFold(vec3 p, vec3 n, float d) {
    return p - 2.0 * min(0.0, dot(p, n) - d) * n;
}

// Absolute-value fold along each axis (Menger / Sierpinski style).
vec3 absFold(vec3 p, vec3 c) {
    return abs(p) - c;
}
