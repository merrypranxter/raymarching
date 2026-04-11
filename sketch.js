let RM;

function preload() {
  RM = new RayMarchBridge({
    vertPath: 'glsl/base.vert',
    fragMainPath: 'glsl/marcher.frag',
    includes: [
      'glsl/primitives.glsl',
      'glsl/operations.glsl',
      'glsl/manifolds.glsl',
      'glsl/noise.glsl',
      'glsl/lighting.glsl',
      'glsl/volumetrics.glsl',
      'glsl/dithering.glsl'
    ]
  });
  RM.preload();
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  RM.setup();
}

function draw() {
  RM.draw({
    time: millis() / 1000,
    cameraPos: [0, 0, -5],
    lookAt: [0, 0, 0]
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}