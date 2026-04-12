// volumetrics.glsl — Atmospheric effects for SDF scenes.
//
// Adds "air" to a scene: exponential fog, light shafts (god rays),
// and participating media (simple single-scattering cloud volumes).

// ------------------------------------------------------------
// Exponential Fog
//
// Models the way light attenuates through a participating medium.
// The further away a surface is, the more it blends towards fogColor.
//
//   color    — the surface colour to be fogged
//   dist     — distance from camera to surface
//   fogColor — the colour of the atmosphere / sky
//   density  — fog thickness (0.02 = light haze, 0.2 = thick fog)
// ------------------------------------------------------------
vec3 applyFog(vec3 color, float dist, vec3 fogColor, float density) {
    float fogAmount = 1.0 - exp(-dist * density);
    return mix(color, fogColor, fogAmount);
}

// Height-based fog — denser near y = 0, fades out above yScale.
vec3 applyHeightFog(vec3 color, vec3 p, vec3 fogColor,
                    float density, float yScale) {
    float h = max(0.0, p.y + yScale);
    float fogAmount = 1.0 - exp(-density * exp(-h * 0.5));
    return mix(color, fogColor, fogAmount);
}

// ------------------------------------------------------------
// Light Shafts / God Rays
//
// Marches along the ray and accumulates scattered light from
// a point light source.  Gives a glow around lights in foggy air.
//
//   ro       — ray origin
//   rd       — ray direction (normalised)
//   lightPos — world-space light position
//   steps    — number of volumetric samples (8–32 is typical)
//   decay    — how quickly the scatter fades with distance (1–3)
// ------------------------------------------------------------
float getGodRay(vec3 ro, vec3 rd, vec3 lightPos,
                float maxDist, float steps, float decay) {
    float scatter = 0.0;
    float stepSize = maxDist / steps;
    float t = 0.0;
    for (float i = 0.0; i < 32.0; i++) {
        if (i >= steps) break;
        vec3  p = ro + rd * t;
        float dLight = length(p - lightPos);
        scatter += exp(-dLight * decay) * stepSize;
        t += stepSize;
    }
    return scatter / steps;
}

// ------------------------------------------------------------
// Volumetric Cloud (simple density field integration)
//
// Assumes noise(vec3) is declared in noise.glsl.
// Marches through a density field and accumulates opacity + colour.
//
//   ro, rd   — ray origin and direction
//   tMin/tMax — march bounds
//   cloudColor — RGB colour of the cloud
// ------------------------------------------------------------
vec4 marchCloud(vec3 ro, vec3 rd,
                float tMin, float tMax,
                vec3 cloudColor, float densityScale) {
    const int CLOUD_STEPS = 24;
    float stepSize = (tMax - tMin) / float(CLOUD_STEPS);
    float transmittance = 1.0;
    vec3  radiance      = vec3(0.0);

    for (int i = 0; i < CLOUD_STEPS; i++) {
        float t = tMin + (float(i) + 0.5) * stepSize;
        vec3  p = ro + rd * t;

        // Sample a noise density field (see noise.glsl)
        float density = max(0.0, noise(p * 0.8) - 0.3) * densityScale;
        if (density < 0.0001) continue;

        // Beer-Lambert law: transmittance decreases with accumulated density
        float dTrans = exp(-density * stepSize);
        vec3  dLight = cloudColor * density * transmittance;
        radiance     += dLight * stepSize;
        transmittance *= dTrans;

        if (transmittance < 0.01) break;
    }

    return vec4(radiance, 1.0 - transmittance);
}

// ------------------------------------------------------------
// Tone Mapping (ACES filmic approximation)
// Apply after all lighting/fog to convert HDR → display range.
// ------------------------------------------------------------
vec3 toneMapACES(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Simple Reinhard tone mapping.
vec3 toneMapReinhard(vec3 x) {
    return x / (1.0 + x);
}
