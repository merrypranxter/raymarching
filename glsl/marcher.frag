// marcher.frag — Core Ray Marching loop and camera system.
//
// ═══════════════════════════════════════════════════════════════
//  HOW RAY MARCHING WORKS
// ═══════════════════════════════════════════════════════════════
//
//  1. For every pixel on screen, fire a ray from the camera (ray origin ro)
//     through that pixel's position on the image plane (ray direction rd).
//
//  2. Ask the scene: "How far am I from the nearest surface right now?"
//     This is the Scene Distance Function (sceneMap).
//
//  3. Step forward along the ray by that distance — we know it's safe
//     because by definition no surface is closer than that distance.
//
//  4. Repeat until:
//       • distance < SURFACE_DIST  → we hit a surface
//       • total distance > MAX_DIST → ray escaped the scene (background)
//       • step count > MAX_STEPS   → bail out (missed geometry)
//
//  This technique is sometimes called "Sphere Tracing" because you move
//  forward by a sphere of known empty space each iteration.
//
// ═══════════════════════════════════════════════════════════════
//  LIBRARY DEPENDENCIES (prepended by js5-bridge.js)
// ═══════════════════════════════════════════════════════════════
//  primitives.glsl  — sdSphere, sdBox, sdTorus, etc.
//  operations.glsl  — opUnion, opSmoothUnion, opSubtraction, etc.
//  manifolds.glsl   — repeatSpace, twistY, rotateY, etc.
//  noise.glsl       — noise, fbm, fbmWarp
//  lighting.glsl    — calcNormal, calcAO, calcShadow, calcLighting
//  volumetrics.glsl — applyFog, toneMapACES
//  dithering.glsl   — applyDither, gammaCorrect
//  texturing.glsl   — triplanar mapping, bump normals, cosine palettes

uniform vec2  u_resolution;   // viewport size in pixels
uniform float u_time;         // seconds since start
uniform vec3  u_cameraPos;    // camera position in world space
uniform vec3  u_lookAt;       // point the camera looks at
uniform float u_audioLow;     // bass energy  [0,1]  (optional audio-bridge)
uniform float u_audioMid;     // mid energy   [0,1]
uniform float u_audioHigh;    // treble energy[0,1]
uniform float u_complexity;   // [0,1] scene complexity hint

varying vec2 vTexCoord;

// ───────────────────────────────────────────────────────────────
// Ray Marching Constants
// ───────────────────────────────────────────────────────────────
#define MAX_STEPS    120
#define MAX_DIST     80.0
#define SURFACE_DIST 0.0005

// ───────────────────────────────────────────────────────────────
// Scene Map — define your 3D world here.
//
// Returns vec2:
//   .x = shortest distance to any surface (the SDF value)
//   .y = material ID for the closest surface
//
// Edit this function to change the scene.
// ───────────────────────────────────────────────────────────────
vec2 sceneMap(vec3 p) {
    // --- Ground plane ---
    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.5);
    vec2 scene   = vec2(ground, 0.0); // mat 0 = ground

    // --- Animated central blob ---
    // Space twist driven by time
    vec3 q = twistY(p, sin(u_time * 0.4) * 0.5);

    // Core sphere
    float sphere = sdSphere(q, 0.9 + 0.1 * u_audioLow);

    // A box that gets carved in with smooth blending
    float box    = sdBox(q, vec3(0.7 + 0.05 * u_audioMid));

    // Smooth union — the "melting" organic effect
    float blob   = opSmoothUnion(sphere, box, 0.45 + 0.1 * u_audioHigh);

    // Add organic surface noise
    blob += displaceAmount(q * 1.5, u_time * 0.7) * 0.15;

    scene = opUnionMat(scene, vec2(blob, 1.0)); // mat 1 = blob

    // --- Floating torus, orbiting ---
    vec3 tp = p - vec3(2.2 * cos(u_time * 0.5), 0.2, 2.2 * sin(u_time * 0.5));
    float torus = sdTorus(tp, vec2(0.55, 0.18));
    scene = opUnionMat(scene, vec2(torus, 2.0)); // mat 2 = torus

    // --- Repeated mini-spheres in a grid ---
    vec3 rp  = repeatLimited(p, 3.5, vec3(3.0, 0.0, 3.0));
    float rs = sdSphere(rp - vec3(0.0, -0.8, 0.0), 0.25);
    scene = opUnionMat(scene, vec2(rs, 3.0)); // mat 3 = accent spheres

    return scene;
}

// ───────────────────────────────────────────────────────────────
// Camera setup — builds a 3×3 look-at matrix.
// ───────────────────────────────────────────────────────────────
mat3 calcCamera(vec3 ro, vec3 ta, vec3 worldUp) {
    vec3 cw = normalize(ta - ro);
    vec3 cu = normalize(cross(cw, worldUp));
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

// ───────────────────────────────────────────────────────────────
// Ray March — sphere tracing the scene.
// Returns vec2(.x = total distance marched, .y = material ID).
// ───────────────────────────────────────────────────────────────
vec2 rayMarch(vec3 ro, vec3 rd) {
    float dO  = 0.0; // distance Origin (total steps taken)
    float mat = -1.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3  p   = ro + rd * dO;
        vec2  res = sceneMap(p);
        float dS  = res.x; // distance to Scene

        if (dS < SURFACE_DIST) {
            mat = res.y;
            break;
        }
        dO += dS;
        if (dO > MAX_DIST) break;
    }
    return vec2(dO, mat);
}

// ───────────────────────────────────────────────────────────────
// Material colours — look up a base albedo from a material ID.
// ───────────────────────────────────────────────────────────────
vec3 matColor(float id, vec3 p, vec3 n) {
    if (id < 0.5) {
        // Ground: checkerboard with a small noise variation
        float check = mod(floor(p.x) + floor(p.z), 2.0);
        return mix(vec3(0.16, 0.14, 0.12), vec3(0.22, 0.20, 0.18), check)
               + 0.04 * noise(p * 2.0);
    } else if (id < 1.5) {
        // Blob: bioluminescent green with triplanar noise overlay
        vec3 base = paletteBioluminescent(triplanarSample(p, n, 1.2));
        return base * (0.8 + 0.2 * u_audioMid);
    } else if (id < 2.5) {
        // Torus: cyberpunk neon
        return paletteCyberpunk(fract(length(p) * 0.5 + u_time * 0.1));
    } else {
        // Accent spheres: sunset gradient by height
        return paletteSunset(p.y * 0.5 + 0.5);
    }
}

// ───────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────
void main() {
    // Normalised screen coordinates: (0,0) = centre, aspect-corrected.
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // ── Camera ──
    vec3 ro  = u_cameraPos;
    vec3 ta  = u_lookAt;
    mat3 cam = calcCamera(ro, ta, vec3(0, 1, 0));

    // Focal length controls field of view (1.5 ≈ 55°, 1.0 ≈ 90°)
    const float focalLength = 1.5;
    vec3 rd = cam * normalize(vec3(uv, focalLength));

    // ── March ──
    vec2 res = rayMarch(ro, rd);
    float dO  = res.x;
    float mat = res.y;

    // ── Shade ──
    vec3 col = vec3(0.0);

    if (mat >= 0.0 && dO < MAX_DIST) {
        vec3 p = ro + rd * dO;
        vec3 n = calcNormal(p);

        // Optional bump mapping for the blob surface
        if (mat > 0.5 && mat < 1.5) {
            n = bumpNormal(p, n, 2.0, 0.3);
        }

        vec3 lightPos   = vec3(4.0 * sin(u_time * 0.3), 5.0, 4.0 * cos(u_time * 0.3));
        vec3 lightColor = vec3(1.0, 0.95, 0.85);

        // Albedo from material table
        vec3 albedo = matColor(mat, p, n);

        // Physical lighting (diffuse + specular + AO + soft shadow)
        vec3 lighting = calcLighting(p, n, ro, rd, lightPos, lightColor);
        col = albedo * lighting;

        // Audio-reactive emissive glow on the blob
        if (mat > 0.5 && mat < 1.5) {
            col += albedo * u_audioLow * 0.6;
        }

        // Exponential fog
        vec3 fogColor = vec3(0.03, 0.04, 0.07);
        col = applyFog(col, dO, fogColor, 0.04);

    } else {
        // Background sky gradient
        vec3 skyTop = vec3(0.02, 0.02, 0.08);
        vec3 skyHor = vec3(0.06, 0.04, 0.12);
        col = mix(skyHor, skyTop, clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));

        // Star field
        float star = hash13(floor(rd * 400.0));
        col += step(0.993, star) * 0.8;
    }

    // ── Post-process ──
    col  = toneMapACES(col * 1.2);
    col  = gammaCorrect(col);
    col  = applyDither(col, gl_FragCoord.xy / u_resolution, 1.0 / 255.0);

    gl_FragColor = vec4(col, 1.0);
}
