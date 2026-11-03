"use client";

// The assembly carries Motion, more than a route's share of the 160 KB first-load budget (§6.11).
// This boundary splits it into its own chunk; the server still renders it whole.

import dynamic from "next/dynamic";

export const KitHost = dynamic(() => import("./kit-screen").then((m) => m.KitScreen));
