// camera-control.js — Interactive orbit camera for ray marching sketches.
//
// Provides a CameraController class that translates mouse / touch input
// into a camera position and look-at point suitable for passing to
// RayMarchBridge.draw({ cameraPos, lookAt }).
//
// Usage:
//   const cam = new CameraController({ distance: 5, target: [0, 0, 0] });
//   // in p5 draw():
//   RM.draw({ cameraPos: cam.position, lookAt: cam.target, ... });

class CameraController {
  constructor(options = {}) {
    this.target   = options.target   || [0, 0, 0];
    this.distance = options.distance || 5;
    this.minDist  = options.minDist  || 1.0;
    this.maxDist  = options.maxDist  || 50.0;
    this.azimuth  = options.azimuth  || 0;        // horizontal angle (radians)
    this.elevation= options.elevation|| 0.3;      // vertical angle   (radians)
    this.minElev  = options.minElev  || -Math.PI / 2 + 0.05;
    this.maxElev  = options.maxElev  ||  Math.PI / 2 - 0.05;
    this.sensitivity = options.sensitivity || 0.005;
    this.zoomSpeed   = options.zoomSpeed   || 0.002;
    this._dragging   = false;
    this._lastX      = 0;
    this._lastY      = 0;

    // Auto-bind for use as event handlers
    this._onMouseDown  = this._onMouseDown.bind(this);
    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onMouseUp    = this._onMouseUp.bind(this);
    this._onWheel      = this._onWheel.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove  = this._onTouchMove.bind(this);
  }

  // Attach event listeners to the canvas element.
  attachTo(canvasEl) {
    canvasEl.addEventListener('mousedown',  this._onMouseDown);
    canvasEl.addEventListener('mousemove',  this._onMouseMove);
    canvasEl.addEventListener('mouseup',    this._onMouseUp);
    canvasEl.addEventListener('wheel',      this._onWheel, { passive: true });
    canvasEl.addEventListener('touchstart', this._onTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove',  this._onTouchMove,  { passive: true });
  }

  _onMouseDown(e) {
    this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.azimuth   -= dx * this.sensitivity;
    this.elevation += dy * this.sensitivity;
    this.elevation  = Math.max(this.minElev, Math.min(this.maxElev, this.elevation));
  }

  _onMouseUp() { this._dragging = false; }

  _onWheel(e) {
    this.distance += e.deltaY * this.zoomSpeed * this.distance;
    this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance));
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._dragging = true;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
    }
  }

  _onTouchMove(e) {
    if (!this._dragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - this._lastX;
    const dy = e.touches[0].clientY - this._lastY;
    this._lastX = e.touches[0].clientX;
    this._lastY = e.touches[0].clientY;
    this.azimuth   -= dx * this.sensitivity;
    this.elevation += dy * this.sensitivity;
    this.elevation  = Math.max(this.minElev, Math.min(this.maxElev, this.elevation));
  }

  // Compute current camera position from spherical coordinates.
  get position() {
    const cosEl = Math.cos(this.elevation);
    const sinEl = Math.sin(this.elevation);
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);
    return [
      this.target[0] + this.distance * cosEl * sinAz,
      this.target[1] + this.distance * sinEl,
      this.target[2] + this.distance * cosEl * cosAz
    ];
  }

  // Convenience: auto-rotate the camera (call each frame for animation).
  autoRotate(speed = 0.001) {
    this.azimuth += speed;
  }
}

window.CameraController = CameraController;
