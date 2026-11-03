// The 12 tuned Voiceprint hues (spec §6.2–6.3). --voice is the only expressive colour in the
// product and it belongs to the applicant: UI chrome never borrows it.
//
// Each hue has a Night variant (light, luminous) and a Day variant (a darker form of the same
// hue). Captions in the live-mock duet stage are set in the hue, so every variant is text-grade:
// at least 4.5:1 against its theme's --space and --depth (voice-hues.test.ts). Hues near
// --signal (blue, ~227°) and --record/--risk (red) are left out so the applicant's colour is
// never mistaken for an interactive or warning state.

import type { CSSProperties } from "react";

export interface VoiceHue {
  id: string;
  /** Shown in Settings when the applicant swaps their hue. */
  name: string;
  night: string;
  day: string;
}

export const VOICE_HUES: readonly VoiceHue[] = [
  { id: "aqua", name: "Aqua", night: "#7CF5E6", day: "#0A6B64" },
  { id: "amber", name: "Amber", night: "#FFB86B", day: "#8F4E00" },
  { id: "violet", name: "Violet", night: "#C59BFF", day: "#6A3DC4" },
  { id: "coral", name: "Coral", night: "#FF9B8E", day: "#B0392C" },
  { id: "gold", name: "Gold", night: "#F6D86E", day: "#6F5A00" },
  { id: "lime", name: "Lime", night: "#C4EE78", day: "#4A690C" },
  { id: "fern", name: "Fern", night: "#A6F28F", day: "#2F6B1A" },
  { id: "mint", name: "Mint", night: "#8AEFA9", day: "#17703D" },
  { id: "sky", name: "Sky", night: "#7DCEFF", day: "#0B5E8C" },
  { id: "orchid", name: "Orchid", night: "#EB9EF2", day: "#8A2F92" },
  { id: "rose", name: "Rose", night: "#FF9CC6", day: "#A6306A" },
  { id: "sand", name: "Sand", night: "#E6CFA6", day: "#6C5431" },
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
