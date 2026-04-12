// js5-bridge.js — RayMarchBridge: connects p5.js to a GLSL ray marching engine.
//
// Usage:
//   const RM = new RayMarchBridge({ vertPath, fragMainPath, includes });
//   // inside p5 preload():  RM.preload();
//   // inside p5 setup():    RM.setup();
//   // inside p5 draw():     RM.draw({ time, cameraPos, lookAt, ... });
//
// The bridge loads all include files, concatenates them in order, appends
// the main fragment shader, resolves any remaining #include directives
// via GLSLPreprocess, then compiles a WebGL shader program.

class RayMarchBridge {
  constructor(options = {}) {
    this.vertPath     = options.vertPath     || 'glsl/base.vert';
    this.fragMainPath = options.fragMainPath || 'glsl/marcher.frag';
    this.includes     = options.includes     || [];
    this.shader       = null;
    this._vertSrc     = '';
    this._fragSrc     = '';
    this._ready       = false;
    this._error       = null;
  }

  // ─────────────────────────────────────────────────────────────
  // preload() — call inside p5's preload() function.
  // Fetches and preprocesses all GLSL source files asynchronously.
  // ─────────────────────────────────────────────────────────────
  preload() {
    // p5.js preload() tracks outstanding async work via loadXxx helpers.
    // We hook in via loadStrings / registerPromisePreload pattern:
    // Since p5 v1.x doesn't expose a direct promise preload API, we
    // use a flag + a manual wait in setup() as a safe fallback.
    this._loadPromise = this._loadAll();
  }

  async _loadAll() {
    try {
      const cache = new Map();
      const preprocess = window.GLSLPreprocess
        ? window.GLSLPreprocess.preprocessGLSL
        : (src) => Promise.resolve(src);

      // 1. Load vertex shader
      this._vertSrc = await GLSLPreprocess.fetchText(this.vertPath);

      // 2. Load each include file
      const includeSources = await Promise.all(
        this.includes.map(p => GLSLPreprocess.fetchText(p))
      );

      // 3. Load main fragment shader body
      const fragMain = await GLSLPreprocess.fetchText(this.fragMainPath);

      // 4. Concatenate: preamble + includes + main
      const precision = 'precision highp float;\n';
      const combined  = precision + includeSources.join('\n') + '\n' + fragMain;

      // 5. Resolve any remaining #include directives
      this._fragSrc = await preprocess(combined, { basePath: 'glsl' });

      this._ready = true;
    } catch (e) {
      this._error = e;
      console.error('[RayMarchBridge] Failed to load shaders:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // setup() — call inside p5's setup() (after createCanvas WEBGL).
  // Waits for shader source to be ready, then compiles it.
  // ─────────────────────────────────────────────────────────────
  setup() {
    if (this._error) {
      console.error('[RayMarchBridge] Cannot setup — shader load failed.');
      return;
    }
    // Defer compilation until source is ready.
    if (!this._ready) {
      this._loadPromise.then(() => this._compile()).catch(e => {
        this._error = e;
        console.error('[RayMarchBridge] Shader compile error:', e);
      });
    } else {
      this._compile();
    }
  }

  _compile() {
    if (!this._vertSrc || !this._fragSrc) {
      console.error('[RayMarchBridge] Missing shader source at compile time.');
      return;
    }
    try {
      this.shader = createShader(this._vertSrc, this._fragSrc);
      console.log('[RayMarchBridge] Shader compiled successfully.');
    } catch (e) {
      this._error = e;
      console.error('[RayMarchBridge] createShader() failed:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // draw(uniforms) — call every frame inside p5's draw().
  //
  // uniforms object (all optional, sensible defaults provided):
  //   time       {number}   seconds since start
  //   cameraPos  {number[3]}  camera position
  //   lookAt     {number[3]}  look-at target
  //   audioLow   {number}   bass energy   [0,1]
  //   audioMid   {number}   mid energy    [0,1]
  //   audioHigh  {number}   treble energy [0,1]
  //   complexity {number}   scene complexity [0,1]
  //   extra      {object}   key→value pairs of additional uniforms
  // ─────────────────────────────────────────────────────────────
  draw(uniforms = {}) {
    if (!this.shader) {
      // Still loading — draw a black frame
      background(0);
      return;
    }

    const {
      time       = 0,
      cameraPos  = [0, 0, -5],
      lookAt     = [0, 0, 0],
      audioLow   = 0,
      audioMid   = 0,
      audioHigh  = 0,
      complexity = 0.5,
      extra      = {}
    } = uniforms;

    shader(this.shader);

    // Core uniforms
    this.shader.setUniform('u_resolution',  [width, height]);
    this.shader.setUniform('u_time',        time);
    this.shader.setUniform('u_cameraPos',   cameraPos);
    this.shader.setUniform('u_lookAt',      lookAt);
    this.shader.setUniform('u_audioLow',    audioLow);
    this.shader.setUniform('u_audioMid',    audioMid);
    this.shader.setUniform('u_audioHigh',   audioHigh);
    this.shader.setUniform('u_complexity',  complexity);

    // Pass any additional uniforms from the caller
    for (const [key, val] of Object.entries(extra)) {
      this.shader.setUniform(key, val);
    }

    // Draw a fullscreen rectangle — the fragment shader paints every pixel.
    rect(0, 0, width, height);
  }

  // ─────────────────────────────────────────────────────────────
  // Utility: inject a live uniform without going through draw().
  // Useful for one-off updates (e.g. from a GUI slider).
  // ─────────────────────────────────────────────────────────────
  setUniform(name, value) {
    if (this.shader) {
      shader(this.shader);
      this.shader.setUniform(name, value);
    }
  }

  // Returns true once the shader is compiled and ready to render.
  get isReady() {
    return !!this.shader;
  }
}

window.RayMarchBridge = RayMarchBridge;
