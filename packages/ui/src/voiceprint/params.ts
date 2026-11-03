// Identity → render parameters (spec §6.2). Deterministic: the same identity always draws the
// same Voiceprint, so it "stays recognisably yours" across sessions, devices and exports.

import { VOICE_HUES } from "../voice-hues";
import type { VoiceprintIdentity, VoiceprintParams } from "./types";

/** Used before any speech or writing exists (and for previews). */
export { DEFAULT_IDENTITY } from "@admitstory/shared";

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** Position of `value` between `low` and `high`, clamped to 0..1. */
const between = (value: number, low: number, high: number) => clamp01((value - low) / (high - low));

/** FNV-1a over the rounded identity numbers: a stable 32-bit seed for the renderer's noise. */
function seedFor(identity: VoiceprintIdentity): number {
  const text = [
    identity.avgPitchHz.toFixed(1),
    identity.paceWpm.toFixed(1),
    identity.pitchRangeSemitones.toFixed(2),
    identity.pauseRhythm.toFixed(3),
  ].join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function paramsFromIdentity(identity: VoiceprintIdentity): VoiceprintParams {
  // Typical adult speaking ranges; pitch is compared on a log scale, as hearing does.
  const pitch = between(Math.log2(Math.max(1, identity.avgPitchHz)), Math.log2(80), Math.log2(300));
  const pace = between(identity.paceWpm, 90, 200);
  const range = between(identity.pitchRangeSemitones, 2, 20);
  const hueCount = VOICE_HUES.length;
  return {
    // Pitch picks the region of the wheel; pace shifts within it.
    hueIndex:
      (Math.min(hueCount - 1, Math.floor(pitch * hueCount)) + Math.round(pace * 2)) % hueCount,
    filamentCount: 5 + Math.round(range * 8),
    swirlSpeed: Number((0.4 + pace * 1.2).toFixed(3)),
    asymmetry: Number((0.1 + clamp01(identity.pauseRhythm) * 0.8).toFixed(3)),
    seed: seedFor(identity),
  };
}
