"use client";

// The chat and the brief sheet are more than a route's share of the first-load budget (§6.11).
// This boundary splits them into their own chunk; the server still renders the screen whole.

import dynamic from "next/dynamic";

export const RecommendersTabHost = dynamic(() =>
  import("./recommenders-tab").then((m) => m.RecommendersTab),
);
