# Artistic Direction for the Vibe-SDF Engine

This document is the "creative bible" for the ray marching engine — intended
for both human artists and AI collaborators.  Read it before modifying any
GLSL files or composing a new scene.

---

## Core Philosophy

This engine treats 3D space as a mathematical sculpture medium.  Every object
is an equation, not a mesh.  The goal is **organic**, **infinite**, and
**cinematic** — never flat, never static, never boring.

---

## The Five Artistic Rules

### 1. The Organic Rule
Pure geometric shapes (a perfect sphere or cube) are boring.  Always apply
`noise.glsl` to the surface to create "biological imperfection."

```glsl
// Example: breathing sphere
float r = 0.9 + 0.1 * fbm(p * 2.0 + u_time * 0.3);
float d = sdSphere(p, r);
```

### 2. The Cinematic Rule
Use `applyFog` with a very low density (`0.02`–`0.06`) to ensure the
background never feels like a flat wall.  Fog is "air."  Without it your
scene is in a vacuum.

```glsl
col = applyFog(col, dO, vec3(0.03, 0.04, 0.07), 0.04);
```

### 3. The Light Rule
Always place the primary light source **slightly behind and above** the
objects (rim lighting) to emphasise mathematical silhouettes.  Avoid
front-lit scenes — they flatten the geometry.

```glsl
vec3 lightPos = vec3(4.0 * sin(t), 5.0, 4.0 * cos(t));
```

### 4. The Interaction Rule
Map at least one dimension of the scene to user input or audio.  A static
SDF scene is a screensaver; a reactive scene is an instrument.

```glsl
// Blob radius pulses with bass
float r = 0.9 + 0.2 * u_audioLow;
```

### 5. The Palette Rule
Never use raw RGB values.  Always pick colours from a cosine palette
(`cosinePalette` in `texturing.glsl`) or from `config/palettes.json`.
This ensures harmonic colour relationships that look intentional.

---

## Transform Order

When combining domain transformations, apply them in this order to avoid
counter-intuitive behaviour:

1. **Translate** — move the origin to the object's position
2. **Rotate** — orient the object
3. **Repeat / Mirror** — tile or symmetrise the space
4. **Warp / Twist / Bend** — add non-linear deformation
5. **Query the SDF** — sample the primitive

Applying a twist *before* translation will twist around the world origin,
not the object's centre — almost never what you want.

---

## Camera Design

| Use case | Recommended setting |
|---|---|
| Showcase a single object | Orbit camera, `distance` 3–6, slow auto-rotate |
| Infinite tunnel / corridor | Ray origin inside repeated space, march forward |
| Fractal exploration | Exponential zoom (decrease distance each frame) |
| Audio-reactive fly-through | Animate `cameraPos` along a Bezier or noise path |

---

## Performance Guidelines

| Tweak | Impact |
|---|---|
| Reduce `MAX_STEPS` (e.g. 64) | Major speed-up, may cause holes in complex scenes |
| Increase `SURFACE_DIST` (e.g. 0.002) | Faster convergence, slight surface offset |
| Reduce fractal `iterations` | Dramatic speed-up for Menger / Mandelbulb |
| Avoid `sceneMap` calls in loops | Each extra call doubles cost; cache normals |
| Use `repeatLimited` instead of `repeatSpace` | Prevents infinite-distance artefacts |

---

## The "Uber-Vibe" Hack

Combine the audio bridge with fractal detail to make geometry react to music:

```js
// in draw():
audio.update();
RM.draw({
  time: millis() / 1000,
  cameraPos: cam.position,
  lookAt: cam.target,
  audioLow:  audio.low,
  audioMid:  audio.mid,
  audioHigh: audio.high,
});
```

```glsl
// in marcher.frag sceneMap():
// Mandelbulb detail grows with treble hits
int iters = 4 + int(u_audioHigh * 4.0);
float d = sdMandelbulb(p);  // sdMandelbulb uses up to 8 iters
```

---

## Glossary

| Term | Definition |
|---|---|
| SDF | Signed Distance Function — a function returning the signed distance from a point to a surface |
| Ray Marching | Iteratively stepping a ray forward by the SDF value until it hits a surface |
| Sphere Tracing | The specific ray marching variant using the SDF as a safe step size |
| CSG | Constructive Solid Geometry — combining shapes with Boolean operations |
| FBM | Fractal Brownian Motion — layered noise for organic textures |
| Domain Warping | Distorting the query point before calling an SDF to bend/repeat space |
| Triplanar Mapping | Projecting textures from three axes to avoid UV seams on SDFs |
| Penumbra | The soft edge of a shadow caused by a finite-size light source |
| AO | Ambient Occlusion — darkening in crevices where ambient light is blocked |
| Tone Mapping | Converting HDR (high dynamic range) linear light to display range |
