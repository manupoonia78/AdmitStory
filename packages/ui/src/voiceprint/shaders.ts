// GLSL for the live Voiceprint (spec §6.2): light filaments and particles inside a soft sphere.
// GLSL ES 1.00, so the same shaders run on WebGL 1 and 2. Every output is premultiplied alpha;
// the renderer picks additive blending (Night) or layering (Day).

const ROTATIONS = /* glsl */ `
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
`;

const SHARED_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform float uScale;     // unit space to clip space, before aspect correction
uniform vec2 uAspect;     // keeps the sphere round in a non-square canvas
uniform float uSwirl;     // accumulated swirl angle
uniform float uFlow;      // accumulated flow phase
uniform float uEnergy;    // particle energy from the voice
uniform float uSharp;     // 0 soft .. 1 sharp, from the spectral centroid
uniform float uBright;
uniform float uPointPx;   // base point size in device pixels
uniform float uMaxPoint;  // the GPU's point size limit
`;

export const FILAMENT_VERTEX = /* glsl */ `
precision highp float;
attribute float aT;
attribute vec4 aOrbit;    // turn, tilt, radius, phase
attribute vec2 aCenter;
attribute float aRand;
${SHARED_UNIFORMS}
varying float vAlpha;
varying float vHard;
${ROTATIONS}
void main() {
  float theta = aT * 6.2831853;
  float phase = aOrbit.w;
  // A slow standing wave along each thread, and a faster ripple while the voice is loud.
  float wobble = 0.035 * sin(3.0 * theta + uTime * 0.7 + phase)
               + uEnergy * 0.06 * sin(7.0 * theta - uTime * 3.1 + phase * 2.0);
  // Points scatter around the curve: wide and soft for a dull voice, tight for a bright one.
  float spread = mix(0.05, 0.012, uSharp) * (aRand - 0.5);
  float r = aOrbit.z * (1.0 + wobble) + spread;
  vec3 p = vec3(cos(theta) * r, sin(theta) * r, spread * 0.6 * sin(aRand * 40.0));
  float spin = uSwirl * (0.7 + 0.6 * fract(phase * 0.159));
  p = rotZ(aOrbit.x) * rotY(spin) * rotX(aOrbit.y) * p;
  gl_Position = vec4((p.xy + aCenter) * uScale * uAspect, 0.0, 1.0);

  // Packets of light travel along each thread; the near side of the sphere is brighter.
  float packet = pow(0.5 + 0.5 * sin(theta * 2.0 - uFlow * 6.2831853 + phase), 6.0);
  float depth = 0.55 + 0.45 * clamp(p.z / max(aOrbit.z, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  vAlpha = uBright * depth * (0.22 + 0.78 * packet) * (0.75 + 0.25 * aRand);
  vHard = uSharp;
  float size = uPointPx * (0.6 + 0.8 * aRand) * mix(1.35, 0.8, uSharp) * (0.85 + 0.5 * packet) * uScale;
  gl_PointSize = clamp(size, 1.0, uMaxPoint);
}
`;

export const PARTICLE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 aPosition;
attribute float aRand;
${SHARED_UNIFORMS}
varying float vAlpha;
varying float vHard;
${ROTATIONS}
void main() {
  vec3 p = rotY(uSwirl * 0.6 + uTime * 0.05 * (aRand - 0.5)) * aPosition;
  // The voice pushes particles outwards and makes them glow.
  p *= 1.0 + uEnergy * 0.28 * (0.5 + 0.5 * sin(uTime * 2.3 + aRand * 31.0));
  p.xy += 0.015 * vec2(sin(uTime * 0.9 + aRand * 17.0), cos(uTime * 0.7 + aRand * 23.0));
  gl_Position = vec4(p.xy * uScale * uAspect, 0.0, 1.0);
  float twinkle = 0.5 + 0.5 * sin(uTime * (1.0 + aRand * 2.0) + aRand * 50.0);
  float depth = 0.5 + 0.5 * clamp(p.z * 0.5 + 0.5, 0.0, 1.0);
  vAlpha = uBright * (0.14 + 0.55 * min(uEnergy, 1.2)) * twinkle * depth;
  vHard = 0.6;
  gl_PointSize = clamp(uPointPx * 0.7 * (0.5 + aRand) * (1.0 + uEnergy * 0.6) * uScale, 1.0, uMaxPoint);
}
`;

// mediump is plenty for colour, and some older mobile GPUs have no highp in fragment shaders.
// No uniform is declared in both stages, so the precisions never have to match.
export const POINT_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uDensity;   // light per point, so tiers with fewer points read as bright
uniform float uHalo;      // tier 3: a soft halo standing in for a bloom pass
uniform float uHot;       // Night: point cores burn towards white
varying float vAlpha;
varying float vHard;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c) * 4.0;
  if (d2 > 1.0) discard;
  float core = exp(-d2 * mix(5.0, 12.0, vHard));
  float halo = uHalo * 0.22 * exp(-d2 * 2.2) * (1.0 - d2);
  float a = (core + halo) * vAlpha * uDensity;
  vec3 color = mix(uColor, vec3(1.0), uHot * core * 0.35);
  gl_FragColor = vec4(color * a, a);
}
`;

export const VOLUME_VERTEX = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const VOLUME_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform vec2 uAspect;
uniform vec2 uOffset;
uniform float uScale;
uniform float uBright;
uniform float uEnergy;
uniform float uStrength;  // lower when layered on Day, where it would read as a stain
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) / uAspect / uScale - uOffset;
  float r = length(p);
  // A soft body of light, and a faint shell where the sphere's edge would be.
  float body = exp(-r * r * 2.6) * 0.16;
  float shell = smoothstep(0.98, 0.84, r) * smoothstep(0.55, 0.92, r) * 0.05;
  float a = (body + shell) * uBright * (0.8 + min(uEnergy, 1.2) * 0.6) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}
`;
