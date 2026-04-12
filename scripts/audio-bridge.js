// audio-bridge.js — Connects p5.Sound's FFT analyser to shader uniforms.
//
// Extracts bass / mid / treble energy from a live microphone or audio file
// and passes them to RayMarchBridge as u_audioLow, u_audioMid, u_audioHigh.
//
// Requires p5.sound library (p5.sound.min.js) loaded before this file.
//
// Usage:
//   const audio = new AudioBridge();
//   // in p5 setup():  audio.initMic();
//   // in p5 draw():
//   RM.draw({ audioLow: audio.low, audioMid: audio.mid, audioHigh: audio.high });

class AudioBridge {
  constructor(options = {}) {
    this.smoothing = options.smoothing || 0.8; // FFT smoothing [0,1]
    this.mic       = null;
    this.fft       = null;
    this.amplitude = null;
    this.source    = null;  // active p5.Sound source
    this.low       = 0;
    this.mid       = 0;
    this.high      = 0;
    this.level     = 0;     // overall amplitude
    this._enabled  = false;
  }

  // ─────────────────────────────────────────────────────────────
  // initMic() — request microphone access and start analysing.
  // Must be called from a user gesture (button click) in most browsers.
  // ─────────────────────────────────────────────────────────────
  initMic() {
    if (typeof p5 === 'undefined' || typeof p5.AudioIn === 'undefined') {
      console.warn('[AudioBridge] p5.sound not loaded — audio reactive features disabled.');
      return;
    }
    this.mic = new p5.AudioIn();
    this.mic.start(() => {
      this.fft = new p5.FFT(this.smoothing, 1024);
      this.fft.setInput(this.mic);
      this.amplitude = new p5.Amplitude(this.smoothing);
      this.amplitude.setInput(this.mic);
      this._enabled = true;
      console.log('[AudioBridge] Microphone active.');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // loadFile(path) — load and loop an audio file as the source.
  // ─────────────────────────────────────────────────────────────
  loadFile(path, onReady) {
    if (typeof loadSound === 'undefined') {
      console.warn('[AudioBridge] p5.sound not loaded.');
      return;
    }
    this.source = loadSound(path, (snd) => {
      snd.loop();
      this.fft = new p5.FFT(this.smoothing, 1024);
      this.fft.setInput(snd);
      this.amplitude = new p5.Amplitude(this.smoothing);
      this.amplitude.setInput(snd);
      this._enabled = true;
      if (onReady) onReady(snd);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // update() — call every frame in draw() to refresh the energy values.
  // ─────────────────────────────────────────────────────────────
  update() {
    if (!this._enabled || !this.fft) return;
    this.fft.analyze();
    this.low   = this.fft.getEnergy('bass')   / 255.0;
    this.mid   = this.fft.getEnergy('mid')    / 255.0;
    this.high  = this.fft.getEnergy('treble') / 255.0;
    if (this.amplitude) this.level = this.amplitude.getLevel();
  }

  // Apply all audio uniforms to a RayMarchBridge instance.
  applyUniforms(bridge) {
    if (!bridge || !bridge.isReady) return;
    bridge.setUniform('u_audioLow',  this.low);
    bridge.setUniform('u_audioMid',  this.mid);
    bridge.setUniform('u_audioHigh', this.high);
  }

  // True once the FFT analyser is active.
  get enabled() { return this._enabled; }
}

window.AudioBridge = AudioBridge;
