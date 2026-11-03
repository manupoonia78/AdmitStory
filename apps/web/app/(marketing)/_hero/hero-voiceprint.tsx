"use client";

// The hero's live form (lazy): the real Voiceprint, laid exactly over the server poster (same
// box, same identity, same still first), so the WebGL canvas cross-fades in with nothing moving.
// It takes the visitor's own identity and hue once there is one. The Voiceprint picks its own
// tier: tier 1 and reduced motion stay on the still form.

import {
  Voiceprint,
  paramsFromIdentity,
  voiceHueStyle,
  type VoiceSignalRef,
  type VoiceprintIdentity,
  type VoiceprintMood,
} from "@admitstory/ui";
import { SAMPLE_IDENTITY } from "../_data/sample";

export default function HeroVoiceprint({
  identity,
  signal,
  mood,
}: {
  identity: VoiceprintIdentity | null;
  signal: VoiceSignalRef;
  mood: VoiceprintMood;
}) {
  const shown = identity ?? SAMPLE_IDENTITY;
  return (
    <div
      aria-hidden="true"
      className="hero-form-box -z-10"
      style={identity ? voiceHueStyle(paramsFromIdentity(identity).hueIndex) : undefined}
    >
      <Voiceprint identity={shown} signal={signal} mood={mood} size="fill" label="" />
    </div>
  );
}
