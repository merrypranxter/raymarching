// Minimal CPU-side helpers that mirror some shader concepts.
const SDFMath = {
  lerp: (a, b, t) => a * (1 - t) + b * t,
  clamp: (x, a, b) => Math.max(a, Math.min(b, x))
};
