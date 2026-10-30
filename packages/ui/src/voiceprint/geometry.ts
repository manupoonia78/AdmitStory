// Still geometry for a Voiceprint (spec §6.2): the filaments of the SVG render used by
// VoiceprintStill and as the tier 1 fallback. Pure and seeded, so a given identity always draws
// the same mark on screen, in avatars and in exports.

import type { VoiceprintParams } from "./types";

/** mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One filament: an ellipse in a 100 × 100 box, centred near (50, 50). */
export interface Filament {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Degrees. */
  rotate: number;
  opacity: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Filaments wound around the centre like threads around a sphere. Asymmetry pulls their centres
 * towards one seeded direction, so a lopsided speaker gets a lopsided form.
 */
export function filaments(params: VoiceprintParams): Filament[] {
  const random = seededRandom(params.seed);
  const lean = random() * Math.PI * 2;
  const count = Math.max(1, Math.round(params.filamentCount));
  return Array.from({ length: count }, (_, i) => {
    const pull = params.asymmetry * (3 + random() * 5);
    return {
      cx: round(50 + Math.cos(lean) * pull),
      cy: round(50 + Math.sin(lean) * pull),
      rx: round(26 + random() * 10),
      ry: round(8 + random() * 12),
      rotate: round((i * 180) / count + (random() - 0.5) * 14),
      opacity: round(0.3 + random() * 0.45),
    };
  });
}

/** A mote of light: one of the free particles, drawn as a dot in the still render. */
export interface Mote {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

/**
 * Seeded motes inside the sphere, denser towards the middle, so the still has the particles of
 * the live form too. Independent of the filaments' random stream, so adding motes never changes
 * an existing mark's threads.
 */
export function motes(params: VoiceprintParams, count = 28): Mote[] {
  const random = seededRandom(params.seed ^ 0x9e3779b9);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 6 + 34 * random() ** 0.8;
    return {
      cx: round(50 + Math.cos(angle) * distance),
      cy: round(50 + Math.sin(angle) * distance),
      r: round(0.35 + random() * 0.6),
      opacity: round(0.2 + random() * 0.5),
    };
  });
}
