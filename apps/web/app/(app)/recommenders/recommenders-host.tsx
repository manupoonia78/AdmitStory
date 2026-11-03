"use client";

// Screen H's list and the add sheet behind a next/dynamic boundary, like Phase 5's hosts, so the
// route's first load stays inside the budget (spec §6.11).

import dynamic from "next/dynamic";

export const RecommendersHost = dynamic(() =>
  import("./recommenders-screen").then((m) => m.RecommendersScreen),
);
