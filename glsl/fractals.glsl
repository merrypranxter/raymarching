// fractals.glsl — 3D fractal Signed Distance Functions.
//
// Fractals in SDF space are created through iterative "folding":
// you fold 3D space over itself repeatedly before measuring the
// distance to a simple primitive.  Each fold doubles the effective
// detail without adding geometry.

// sdBox must be declared before this file is included
// (it is defined in primitives.glsl).

// ------------------------------------------------------------
// Menger Sponge
//
// The Menger Sponge is a fractal cube.  At each iteration the
// cube is divided into 27 sub-cubes and the centre cross is removed.
//
//   iterations — recursion depth (3–5 is typical; >5 is very slow)
// ------------------------------------------------------------
float sdMenger(vec3 p, int iterations) {
    float d = sdBox(p, vec3(1.0));
    float s = 1.0;
    for (int m = 0; m < 5; m++) {
        if (m >= iterations) break;
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0 * abs(a));

        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float c  = (min(da, min(db, dc)) - 1.0) / s;

        d = max(d, c);
    }
    return d;
}

// ------------------------------------------------------------
// Mandelbulb
//
// A 3D generalisation of the Mandelbrot set.  Unlike the 2D set,
// the power-8 Mandelbulb formula produces spectacular "bulbous"
// tentacle-like surfaces.
//
// The distance estimator is not exact — use a smaller SURFACE_DIST
// threshold (e.g. 0.001) and reduce MAX_STEPS if artefacts appear.
// ------------------------------------------------------------
float sdMandelbulb(vec3 p) {
    vec3  w  = p;
    float m  = dot(w, w);
    float dz = 1.0;

    for (int i = 0; i < 8; i++) {
        // Derivative update (power rule for complex-analytic extension)
        dz = 8.0 * pow(sqrt(m), 7.0) * dz + 1.0;

        // Polar coordinates of w
        float r     = length(w);
        float theta = 8.0 * acos(clamp(w.y / r, -1.0, 1.0));
        float phi   = 8.0 * atan(w.x, w.z);

        // w = p + r^8 * (sin θ sin φ, cos θ, sin θ cos φ)
        w = p + pow(r, 8.0) * vec3(sin(theta) * sin(phi),
                                    cos(theta),
                                    sin(theta) * cos(phi));
        m = dot(w, w);
        if (m > 256.0) break;
    }

    // Distance Estimator: 0.25 * log|w| * |w| / |dz|
    return 0.25 * log(m) * sqrt(m) / dz;
}

// ------------------------------------------------------------
// Sierpinski Tetrahedron (Iterated Function System folding)
//
// Created by folding around the four faces of a regular tetrahedron.
// Produces a self-similar triangular fractal sponge.
// ------------------------------------------------------------
float sdSierpinski(vec3 p, int iterations) {
    const float SCALE = 2.0;
    const float OFFSET = 1.0;

    for (int n = 0; n < 8; n++) {
        if (n >= iterations) break;
        if (p.x + p.y < 0.0) p.xy = -p.yx;
        if (p.x + p.z < 0.0) p.xz = -p.zx;
        if (p.y + p.z < 0.0) p.yz = -p.zy;
        p = p * SCALE - OFFSET * (SCALE - 1.0);
    }
    return length(p) * pow(SCALE, -float(iterations));
}

// ------------------------------------------------------------
// Apollonian Gasket — sphere-inversion fractal.
// Creates infinitely nested tangent spheres.
// ------------------------------------------------------------
float sdApollonian(vec3 p, float scale) {
    float orb = 1e10;
    float s = 1.0;
    for (int i = 0; i < 8; i++) {
        p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
        float r2 = dot(p, p);
        float k = scale / r2;
        p *= k;
        s *= k;
        orb = min(orb, r2);
    }
    return 0.5 * abs(p.y) / s;
}

// ------------------------------------------------------------
// Julia Set (3D extension using quaternions)
// c controls the shape; animate it over time for mesmerising morphs.
// ------------------------------------------------------------
float sdJulia(vec3 p, vec4 c, int iterations) {
    vec4 z   = vec4(p, 0.0);
    float md2 = 1.0;
    float mz2 = dot(z, z);

    for (int i = 0; i < 11; i++) {
        if (i >= iterations) break;
        // Quaternion squaring: z^2 + c
        md2 *= 4.0 * mz2;
        z    = vec4(z.x * z.x - dot(z.yzw, z.yzw),
                    2.0 * z.x * z.yzw) + c;
        mz2  = dot(z, z);
        if (mz2 > 4.0) break;
    }
    return 0.25 * sqrt(mz2 / md2) * log(mz2);
}
