// base.vert — Standard fullscreen-quad vertex shader for p5.js WebGL.
// p5.js supplies aPosition (clip-space) and aTexCoord automatically.

precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  // p5.js provides positions in [0,1] on each axis; remap to clip space [-1,1].
  vec4 pos = vec4(aPosition, 1.0);
  pos.xy = pos.xy * 2.0 - 1.0;
  gl_Position = pos;
}
