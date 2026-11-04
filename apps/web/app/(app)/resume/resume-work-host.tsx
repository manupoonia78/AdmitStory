"use client";

// The résumé screen with its chat is more than a route's share of the first-load budget (§6.11).
// This boundary splits it into its own chunk; the server still renders it whole.

import dynamic from "next/dynamic";

export const ResumeWorkHost = dynamic(() => import("./resume-work").then((m) => m.ResumeWork));
