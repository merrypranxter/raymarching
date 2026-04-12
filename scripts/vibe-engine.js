// vibe-engine.js — Declarative scene controller for the Ray March engine.
//
// The VibeEngine reads palettes.json and seeds.csv to automatically
// configure the shader uniforms — no manual tweaking required.
// Your AI can call engine.jackIn() to hot-swap the entire scene "vibe."
//
// Usage:
//   const engine = new VibeEngine(RM);
//   engine.loadAssets('config/palettes.json', 'config/seeds.csv')
//         .then(() => engine.jackIn());
//   // in draw():
//   engine.update(millis() / 1000);
//   RM.draw(engine.uniforms);

class VibeEngine {
  constructor(bridge) {
    this.bridge      = bridge;
    this.palettes    = [];
    this.seeds       = [];
    this.currentSeed = null;
    this.currentPal  = null;
    this._loaded     = false;
    // Smoothed uniform values (prevent jarring jumps)
    this._complexity = 0.5;
  }

  // ─────────────────────────────────────────────────────────────
  // loadAssets(palettePath, seedsPath) — fetch config files.
  // Returns a Promise that resolves when both files are ready.
  // ─────────────────────────────────────────────────────────────
  async loadAssets(palettePath = 'config/palettes.json',
                   seedsPath   = 'config/seeds.csv') {
    try {
      const [palText, seedText] = await Promise.all([
        fetch(palettePath).then(r => r.ok ? r.json() : Promise.resolve({ palettes: [] })),
        fetch(seedsPath)  .then(r => r.ok ? r.text() : Promise.resolve(''))
      ]);

      this.palettes = palText.palettes || [];
      this.seeds    = VibeEngine._parseCSV(seedText);
      this._loaded  = true;
      console.log(`[VibeEngine] Loaded ${this.palettes.length} palettes, ${this.seeds.length} seeds.`);
    } catch (e) {
      console.warn('[VibeEngine] Could not load assets:', e);
      this._loaded = true; // degrade gracefully
    }
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // jackIn(seedName?) — select a seed (random if not specified).
  // Immediately applies the seed's settings to the bridge uniforms.
  // ─────────────────────────────────────────────────────────────
  jackIn(seedName) {
    if (this.seeds.length > 0) {
      if (seedName) {
        this.currentSeed = this.seeds.find(s => s.seed_name === seedName)
                        || this._randomSeed();
      } else {
        this.currentSeed = this._randomSeed();
      }
    }

    if (this.palettes.length > 0) {
      const palId = this.currentSeed
        ? parseInt(this.currentSeed.palette_id, 10) - 1
        : 0;
      this.currentPal = this.palettes[palId % this.palettes.length];
    }

    if (this.currentSeed) {
      console.log(`[VibeEngine] Jacked in: ${this.currentSeed.seed_name}`);
      this._complexity = parseFloat(this.currentSeed.complexity) || 0.5;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // update(t) — call every frame.  Smoothly interpolates values.
  // ─────────────────────────────────────────────────────────────
  update(t) {
    // Nothing yet — extend here for beat-synced transitions
  }

  // ─────────────────────────────────────────────────────────────
  // uniforms — a plain object ready to pass to RM.draw().
  // ─────────────────────────────────────────────────────────────
  get uniforms() {
    return { complexity: this._complexity };
  }

  // Return the manifold mode as an integer for the shader.
  get manifoldID() {
    const modes = { tiled: 0, twisted: 1, mirrored: 2, infinite: 3 };
    if (!this.currentSeed) return 0;
    return modes[this.currentSeed.manifold_mode] || 0;
  }

  // ─── Internals ───────────────────────────────────────────────
  _randomSeed() {
    return this.seeds[Math.floor(Math.random() * this.seeds.length)];
  }

  static _parseCSV(text) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  }
}

window.VibeEngine = VibeEngine;
