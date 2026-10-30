"use client";

// The duet stage carries Motion, both Voiceprints and the script, which together are far more
// than a route's share of the 160 KB first-load budget (spec §6.11). This boundary splits it into
// its own chunk. The server still renders it, so the screen arrives whole and in its final
// layout; only its behaviour starts once the chunk has landed.

import dynamic from "next/dynamic";

export const DuetPrototype = dynamic(() => import("./duet-prototype").then((m) => m.DuetPrototype));
