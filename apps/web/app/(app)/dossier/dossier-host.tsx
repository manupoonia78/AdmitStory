"use client";

// The screen's code loads as its own chunk (spec §6.11: 160 KB first load per route), as the kit,
// workspace and strategy screens do. The server still renders it whole.

import dynamic from "next/dynamic";

export const DossierHost = dynamic(() => import("./dossier-screen").then((m) => m.DossierScreen));
