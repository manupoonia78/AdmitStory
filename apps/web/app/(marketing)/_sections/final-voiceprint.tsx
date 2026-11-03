"use client";

// The final call's form: the visitor's own Voiceprint when the hero kept one in this browser
// (lib/marketing/first-line.ts), else the sample applicant's. Decorative: the heading beside it
// carries the meaning.

import { VoiceprintStill, paramsFromIdentity, voiceHueStyle } from "@admitstory/ui";
import { useSyncExternalStore } from "react";
import { readFirstLine, subscribeFirstLine } from "@/lib/marketing/first-line";
import { SAMPLE_IDENTITY } from "../_data/sample";

const noLine = () => null;

export default function FinalVoiceprint() {
  const kept = useSyncExternalStore(subscribeFirstLine, readFirstLine, noLine);
  const identity = kept?.identity ?? null;
  return (
    <div
      className="size-full"
      style={identity ? voiceHueStyle(paramsFromIdentity(identity).hueIndex) : undefined}
    >
      <VoiceprintStill identity={identity ?? SAMPLE_IDENTITY} size="fill" label="" />
    </div>
  );
}
