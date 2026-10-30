"use client";

// The Story Studio moment carries Motion and the Voiceprint, which together are far more than
// a route's share of the 160 KB first-load budget (spec §6.11). This boundary splits it into its
// own chunk. The server still renders it, so the screen arrives whole and in its final layout;
// only its behaviour starts once the chunk has landed.

import dynamic from "next/dynamic";

export const StudioPrototype = dynamic(() =>
  import("./studio-prototype").then((m) => m.StudioPrototype),
);
