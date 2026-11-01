"use client";

// The screen's code loads as its own chunk (spec §6.11: 160 KB first load per route), as the kit
// and workspace screens do. The server still renders it whole, so it arrives in its final layout.

import dynamic from "next/dynamic";

export const StrategyHost = dynamic(() =>
  import("./strategy-screen").then((m) => m.StrategyScreen),
);
