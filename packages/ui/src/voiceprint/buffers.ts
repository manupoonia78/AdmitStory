// Vertex data for the WebGL Voiceprint. Built from the same seeded filaments as the still SVG
// (geometry.ts), so at rest the live form and the still one have the same threads in the same
// places, and the hand-off between them doesn't jump. Pure; no WebGL here.

import { filaments, seededRandom } from "./geometry";
import type { PerformanceTier, VoiceprintParams } from "./types";

/** What each live tier can afford (spec §6.11: tier 2 has fewer particles, no post glow). */
export interface TierBudget {
  pointsPerFilament: number;
  particles: number;
  /** The soft halo around each point that stands in for a bloom pass. 0 turns it off. */
  halo: number;
  /** Device pixel ratio cap. */
  maxDpr: number;
  /** Cap on drawing-buffer pixels, so a full-screen form on a 5K display stays cheap. */
  maxPixels: number;
}

export const TIER_BUDGETS: Record<Exclude<PerformanceTier, 1>, TierBudget> = {
  2: { pointsPerFilament: 220, particles: 520, halo: 0, maxDpr: 1.5, maxPixels: 1_400_000 },
  3: { pointsPerFilament: 480, particles: 1400, halo: 1, maxDpr: 2, maxPixels: 3_200_000 },
};

/** Device pixel ratio for a canvas of `width` × `height` CSS pixels under the budget. */
export function drawingRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
  budget: TierBudget,
): number {
  const wanted = Math.min(Math.max(1, devicePixelRatio || 1), budget.maxDpr);
  const area = Math.max(1, width * height);
  return Math.max(0.5, Math.min(wanted, Math.sqrt(budget.maxPixels / area)));
}

export interface FilamentBuffers {
  /** Position along the loop, 0..1. */
  t: Float32Array;
  /** Per point: rotation in the screen plane, tilt, radius, phase. */
  orbit: Float32Array;
  /** Per point: the filament's centre offset (unit space, y up). */
  center: Float32Array;
  rand: Float32Array;
  count: number;
  /** Mean centre of the filaments: where the soft volume sits. */
  offset: [number, number];
}

const TAU = Math.PI * 2;

/**
 * One loop of points per filament. An SVG ellipse rx × ry rotated by θ is a circle of radius rx
 * tilted by acos(ry / rx) and turned by θ: that is how the 3D threads are placed. SVG's y axis
 * points down and WebGL's up, so the rotation and the centre's y change sign.
 */
export function filamentBuffers(
  params: VoiceprintParams,
  pointsPerFilament: number,
): FilamentBuffers {
  const list = filaments(params);
  const random = seededRandom(params.seed ^ 0x5bd1e995);
  const count = list.length * pointsPerFilament;
  const t = new Float32Array(count);
  const orbit = new Float32Array(count * 4);
  const center = new Float32Array(count * 2);
  const rand = new Float32Array(count);
  let sumX = 0;
  let sumY = 0;
  list.forEach((filament, f) => {
    const radius = filament.rx / 50;
    const tilt = Math.acos(Math.min(1, filament.ry / filament.rx));
    const turn = (-filament.rotate * Math.PI) / 180;
    const phase = random() * TAU;
    const cx = (filament.cx - 50) / 50;
    const cy = -(filament.cy - 50) / 50;
    sumX += cx;
    sumY += cy;
    for (let i = 0; i < pointsPerFilament; i += 1) {
      const index = f * pointsPerFilament + i;
      t[index] = i / pointsPerFilament;
      orbit.set([turn, tilt, radius, phase], index * 4);
      center.set([cx, cy], index * 2);
      rand[index] = random();
    }
  });
  return {
    t,
    orbit,
    center,
    rand,
    count,
    offset: [sumX / Math.max(1, list.length), sumY / Math.max(1, list.length)],
  };
}

export interface ParticleBuffers {
  position: Float32Array;
  rand: Float32Array;
  count: number;
}

/** Free particles filling the soft sphere, denser towards the middle. */
export function particleBuffers(seed: number, count: number): ParticleBuffers {
  const random = seededRandom(seed ^ 0x27d4eb2f);
  const position = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    // A uniform direction, and a radius biased inwards.
    const z = random() * 2 - 1;
    const angle = random() * TAU;
    const ring = Math.sqrt(1 - z * z);
    const radius = 0.15 + 0.7 * random() ** 0.7;
    position.set(
      [Math.cos(angle) * ring * radius, Math.sin(angle) * ring * radius, z * radius],
      i * 3,
    );
    rand[i] = random();
  }
  return { position, rand, count };
}
