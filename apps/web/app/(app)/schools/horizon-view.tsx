"use client";

// A one-line module so the horizon (and Motion with it) is code-split on its own, as the Dossier's
// constellation-view.tsx does: importing `@admitstory/ui` inside next/dynamic would pull the whole
// barrel into the first load.
export { HorizonTimeline } from "@admitstory/ui";
