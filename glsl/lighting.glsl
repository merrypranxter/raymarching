// lighting.glsl — Surface lighting for SDF scenes.
//
// Assumes sceneMap(vec3 p) is declared elsewhere and returns
// vec2(.x = distance, .y = material ID).
//
// Lighting model: Blinn-Phong with soft shadows and ambient occlusion.

// Forward declaration — sceneMap is defined in marcher.frag (appended after this file).
vec2 sceneMap(vec3 p);

// ------------------------------------------------------------
// Normal estimation via central differences (tetrahedron method).
// Gives a 4-sample estimate — faster than 6-sample.
// ------------------------------------------------------------
vec3 calcNormal(vec3 p) {
    const vec2 k = vec2(1, -1);
    const float eps = 0.0005;
    return normalize(
        k.xyy * sceneMap(p + k.xyy * eps).x +
        k.yyx * sceneMap(p + k.yyx * eps).x +
        k.yxy * sceneMap(p + k.yxy * eps).x +
        k.xxx * sceneMap(p + k.xxx * eps).x
    );
}

// ------------------------------------------------------------
// Ambient Occlusion — darkens crevices and folds.
//
// Samples the SDF along the surface normal at increasing distances.
// Where the scene "closes in" faster than expected, the point is occluded.
// ------------------------------------------------------------
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = sceneMap(p + n * h).x;
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// ------------------------------------------------------------
// Soft Shadows — penumbra based on how close the shadow ray passes
// to any surface on its way to the light.
//
// k  — "hardness": higher values give sharper shadow edges (8–64).
// ------------------------------------------------------------
float calcShadow(vec3 ro, vec3 rd, float tMin, float tMax, float k) {
    float res = 1.0;
    float t   = tMin;
    for (int i = 0; i < 32; i++) {
        float h = sceneMap(ro + rd * t).x;
        res = min(res, k * h / t);
        t  += clamp(h, 0.005, 0.2);
        if (res < 0.001 || t > tMax) break;
    }
    return clamp(res, 0.0, 1.0);
}

// ------------------------------------------------------------
// Blinn-Phong BRDF — returns a scalar light contribution [0, 1].
//
//   n         surface normal (normalised)
//   l         direction to light (normalised)
//   v         direction to camera (normalised)
//   shininess specular exponent (e.g. 32–256)
// ------------------------------------------------------------
float blinnPhong(vec3 n, vec3 l, vec3 v, float shininess) {
    float diff = max(dot(n, l), 0.0);
    vec3  h    = normalize(l + v);
    float spec = pow(max(dot(n, h), 0.0), shininess);
    return diff + spec;
}

// ------------------------------------------------------------
// Full lighting pass.
//
// Computes diffuse + specular + ambient + shadow + AO for a hit point.
// Call this after the ray marching loop finds a surface.
//
//   p     — hit position
//   n     — surface normal
//   ro    — ray origin (camera position)
//   rd    — ray direction
//   lightPos — world-space light position
//   lightColor — RGB light colour
// ------------------------------------------------------------
vec3 calcLighting(vec3 p, vec3 n, vec3 ro, vec3 rd,
                  vec3 lightPos, vec3 lightColor) {
    vec3  l    = normalize(lightPos - p);
    vec3  v    = -rd;
    float diff = max(dot(n, l), 0.0);
    float shad = calcShadow(p, l, 0.01, 20.0, 16.0);
    float ao   = calcAO(p, n);
    float spec = pow(max(dot(normalize(l + v), n), 0.0), 64.0);

    vec3 ambient  = vec3(0.04) * ao;
    vec3 diffuse  = lightColor * diff * shad;
    vec3 specular = lightColor * spec * shad * 0.3;

    // Simple sky/ground hemisphere fill
    float sky = 0.5 + 0.5 * n.y;
    vec3 hemi = mix(vec3(0.08, 0.04, 0.02), vec3(0.05, 0.08, 0.14), sky) * ao;

    return ambient + hemi + diffuse + specular;
}

// ------------------------------------------------------------
// Fresnel term (Schlick approximation).
// Controls edge-glow / reflectivity at grazing angles.
// ------------------------------------------------------------
float fresnel(vec3 n, vec3 v, float f0) {
    float cosTheta = clamp(1.0 - dot(n, v), 0.0, 1.0);
    return f0 + (1.0 - f0) * pow(cosTheta, 5.0);
}

// ------------------------------------------------------------
// Subsurface scattering approximation.
// Makes thin geometry (leaves, skin) glow from behind.
// ------------------------------------------------------------
float subsurface(vec3 p, vec3 n, vec3 l, float thickness) {
    float sss = max(0.0, dot(-n, l));
    sss *= exp(-thickness * 2.0);
    return sss;
}
