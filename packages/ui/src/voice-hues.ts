// The 12 Voiceprint hues (SPEC §2.3). --voice belongs to the applicant: it colours their
// Voiceline and marks their own words, and UI chrome never borrows it.
//
// Each hue has a Night variant and a Day variant of the same hue angle, all at one lightness and
// chroma so they sit with brass and the warm neutrals: Night oklch(0.84 0.085 h), Day
// oklch(0.46 0.10 h). Captions are set in the hue, so every variant is text-grade: at least
// 4.5:1 against its theme's --space and --depth (voice-hues.test.ts). No hue sits within 25° of
// brass (75°) at full chroma, so the applicant's colour is never mistaken for the primary action;
// Stone sits near it but is almost neutral. The ids, order and count never change: a stored
// choice must always resolve.

import type { CSSProperties } from "react";

export interface VoiceHue {
  id: string;
  /** Shown in Settings when the applicant swaps their hue. */
  name: string;
  night: string;
  day: string;
}

export const VOICE_HUES: readonly VoiceHue[] = [
  { id: "aqua", name: "Aqua", night: "#84DCDC", day: "#006869" },
  { id: "amber", name: "Ember", night: "#F9BA9A", day: "#844420" },
  { id: "violet", name: "Violet", night: "#D3BEFA", day: "#614A87" },
  { id: "coral", name: "Coral", night: "#FDB5AF", day: "#873F3B" },
  { id: "gold", name: "Citron", night: "#CFCF8E", day: "#5E5B00" },
  { id: "lime", name: "Lime", night: "#BAD69A", day: "#48621E" },
  { id: "fern", name: "Fern", night: "#A7DAAA", day: "#2D6634" },
  { id: "mint", name: "Mint", night: "#95DDBD", day: "#00694A" },
  { id: "sky", name: "Sky", night: "#95D3FC", day: "#055F89" },
  { id: "orchid", name: "Orchid", night: "#EAB7E7", day: "#754274" },
  { id: "rose", name: "Rose", night: "#F8B4CD", day: "#823E5B" },
  { id: "sand", name: "Stone", night: "#D1C9BC", day: "#5E574C" },
];

/** Wraps any integer onto the 12 hues, so stored or computed indexes are always valid. */
export function voiceHueAt(index: number): VoiceHue {
  const count = VOICE_HUES.length;
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  return VOICE_HUES[((safe % count) + count) % count] as VoiceHue;
}

/**
 * Sets the applicant's hue on an element. tokens.css resolves --voice (and the translucent
 * --voice-glow) from these two for whichever theme the element sits in, so a subtree can be
 * Night or Day without knowing the hue, and swapping the hue never re-renders anything but this.
 */
export function voiceHueStyle(index: number): CSSProperties {
  const hue = voiceHueAt(index);
  return { "--voice-night": hue.night, "--voice-day": hue.day } as CSSProperties;
}
