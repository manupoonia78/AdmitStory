// The live WebGL Voiceprint (spec §6.2, §6.11), drawn with OGL. Only ever loaded with a dynamic
// import after mount, so neither OGL nor this file counts towards a route's initial JS budget.
//
// Three layers, all premultiplied: a soft spherical volume, the filaments (loops of points), and
// free particles. The loop pauses when the tab is hidden or the element is off-screen, drops its
// GPU resources on dispose, and rebuilds itself if the browser restores a lost context.

import { Geometry, Mesh, Program, Renderer, Transform, Triangle } from "ogl";
import { TIER_BUDGETS, drawingRatio, filamentBuffers, particleBuffers } from "./buffers";
import { createDynamics, stepDynamics, type Dynamics } from "./choreography";
import { blendFor, coolShift, parseCssColor, type Rgb } from "./color";
import {
  FILAMENT_VERTEX,
  PARTICLE_VERTEX,
  POINT_FRAGMENT,
  VOLUME_FRAGMENT,
  VOLUME_VERTEX,
} from "./shaders";
import type { VoiceSignalRef, VoiceprintMood, VoiceprintParams } from "./types";

export interface RendererInputs {
  params: VoiceprintParams;
  mood: VoiceprintMood;
  tier: 2 | 3;
  signal: VoiceSignalRef | null;
}

export interface RendererEvents {
  /** The first frame is on screen: time to fade the canvas in over the still. */
  onFirstFrame(): void;
  /** The context was lost; show the still until it comes back. */
  onLost(): void;
}

export interface VoiceprintRenderer {
  update(inputs: RendererInputs): void;
  dispose(): void;
}

const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: "high-performance",
};

/** Base point size as a share of the canvas's shorter side. */
const POINT_SHARE = 0.016;
/** Re-read the CSS colour this often: a theme or hue change lands within a quarter second. */
const COLOR_CHECK_S = 0.25;
const MAX_DT_S = 1 / 20;
/** How quickly the drawn colour follows a new hue (a crossfade, not an animation of its own). */
const COLOR_TAU_S = 0.12;

const FALLBACK_COLOR: Rgb = [0.49, 0.96, 0.9];

/** Light per point, relative to tier 2's density (reference: 110 points). */
const densityFor = (points: number) => Math.min(1.2, Math.max(0.4, 110 / Math.max(1, points)));

type Uniform<T> = { value: T };

interface Uniforms {
  [name: string]: Uniform<number | number[]>;
  uTime: Uniform<number>;
  uScale: Uniform<number>;
  uAspect: Uniform<number[]>;
  uSwirl: Uniform<number>;
  uFlow: Uniform<number>;
  uEnergy: Uniform<number>;
  uSharp: Uniform<number>;
  uBright: Uniform<number>;
  uPointPx: Uniform<number>;
  uMaxPoint: Uniform<number>;
  uColor: Uniform<number[]>;
  uHalo: Uniform<number>;
  uHot: Uniform<number>;
  uOffset: Uniform<number[]>;
  uStrength: Uniform<number>;
}

function createUniforms(): Uniforms {
  return {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uAspect: { value: [1, 1] },
    uSwirl: { value: 0 },
    uFlow: { value: 0 },
    uEnergy: { value: 0 },
    uSharp: { value: 0.5 },
    uBright: { value: 1 },
    uPointPx: { value: 8 },
    uMaxPoint: { value: 64 },
    uColor: { value: [...FALLBACK_COLOR] },
    uHalo: { value: 0 },
    uHot: { value: 1 },
    uOffset: { value: [0, 0] },
    uStrength: { value: 1 },
  };
}

interface Scene {
  renderer: Renderer;
  root: Transform;
  programs: Program[];
  points: { filaments: Mesh; particles: Mesh } | null;
  volume: Mesh;
}

/** Throws when the browser can't give us a WebGL context; the caller falls back to the still. */
export function createVoiceprintRenderer(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  initial: RendererInputs,
  events: RendererEvents,
): VoiceprintRenderer {
  const webgl = canvas.getContext("webgl2", CONTEXT_ATTRIBUTES)
    ? 2
    : canvas.getContext("webgl", CONTEXT_ATTRIBUTES)
      ? 1
      : 0;
  if (!webgl) throw new Error("WebGL is unavailable");
  // A context lost for good (another renderer released it) never restores: draw the still.
  const context = webgl === 2 ? canvas.getContext("webgl2") : canvas.getContext("webgl");
  if (!context || context.isContextLost()) throw new Error("The WebGL context is lost");

  let inputs = initial;
  const uniforms = createUniforms();
  const dynamics: Dynamics = createDynamics(inputs.mood);
  let scene: Scene | null = null;
  let builtFor = "";
  let size = { width: 0, height: 0 };
  let frame: number | null = null;
  let last: number | null = null;
  let colorClock = COLOR_CHECK_S;
  let targetColor: Rgb = FALLBACK_COLOR;
  let drewFirst = false;
  let lost = false;
  let inView = true;
  let disposed = false;

  const pageVisible = () => document.visibilityState !== "hidden";

  const build = (): Scene => {
    const renderer = new Renderer({
      canvas,
      webgl,
      dpr: 1,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    const gl = renderer.gl;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    uniforms.uMaxPoint.value = range?.[1] ?? 64;

    const program = (vertex: string, fragment: string) =>
      new Program(gl, {
        vertex,
        fragment,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
    const volumeProgram = program(VOLUME_VERTEX, VOLUME_FRAGMENT);
    const root = new Transform();
    const volume = new Mesh(gl, { geometry: new Triangle(gl), program: volumeProgram });
    volume.setParent(root);
    return { renderer, root, programs: [volumeProgram], points: null, volume };
  };

  /** (Re)builds the point layers for the current identity and tier. */
  const buildPoints = (target: Scene) => {
    const key = `${inputs.tier}:${inputs.params.seed}:${inputs.params.filamentCount}:${inputs.params.asymmetry}`;
    if (target.points && key === builtFor) return;
    builtFor = key;
    const gl = target.renderer.gl;
    if (target.points) {
      for (const mesh of [target.points.filaments, target.points.particles]) {
        mesh.setParent(null);
        mesh.geometry.remove();
        mesh.program.remove();
      }
      target.programs = target.programs.filter(
        (p) => p !== target.points?.filaments.program && p !== target.points?.particles.program,
      );
    }
    const budget = TIER_BUDGETS[inputs.tier];
    const threads = filamentBuffers(inputs.params, budget.pointsPerFilament);
    const dust = particleBuffers(inputs.params.seed, budget.particles);
    uniforms.uOffset.value = threads.offset;
    uniforms.uHalo.value = budget.halo;

    // Fewer points per thread (tier 2) each carry more light, so both tiers read the same.
    const pointProgram = (vertex: string, points: number) =>
      new Program(gl, {
        vertex,
        fragment: POINT_FRAGMENT,
        uniforms: { ...uniforms, uDensity: { value: densityFor(points) } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
    const filamentsMesh = new Mesh(gl, {
      mode: gl.POINTS,
      geometry: new Geometry(gl, {
        aT: { size: 1, data: threads.t },
        aOrbit: { size: 4, data: threads.orbit },
        aCenter: { size: 2, data: threads.center },
        aRand: { size: 1, data: threads.rand },
      }),
      program: pointProgram(FILAMENT_VERTEX, budget.pointsPerFilament / 2),
    });
    const particlesMesh = new Mesh(gl, {
      mode: gl.POINTS,
      geometry: new Geometry(gl, {
        aPosition: { size: 3, data: dust.position },
        aRand: { size: 1, data: dust.rand },
      }),
      program: pointProgram(PARTICLE_VERTEX, budget.particles / 6),
    });
    filamentsMesh.setParent(target.root);
    particlesMesh.setParent(target.root);
    target.points = { filaments: filamentsMesh, particles: particlesMesh };
    target.programs.push(filamentsMesh.program, particlesMesh.program);
    applyBlend(target);
    resize(target);
  };

  const applyBlend = (target: Scene) => {
    const gl = target.renderer.gl;
    const light = blendFor(targetColor) === "light";
    for (const p of target.programs) {
      // Night: light adds up. Day: layers like ink, or it would wash out to white.
      if (light) p.setBlendFunc(gl.ONE, gl.ONE);
      else p.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    uniforms.uHot.value = light ? 1 : 0;
    uniforms.uStrength.value = light ? 1 : 0.45;
  };

  const resize = (target: Scene) => {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;
    const dpr = drawingRatio(width, height, window.devicePixelRatio, TIER_BUDGETS[inputs.tier]);
    target.renderer.dpr = dpr;
    target.renderer.setSize(width, height);
    const shorter = Math.min(width, height);
    uniforms.uAspect.value = [shorter / width, shorter / height];
    uniforms.uPointPx.value = shorter * dpr * POINT_SHARE;
  };

  const readColor = () => {
    const parsed = parseCssColor(getComputedStyle(host).color);
    if (!parsed) return;
    const changedBlend = blendFor(parsed) !== blendFor(targetColor);
    targetColor = parsed;
    if (changedBlend && scene) applyBlend(scene);
  };

  const render = (now: number) => {
    frame = requestAnimationFrame(render);
    if (!scene) return;
    const dt = last === null ? 0 : Math.min(MAX_DT_S, (now - last) / 1000);
    last = now;

    colorClock += dt;
    if (colorClock >= COLOR_CHECK_S) {
      colorClock = 0;
      readColor();
    }

    const values = stepDynamics(dynamics, dt, {
      mood: inputs.mood,
      swirlSpeed: inputs.params.swirlSpeed,
      signal: inputs.signal?.current ?? null,
    });
    const shown = coolShift(targetColor, values.cool);
    const color = uniforms.uColor.value;
    const follow = dt > 0 ? 1 - Math.exp(-dt / COLOR_TAU_S) : 1;
    shown.forEach((channel, i) => {
      const current = color[i] ?? channel;
      color[i] = current + (channel - current) * follow;
    });
    uniforms.uTime.value = values.time;
    uniforms.uScale.value = values.scale;
    uniforms.uSwirl.value = values.swirl;
    uniforms.uFlow.value = values.flow;
    uniforms.uEnergy.value = values.energy;
    uniforms.uSharp.value = values.sharpness;
    uniforms.uBright.value = values.brightness;

    scene.renderer.render({ scene: scene.root, sort: false, frustumCull: false, update: false });
    if (!drewFirst) {
      drewFirst = true;
      events.onFirstFrame();
    }
  };

  const running = () => frame !== null;
  const syncLoop = () => {
    const shouldRun = !disposed && !lost && inView && pageVisible() && size.width > 0;
    if (shouldRun && !running()) {
      last = null;
      frame = requestAnimationFrame(render);
    } else if (!shouldRun && running()) {
      cancelAnimationFrame(frame as number);
      frame = null;
    }
  };

  const start = () => {
    scene = build();
    // Snap the colour on the first frame rather than fading in from the fallback.
    readColor();
    uniforms.uColor.value = [...targetColor];
    builtFor = "";
    buildPoints(scene);
    applyBlend(scene);
  };

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    size = { width: entry.contentRect.width, height: entry.contentRect.height };
    if (scene) resize(scene);
    syncLoop();
  });
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? true;
    syncLoop();
  });
  const onVisibility = () => syncLoop();
  const onLost = (event: Event) => {
    // Asking for restoration: without preventDefault the context never comes back.
    event.preventDefault();
    lost = true;
    syncLoop();
    events.onLost();
  };
  const onRestored = () => {
    lost = false;
    drewFirst = false;
    start();
    syncLoop();
  };

  const rect = host.getBoundingClientRect();
  size = { width: rect.width, height: rect.height };
  start();
  resizeObserver.observe(host);
  intersection.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  syncLoop();

  return {
    update(next) {
      inputs = next;
      if (scene && !lost) buildPoints(scene);
    },
    dispose() {
      disposed = true;
      syncLoop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (scene && !lost) {
        for (const mesh of [scene.volume, scene.points?.filaments, scene.points?.particles]) {
          mesh?.geometry.remove();
        }
        for (const p of scene.programs) p.remove();
        // Hand the GPU memory back now rather than whenever the canvas is collected, but only
        // once the canvas has left the page: React re-runs effects on the same canvas (Fast
        // Refresh, a route hidden by <Activity>), and a context lost on purpose never returns.
        if (!canvas.isConnected) {
          scene.renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
        }
      }
      scene = null;
    },
  };
}
