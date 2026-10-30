"use client";

// The Voiceprint lab carries the Voiceprint and the microphone path, which together are far more
// than a route's share of the 160 KB first-load budget (spec §6.11). This boundary splits it into
// its own chunk. The server still renders it, so the screen arrives whole and in its final
// layout; only its behaviour starts once the chunk has landed.

import dynamic from "next/dynamic";

export const VoiceprintLab = dynamic(() => import("./voiceprint-lab").then((m) => m.VoiceprintLab));
