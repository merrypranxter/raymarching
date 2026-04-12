// sketch.js — Entry point for the Ray Marching Vibe Engine.
//
// Architecture:
//   RayMarchBridge  — loads & compiles GLSL shaders
//   CameraController — mouse/touch orbit camera
//   AudioBridge      — (optional) microphone / file FFT analysis
//   VibeEngine       — declarative scene configuration from config files

let RM;     // RayMarchBridge
let cam;    // CameraController
let audio;  // AudioBridge
let engine; // VibeEngine

function preload() {
  RM = new RayMarchBridge({
    vertPath:     'glsl/base.vert',
    fragMainPath: 'glsl/marcher.frag',
    // These files are prepended to the fragment shader in order.
    // Each file's functions become available to the files that follow it.
    includes: [
      'glsl/primitives.glsl',   // SDF primitives (sphere, box, torus…)
      'glsl/operations.glsl',   // Boolean ops + smooth blending
      'glsl/manifolds.glsl',    // Space repeat, twist, rotate
      'glsl/noise.glsl',        // Hash, value noise, FBM
      'glsl/lighting.glsl',     // Normal estimation, AO, soft shadows
      'glsl/volumetrics.glsl',  // Fog, god rays, tone mapping
      'glsl/dithering.glsl',    // Blue-noise dither, gamma correction
      'glsl/texturing.glsl',    // Triplanar mapping, cosine palettes
    ]
  });
  RM.preload();
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  // Compile the ray marching shader
  RM.setup();

  // Orbit camera — drag to rotate, scroll to zoom
  cam = new CameraController({
    target:    [0, 0, 0],
    distance:  5,
    azimuth:   0.4,
    elevation: 0.25,
  });
  cam.attachTo(document.querySelector('canvas'));

  // Audio bridge (initialised on first user gesture to satisfy browser policy)
  audio = new AudioBridge({ smoothing: 0.85 });

  // Vibe engine — loads palettes + seeds from config files
  engine = new VibeEngine(RM);
  engine.loadAssets('config/palettes.json', 'config/seeds.csv')
        .then(() => engine.jackIn()); // pick a random seed on load
}

function draw() {
  // Update audio analysis (no-op if mic not yet active)
  audio.update();
  engine.update(millis() / 1000);

  // Slowly auto-rotate when the user isn't dragging
  if (!mouseIsPressed) cam.autoRotate(0.001);

  RM.draw({
    time:       millis() / 1000,
    cameraPos:  cam.position,
    lookAt:     cam.target,
    audioLow:   audio.low,
    audioMid:   audio.mid,
    audioHigh:  audio.high,
    ...engine.uniforms,
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Press M to toggle microphone (requires user gesture)
function keyPressed() {
  if (key === 'm' || key === 'M') {
    if (!audio.enabled) {
      audio.initMic();
    }
  }
  // Press SPACE to randomise the scene vibe
  if (key === ' ') {
    engine.jackIn();
  }
}