# Ray Marching — Vibe SDF Engine

A fully functional **Ray Marching** renderer built on top of p5.js (WebGL) with a modular GLSL library, interactive camera, optional audio reactivity, and a declarative scene configuration system.

---

## What Is Ray Marching?

Traditional 3D graphics rasterise geometry — they project triangles onto the screen.  Ray Marching works differently: **it fires a ray from the camera through each pixel and asks the scene "how far am I from the nearest surface?"**

This technique (also called *Sphere Tracing*) uses **Signed Distance Functions (SDFs)** — mathematical formulas that return the exact distance from any point in space to a surface.

```
   camera
     │
     │ ray
     │           ◯ sphere
     │         ╱
     │       ╱  step = SDF(p)
     │     ╱
     │   p
     ▼
```

At each step:
1. Evaluate `sceneMap(p)` — the global SDF that combines all objects.
2. The returned value `d` is a *guaranteed safe step distance* — no surface is closer.
3. Advance the ray by `d`.
4. Repeat until `d < ε` (hit!) or the ray travels too far (background).

### Why Use SDFs?

| Feature | Traditional Triangle Mesh | SDF / Ray Marching |
|---|---|---|
| Resolution | Fixed polygon count | **Infinite detail** (fractals, etc.) |
| Boolean operations | Complex mesh surgery | `min(d1, d2)` — one line |
| Organic blending | Requires complex simulation | `opSmoothUnion` — three lines |
| Non-Euclidean space | Near-impossible | `mod(p, size)` — one line |
| Soft shadows | Many shadow maps | Free, from the SDF itself |
| Ambient Occlusion | Pre-baked or expensive | 5-sample SDF loop |

---

## Repository Structure

```
raymarching/
├── index.html                  # Entry point — open this in a browser
├── sketch.js                   # p5.js main sketch (preload / setup / draw)
│
├── glsl/
│   ├── base.vert               # Standard fullscreen-quad vertex shader
│   ├── marcher.frag            # ★ Core ray marching loop & camera
│   ├── primitives.glsl         # SDF library: sphere, box, torus, capsule…
│   ├── operations.glsl         # CSG: union, subtract, intersect, smooth blend
│   ├── manifolds.glsl          # Space: repeat, twist, bend, rotate, mirror
│   ├── noise.glsl              # Hash, value noise, FBM, domain warping
│   ├── lighting.glsl           # Normals, AO, soft shadows, Blinn-Phong
│   ├── volumetrics.glsl        # Fog, god rays, tone mapping (ACES)
│   ├── dithering.glsl          # Blue-noise dither, gamma correction
│   ├── texturing.glsl          # Triplanar mapping, cosine palettes
│   └── fractals.glsl           # Menger sponge, Mandelbulb, Sierpinski, Julia
│
├── scripts/
│   ├── js5-bridge.js           # RayMarchBridge — p5.js ↔ GLSL integration
│   ├── glsl-preprocess.js      # #include preprocessor for browser GLSL
│   ├── math-utils.js           # CPU-side SDF / vector / colour helpers
│   ├── camera-control.js       # CameraController — orbit camera
│   ├── audio-bridge.js         # AudioBridge — microphone FFT → uniforms
│   └── vibe-engine.js          # VibeEngine — declarative scene controller
│
├── config/
│   ├── scene_graph.yaml        # Declarative scene definitions
│   ├── materials.csv           # Material IDs → colour + roughness + emission
│   ├── palettes.json           # Curated colour ramps for instant mood changes
│   ├── seeds.csv               # Named "dimensions" — random seed presets
│   └── environments.yaml       # Fog colour, light direction, shadow settings
│
├── docs/
│   └── vibecoding-manual.md    # Artistic direction & performance guidelines
│
└── LICENSE                     # MIT
```

---

## Quick Start

1. **Clone** the repo:
   ```bash
   git clone https://github.com/merrypranxter/raymarching.git
   cd raymarching
   ```

2. **Serve** it locally (browsers require HTTP for `fetch()`):
   ```bash
   # Python 3
   python3 -m http.server 8080

   # Node.js (npx)
   npx serve .

   # VS Code: use the "Live Server" extension
   ```

3. **Open** `http://localhost:8080` in any modern browser.

4. **Interact**:
   - **Drag** to orbit the camera
   - **Scroll** to zoom in/out
   - **`Space`** to randomise the scene "vibe"
   - **`M`** to activate the microphone (makes the scene audio-reactive)

---

## Key File Breakdowns

### `glsl/marcher.frag` — The Engine

This is the heart of the renderer.  It implements the sphere-tracing loop described above.

**Camera setup** builds a look-at matrix from `u_cameraPos` and `u_lookAt`, then computes a ray direction `rd` for each pixel:

```glsl
mat3 cam = calcCamera(ro, ta, vec3(0, 1, 0));
vec3 rd  = cam * normalize(vec3(uv, focalLength));
```

**The marching loop**:
```glsl
for (int i = 0; i < MAX_STEPS; i++) {
    vec2 res = sceneMap(ro + rd * dO);  // query the scene
    if (res.x < SURFACE_DIST) break;    // hit!
    dO += res.x;                         // safe step forward
    if (dO > MAX_DIST) break;            // escaped — background
}
```

**Scene composition** (`sceneMap`) is where you define the world — combine any number of SDFs:
```glsl
vec2 sceneMap(vec3 p) {
    float sphere = sdSphere(p, 1.0);
    float box    = sdBox(p, vec3(0.7));
    float blob   = opSmoothUnion(sphere, box, 0.4);
    return vec2(blob, 1.0);  // .x = distance, .y = material ID
}
```

---

### `glsl/operations.glsl` — The "Vibe Hack"

SDFs can be combined using only arithmetic — this is **Constructive Solid Geometry (CSG)**:

| Operation | Formula | Effect |
|---|---|---|
| Union | `min(d1, d2)` | Both shapes merged |
| Subtraction | `max(-d2, d1)` | Carve d2 out of d1 |
| Intersection | `max(d1, d2)` | Only the overlap |
| **Smooth Union** | `opSmoothUnion(d1, d2, k)` | **Organic mercury melt** |

The smooth union is the most important operator in SDF art:
```glsl
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}
```
Increase `k` to widen the blend zone.  At `k = 0` it degrades to a hard union.

---

### `glsl/manifolds.glsl` — Non-Euclidean Space

By transforming the query point `p` **before** calling the SDF, you can create impossible geometry:

```glsl
// Infinite tiling — one object appears as an infinite grid
vec3 q = repeatSpace(p, vec3(4.0));

// Twist space along Y
vec3 q = twistY(p, sin(u_time) * 0.5);

// Radial symmetry — 5-fold around Y axis
vec3 q = opRadialSymmetry(p, 5.0);
```

The key insight: **the SDF never sees the raw position**, so it remains valid everywhere.

---

### `glsl/lighting.glsl` — Realistic Illumination

**Normals** are estimated numerically via central differences (no explicit geometry needed):
```glsl
vec3 n = calcNormal(p);  // gradient of the SDF = surface normal
```

**Soft Shadows** use the SDF itself — no shadow maps, no ray tracing:
```glsl
// As the shadow ray approaches an occluder, the SDF value gets small.
// The ratio (SDF value) / (distance travelled) gives the penumbra.
float shadow = calcShadow(p, lightDir, 0.01, 20.0, 16.0);
```

**Ambient Occlusion** samples the SDF along the surface normal:
```glsl
// Where the SDF "closes in" faster than expected → the point is occluded.
float ao = calcAO(p, n);
```

---

### `glsl/fractals.glsl` — Infinite Detail

Fractals are created by **iterative folding** of space.  The Menger Sponge divides a cube into 27 sub-cubes and removes the central cross — then repeats:

```glsl
float sdMenger(vec3 p, int iterations) {
    float d = sdBox(p, vec3(1.0));
    float s = 1.0;
    for (int m = 0; m < iterations; m++) {
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;
        // ... fold and measure
    }
    return d;
}
```

The **Mandelbulb** extends the 2D Mandelbrot set into 3D using polar coordinates and power-8 iteration — producing its distinctive tentacled surface.

---

## Audio Reactivity

Press **`M`** to enable the microphone, then the scene reacts to sound:

```js
audio.update();  // in draw() — refreshes FFT analysis

RM.draw({
  audioLow:  audio.low,   // bass  → blob radius, ground pulse
  audioMid:  audio.mid,   // mids  → bloom intensity, material glow
  audioHigh: audio.high,  // highs → noise frequency, fractal detail
});
```

In the shader, these map directly to surface behaviour:
```glsl
// Bass makes the blob breathe
float r = 0.9 + 0.2 * u_audioLow;

// Highs sharpen the surface noise
float n = fbm(p * (2.0 + 3.0 * u_audioHigh));
```

---

## Extending the Engine

### Add a new primitive

1. Add the SDF function to `glsl/primitives.glsl`
2. Call it in `sceneMap()` in `glsl/marcher.frag`
3. Return its material ID

### Add a new material

1. Add a row to `config/materials.csv`
2. Add a case to `matColor()` in `marcher.frag`

### Create a new scene preset

1. Add a row to `config/seeds.csv`
2. (Optional) set `fractal_type` to `"menger"`, `"mandelbulb"`, or `"sierpinski"`
3. Press **`Space`** in-browser to cycle through seeds

---

## Technical Notes

- **No triangle geometry** — every pixel is independently shaded by the fragment shader.
- The `#include` preprocessor (`glsl-preprocess.js`) resolves dependencies at load time; the GPU sees a single concatenated GLSL string.
- All uniforms are passed from JS → shader each frame; the GPU has no persistent state between frames.
- The `precision highp float` directive is required for mobile WebGL accuracy.
- For production use, compile GLSL offline with a tool like `glslify` or `glsl-optimizer`.

---

## References

- [Inigo Quilez — SDF functions](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez — Ray Marching](https://iquilezles.org/articles/raymarchingdf/)
- [Inigo Quilez — Domain Warping](https://iquilezles.org/articles/warp/)
- [Inigo Quilez — Cosine Palettes](https://iquilezles.org/articles/palettes/)
- [Jamie Wong — Ray Marching Intro](https://jamie-wong.com/2016/07/15/ray-marching-signed-distance-functions/)
- [The Book of Shaders](https://thebookofshaders.com/)

---

## License

MIT — see [LICENSE](LICENSE).
