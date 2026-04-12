// math-utils.js — CPU-side helpers that mirror GLSL / SDF concepts.
//
// Useful for computing initial camera positions, animating uniforms on
// the JS side, or pre-validating SDF geometry before sending to the GPU.

const SDFMath = {
  // ── Basic ──────────────────────────────────────────────────────
  lerp:  (a, b, t) => a * (1 - t) + b * t,
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  saturate: (x) => Math.max(0, Math.min(1, x)),
  smoothstep: (lo, hi, x) => {
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  },
  fract: (x) => x - Math.floor(x),
  mix: (a, b, t) => a * (1 - t) + b * t,

  // ── Trigonometry ───────────────────────────────────────────────
  degToRad: (d) => d * Math.PI / 180,
  radToDeg: (r) => r * 180 / Math.PI,

  // ── Signed Distance Functions (CPU mirrors) ───────────────────
  sdSphere: (px, py, pz, r) => Math.sqrt(px*px + py*py + pz*pz) - r,

  sdBox: (px, py, pz, bx, by, bz) => {
    const qx = Math.abs(px) - bx;
    const qy = Math.abs(py) - by;
    const qz = Math.abs(pz) - bz;
    const len = Math.sqrt(
      Math.pow(Math.max(qx, 0), 2) +
      Math.pow(Math.max(qy, 0), 2) +
      Math.pow(Math.max(qz, 0), 2)
    );
    return len + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  },

  // Smooth minimum (matches opSmoothUnion in GLSL)
  smoothMin: (d1, d2, k) => {
    const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
    return Math.min(d1, d2) - h * h * k * 0.25;
  },

  // ── Vector Helpers (plain arrays [x, y, z]) ────────────────────
  vec3: (x, y, z) => [x, y, z],
  add3: ([ax, ay, az], [bx, by, bz]) => [ax+bx, ay+by, az+bz],
  sub3: ([ax, ay, az], [bx, by, bz]) => [ax-bx, ay-by, az-bz],
  scale3: ([x, y, z], s) => [x*s, y*s, z*s],
  dot3: ([ax, ay, az], [bx, by, bz]) => ax*bx + ay*by + az*bz,
  len3: ([x, y, z]) => Math.sqrt(x*x + y*y + z*z),
  norm3: (v) => {
    const l = SDFMath.len3(v);
    return l > 0 ? SDFMath.scale3(v, 1 / l) : [0, 0, 0];
  },
  cross3: ([ax, ay, az], [bx, by, bz]) => [
    ay*bz - az*by,
    az*bx - ax*bz,
    ax*by - ay*bx
  ],

  // ── Rotation ───────────────────────────────────────────────────
  rotateY: ([x, y, z], angle) => {
    const s = Math.sin(angle), c = Math.cos(angle);
    return [x*c + z*s, y, -x*s + z*c];
  },
  rotateX: ([x, y, z], angle) => {
    const s = Math.sin(angle), c = Math.cos(angle);
    return [x, y*c - z*s, y*s + z*c];
  },
  rotateZ: ([x, y, z], angle) => {
    const s = Math.sin(angle), c = Math.cos(angle);
    return [x*c - y*s, x*s + y*c, z];
  },

  // ── Camera ────────────────────────────────────────────────────
  // Compute orbit camera position from spherical angles.
  orbitPos: (target, distance, azimuth, elevation) => {
    const cosEl = Math.cos(elevation);
    return [
      target[0] + distance * cosEl * Math.sin(azimuth),
      target[1] + distance * Math.sin(elevation),
      target[2] + distance * cosEl * Math.cos(azimuth)
    ];
  },

  // ── Colour ────────────────────────────────────────────────────
  // Cosine palette (matches cosinePalette in GLSL / texturing.glsl).
  cosinePalette: (t, a, b, c, d) => [
    a[0] + b[0] * Math.cos(6.28318 * (c[0]*t + d[0])),
    a[1] + b[1] * Math.cos(6.28318 * (c[1]*t + d[1])),
    a[2] + b[2] * Math.cos(6.28318 * (c[2]*t + d[2]))
  ],

  // Convert a hex colour string to a normalised [r, g, b] array.
  hexToVec3: (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  },
};
