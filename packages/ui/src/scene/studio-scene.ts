// The studio: one raymarched WebGL2 scene behind every signed-in and first-run page. Glass and
// chrome objects in a lit studio (softbox reflections, dispersion, thin-film iridescence, bloom),
// one object per area of the app, morphing into the next when the route changes.
//
// Loaded on idle by scene-host.tsx, so none of this is in any route's first-load JS. Raw WebGL2
// (no three.js / ogl) keeps it to a few KB. The ray only marches inside a bounding sphere around
// the object; every other pixel costs one ray-sphere test.

import { SCENES, type SceneId } from "./scene-ids";

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScroll;
uniform float uDay;
uniform vec3 uHueA;
uniform vec3 uHueB;
uniform int uA;
uniform int uB;
uniform float uMix;
uniform vec3 uFrame; // object centre x, y in viewport fractions; scale
out vec4 o;

#define PI 3.14159265

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCapsule(vec3 p, float h, float r) { p.y -= clamp(p.y, -h, h); return length(p) - r; }

// Each scene returns (distance, material): material 0 is glass, 1 is chrome.
vec2 pick(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

vec2 scene(int id, vec3 p, float t) {
  if (id == 1) { // voice: a glass equaliser
    vec2 r = vec2(1e5, 0.0);
    p.xz *= rot(0.35);
    for (int i = 0; i < 7; i++) {
      float fi = float(i) - 3.0;
      float h = 0.18 + 0.55 * (0.5 + 0.5 * sin(t * 1.6 + fi * 0.9)) * (1.0 - abs(fi) / 4.5);
      r = pick(r, vec2(sdCapsule(p - vec3(fi * 0.36, 0.0, 0.0), h, 0.13), 0.0));
    }
    float ring = sdTorus((p - vec3(0.0, -0.95, 0.0)), vec2(1.45, 0.035));
    return pick(r, vec2(ring, 1.0));
  }
  if (id == 2) { // stack: tilted slabs, a shelf of schools
    vec2 r = vec2(1e5, 0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec3 q = p - vec3(0.0, fi * 0.42 - 0.62, 0.0);
      q.xz *= rot(t * 0.25 + fi * 0.5);
      q.xy *= rot(0.08 * sin(t + fi));
      r = pick(r, vec2(sdBox(q, vec3(0.95 - fi * 0.12, 0.13, 0.62 - fi * 0.06), 0.1), mod(fi, 2.0)));
    }
    return r;
  }
  if (id == 3) { // cards: a fanned deck of glass, the dossier, on a chrome spindle
    vec2 r = vec2(sdCapsule(p.xzy, 0.32, 0.06), 1.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i) - 1.5;
      vec3 q = p;
      q.xy *= rot(fi * 0.32 + 0.12 * sin(t * 0.6));
      q -= vec3(0.0, 0.55, fi * 0.2);
      q.xy *= rot(-0.06 * fi);
      r = pick(r, vec2(sdBox(q, vec3(0.6, 0.85, 0.035), 0.06), 0.0));
    }
    return r;
  }
  if (id == 4) { // twist: a turned glass bar with a chrome core, the kit
    vec3 q = p;
    q.xz *= rot(q.y * 1.4 + t * 0.4);
    float bar = sdBox(q, vec3(0.5, 1.15, 0.5), 0.18);
    float core = length(p) - 0.36;
    return pick(vec2(bar, 0.0), vec2(core, 1.0));
  }
  if (id == 5) { // trio: three spheres melting together, the people around you
    float d = 1e5;
    for (int i = 0; i < 3; i++) {
      float a = t * 0.5 + float(i) * 2.094;
      d = smin(d, length(p - vec3(cos(a) * 0.62, sin(a * 1.3) * 0.25, sin(a) * 0.62)) - 0.52, 0.35);
    }
    float halo = sdTorus(p, vec2(1.35, 0.03));
    return pick(vec2(d, 0.0), vec2(halo, 1.0));
  }
  if (id == 6) { // pill: a microphone capsule inside a chrome ring
    vec3 q = p;
    q.xy *= rot(0.25);
    float pill = sdCapsule(q, 0.55, 0.5);
    vec3 rq = p;
    rq.yz *= rot(PI * 0.5 + 0.3 * sin(t * 0.5));
    rq.xy *= rot(t * 0.3);
    float ring = sdTorus(rq, vec2(1.05, 0.06));
    return pick(vec2(pill, 0.0), vec2(ring, 1.0));
  }
  if (id == 7) { // portal: a sphere held in a glass torus, the way in
    vec3 q = p;
    q.yz *= rot(1.1 + 0.15 * sin(t * 0.4));
    q.xz *= rot(t * 0.2);
    float ring = sdTorus(q, vec2(1.0, 0.24));
    float ball = length(p - vec3(0.0, 0.05 * sin(t), 0.0)) - 0.48;
    return pick(vec2(ring, 0.0), vec2(ball, 1.0));
  }
  if (id == 8) { // cog: a fluted ring, settings
    vec3 q = p;
    q.yz *= rot(1.15);
    q.xz *= rot(t * 0.25);
    float a = atan(q.z, q.x);
    float r = 0.95 + 0.07 * smoothstep(-0.3, 0.3, sin(a * 10.0));
    vec2 w = vec2(length(q.xz) - r, q.y);
    float cog = length(max(abs(w) - vec2(0.18, 0.16), 0.0)) - 0.06;
    float hub = length(p) - 0.32;
    return pick(vec2(cog, 1.0), vec2(hub, 0.0));
  }
  // 0, orb: a glass sphere crossed by two chrome orbits, the story's core
  vec3 q1 = p; q1.yz *= rot(1.2); q1.xy *= rot(t * 0.35);
  vec3 q2 = p; q2.xy *= rot(-0.9); q2.yz *= rot(1.4 + t * 0.28);
  float orb = length(p) - 0.78;
  float r1 = sdTorus(q1, vec2(1.18, 0.045));
  float r2 = sdTorus(q2, vec2(1.38, 0.03));
  return pick(vec2(orb, 0.0), vec2(min(r1, r2), 1.0));
}

vec3 tilt(vec3 p) {
  p.xz *= rot(uPointer.x * 0.35 + uScroll * 0.9);
  p.yz *= rot(-uPointer.y * 0.2 + uScroll * 0.3);
  return p;
}

vec2 map(vec3 p) {
  p = tilt(p);
  float t = uTime;
  vec2 a = scene(uA, p, t);
  if (uMix >= 1.0) return a;
  vec2 b = scene(uB, p, t);
  float e = uMix * uMix * (3.0 - 2.0 * uMix);
  // Shrink-through morph: both shapes stay valid distance fields while they cross-fade.
  return vec2(mix(a.x, b.x, e), e < 0.5 ? a.y : b.y);
}

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0) * 0.0015;
  return normalize(k.xyy * map(p + k.xyy).x + k.yyx * map(p + k.yyx).x +
                   k.yxy * map(p + k.yxy).x + k.xxx * map(p + k.xxx).x);
}

// The studio the objects reflect: a graded cyclorama, a big key softbox, a strip light and a
// coloured rim, so chrome and glass pick up the hard-edged highlights of a real render.
float softbox(vec3 d, vec3 c, vec2 size, float soft) {
  vec3 up = abs(c.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 u = normalize(cross(up, c));
  vec3 v = cross(c, u);
  float facing = dot(d, c);
  if (facing <= 0.0) return 0.0;
  vec2 q = vec2(dot(d, u), dot(d, v)) / facing;
  vec2 e = smoothstep(size, size - soft, abs(q));
  return e.x * e.y;
}

vec3 env(vec3 d) {
  vec3 night = mix(vec3(0.01, 0.012, 0.04), vec3(0.07, 0.08, 0.2), smoothstep(-0.5, 0.9, d.y));
  vec3 day = mix(vec3(0.52, 0.55, 0.7), vec3(0.98, 0.98, 1.0), smoothstep(-0.5, 0.9, d.y));
  vec3 c = mix(night, day, uDay);
  // Horizon band and overhead dome: the long gradients chrome needs to read as metal.
  c += mix(vec3(0.5, 0.56, 0.9), vec3(0.9), uDay) * exp(-abs(d.y + 0.04) * 9.0) * mix(0.55, 0.3, uDay);
  c += smoothstep(0.55, 1.0, d.y) * mix(0.9, 0.5, uDay);
  // Key softbox, front left, and two coloured strip lights.
  vec3 keyDir = normalize(vec3(-0.6 + uPointer.x * 0.3, 0.6, 0.6));
  c += softbox(d, keyDir, vec2(0.4, 0.24), 0.14) * mix(2.6, 1.8, uDay);
  c += softbox(d, normalize(vec3(0.8, 0.2, 0.35)), vec2(0.05, 0.8), 0.03) * mix(2.2, 1.4, uDay) * uHueA;
  c += softbox(d, normalize(vec3(-0.85, -0.05, -0.3)), vec2(0.06, 0.7), 0.04) * mix(1.8, 1.1, uDay) * uHueB;
  // The wall behind the camera, which chrome facing us reflects: a soft graded fill and a wide
  // overhead softbox, so metal shows long highlights instead of black.
  float front = smoothstep(0.0, 0.9, d.z);
  c += front * mix(vec3(0.2, 0.24, 0.5), vec3(0.38, 0.39, 0.5), uDay) * (0.4 + 0.6 * smoothstep(-0.4, 0.7, d.y));
  c += softbox(d, normalize(vec3(0.45, 0.5, 0.75)), vec2(0.55, 0.16), 0.22) * mix(1.6, 1.0, uDay);
  // The backdrop behind the object, which glass refracts: a striped wash in the two hues, so the
  // glass glows with colour and visibly bends what is behind it.
  float back = smoothstep(0.0, 1.0, -d.z);
  vec3 wash = mix(uHueA, uHueB, smoothstep(-0.8, 0.8, d.x + d.y * 0.5));
  float stripes = 0.18 + 0.82 * smoothstep(0.6, 0.95, 0.5 + 0.5 * sin(d.x * 7.0 + d.y * 2.0 + 0.6));
  c += wash * back * stripes * mix(1.3, 0.95, uDay);
  return c;
}

vec3 film(float x) {
  return 0.5 + 0.5 * cos(2.0 * PI * (x + vec3(0.0, 0.33, 0.67)));
}

vec3 shade(vec3 p, vec3 rd, float mat) {
  vec3 n = normalAt(p);
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 refl = env(reflect(rd, n));
  if (mat > 0.5) {
    // Holographic chrome: a thin-film tint that shifts with the viewing angle.
    vec3 tint = mix(vec3(0.9, 0.93, 1.0), vec3(0.8, 0.82, 0.92), uDay);
    tint = mix(tint, film(cosi * 0.9 + n.y * 0.25 + 0.55), 0.35);
    return refl * tint * (0.85 + 0.25 * fres);
  }
  // Glass: dispersion (one refracted lookup per channel), a thin-film sheen on the reflection,
  // and a little absorption where the glass is thick (grazing rays travel further through it).
  vec3 refr = vec3(
    env(refract(rd, n, 1.0 / 1.42)).r,
    env(refract(rd, n, 1.0 / 1.46)).g,
    env(refract(rd, n, 1.0 / 1.51)).b);
  vec3 absorb = mix(mix(uHueA, vec3(1.0), 0.4), vec3(1.0), cosi * 0.5);
  vec3 sheen = mix(vec3(1.0), film(cosi * 1.6 + uTime * 0.04), 0.55);
  return refr * absorb * mix(0.8, 0.92, uDay) + refl * sheen * (fres * 1.6 + 0.04);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 centre = vec2(uFrame.x, 1.0 - uFrame.y + uScroll * 0.55) * uRes;
  vec2 uv = (frag - centre) / (uRes.y * uFrame.z) * 2.6;

  vec3 ro = vec3(0.0, 0.0, 5.0);
  vec3 rd = normalize(vec3(uv, -2.1));

  // Bounding sphere (radius 1.75): most of the screen exits here.
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.75 * 1.75;
  float h = b * b - c;
  float closest = length(ro - rd * b);
  vec3 halo = mix(uHueA, uHueB, 0.35) * exp(-max(closest - 0.9, 0.0) * 2.2) * mix(0.16, 0.08, uDay);

  vec4 col = vec4(halo, length(halo));
  if (h > 0.0) {
    float tt = -b - sqrt(h);
    float tEnd = -b + sqrt(h);
    float minD = 1e5;
    for (int i = 0; i < 110; i++) {
      vec2 r = map(ro + rd * tt);
      minD = min(minD, r.x);
      if (r.x < 0.0009 * tt) {
        vec3 rgb = shade(ro + rd * tt, rd, r.y);
        // Filmic shoulder so the softbox highlights roll off like a render, not clip.
        rgb = 1.0 - exp(-rgb * mix(1.7, 1.2, uDay));
        col = vec4(rgb, 1.0);
        break;
      }
      tt += r.x * 0.8;
      if (tt > tEnd) break;
    }
    if (col.a < 1.0) {
      vec3 bloom = mix(uHueA, vec3(1.0), 0.3) * exp(-minD * 14.0) * mix(0.3, 0.14, uDay);
      col.rgb += bloom;
      col.a = clamp(max(col.a, length(col.rgb)), 0.0, 1.0);
    }
  }
  // Premultiplied, so the page background shows through everywhere the studio is empty.
  o = vec4(col.rgb, col.a);
}`;

export interface SceneFrame {
  /** Object centre as fractions of the viewport (0..1 from the left, 0..1 from the top). */
  x: number;
  y: number;
  /** Object size; 1 is about 40% of the viewport height. */
  scale: number;
}

export interface StudioOptions {
  scene: SceneId;
  frame: SceneFrame;
  day: boolean;
  hues: [string, string];
  still: boolean;
  onFirstFrame: () => void;
}

export interface Studio {
  setScene(scene: SceneId, frame: SceneFrame): void;
  setTheme(day: boolean, hues: [string, string]): void;
  destroy(): void;
}

function rgb(color: string): [number, number, number] {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return [0.6, 0.7, 1];
  probe.fillStyle = color;
  const hex = probe.fillStyle; // normalised to #rrggbb (or rgba() when translucent)
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return [0.6, 0.7, 1];
  const [r = "99", g = "b1", b = "ff"] = m.slice(1);
  return [parseInt(r, 16) / 255, parseInt(g, 16) / 255, parseInt(b, 16) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("studio shader:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const MORPH_MS = 1100;
const EASE_FRAME = 0.08;

export function createStudio(canvas: HTMLCanvasElement, options: StudioOptions): Studio | null {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uRes = u("uRes");
  const uTime = u("uTime");
  const uPointer = u("uPointer");
  const uScroll = u("uScroll");
  const uDay = u("uDay");
  const uHueA = u("uHueA");
  const uHueB = u("uHueB");
  const uA = u("uA");
  const uB = u("uB");
  const uMix = u("uMix");
  const uFrame = u("uFrame");

  let sceneA = SCENES[options.scene];
  let sceneB = sceneA;
  let morphStart = -1;
  const frame = { ...options.frame };
  const target = { ...options.frame };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;
  // Full resolution on 1x screens (thin chrome rings alias below it), 0.6x of 2x on retina.
  let quality = (window.devicePixelRatio || 1) >= 2 ? 1.2 : 1;
  let raf = 0;
  let firstFrame = true;
  let slowFrames = 0;
  let last = performance.now();
  const start = last;
  const still = options.still;

  function setTheme(day: boolean, hues: [string, string]) {
    gl.uniform1f(uDay, day ? 1 : 0);
    gl.uniform3fv(uHueA, rgb(hues[0]));
    gl.uniform3fv(uHueB, rgb(hues[1]));
    if (still) requestFrame();
  }
  setTheme(options.day, options.hues);

  function resize() {
    const w = Math.max(1, Math.round(window.innerWidth * quality));
    const h = Math.max(1, Math.round(window.innerHeight * quality));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function draw(now: number) {
    raf = 0;
    if (document.hidden) return;
    resize();
    const dt = now - last;
    last = now;
    // Adaptive quality: a GPU that can't hold ~50 fps renders at fewer pixels.
    if (!firstFrame && dt > 22) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 20 && quality > 0.4) {
      quality *= 0.8;
      slowFrames = 0;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    frame.x += (target.x - frame.x) * EASE_FRAME;
    frame.y += (target.y - frame.y) * EASE_FRAME;
    frame.scale += (target.scale - frame.scale) * EASE_FRAME;

    let mix = 1;
    if (morphStart >= 0) {
      mix = Math.min(1, (now - morphStart) / MORPH_MS);
      if (mix >= 1) {
        sceneA = sceneB;
        morphStart = -1;
      }
    }

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, still ? 4 : (now - start) / 1000);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uScroll, scroll);
    gl.uniform1i(uA, sceneA);
    gl.uniform1i(uB, sceneB);
    gl.uniform1f(uMix, mix);
    gl.uniform3f(uFrame, frame.x, frame.y, frame.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (firstFrame) {
      firstFrame = false;
      options.onFirstFrame();
    }
    const settling =
      morphStart >= 0 ||
      Math.abs(target.x - frame.x) > 0.001 ||
      Math.abs(target.scale - frame.scale) > 0.001;
    if (!still || settling) requestFrame();
  }

  function requestFrame() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function onPointer(e: PointerEvent) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }
  function onScroll() {
    scroll = Math.min(2, window.scrollY / Math.max(1, window.innerHeight));
    if (still) requestFrame();
  }
  function onVisibility() {
    if (!document.hidden) {
      last = performance.now();
      requestFrame();
    }
  }
  function onResize() {
    if (still) requestFrame();
  }
  function onLost(e: Event) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  }

  if (!still) window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  onScroll();
  requestFrame();

  return {
    setScene(scene, nextFrame) {
      Object.assign(target, nextFrame);
      const next = SCENES[scene];
      if (still) {
        sceneA = sceneB = next;
        Object.assign(frame, nextFrame);
      } else if (next !== sceneB) {
        // A morph already under way continues from wherever it is towards the newest scene.
        if (morphStart >= 0) sceneA = sceneB;
        sceneB = next;
        morphStart = performance.now();
      }
      requestFrame();
    },
    setTheme,
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
