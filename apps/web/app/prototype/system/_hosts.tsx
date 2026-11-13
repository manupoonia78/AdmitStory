"use client";

// The component kit, the motion bench and the overlays between them import every control in
// the system (Radix tabs, dialog, sheet, tooltip, toast), which is far more than one route's
// share of the 160 KB first-load budget. These boundaries split each into its own chunk. The
// server still renders them, so the page arrives whole; only their behaviour waits for the chunk.

import dynamic from "next/dynamic";

export const Kit = dynamic(() => import("./_kit").then((m) => m.Kit));
export const MotionBench = dynamic(() => import("./_motion").then((m) => m.MotionBench));
export const Overlays = dynamic(() => import("./_overlays").then((m) => m.Overlays));
