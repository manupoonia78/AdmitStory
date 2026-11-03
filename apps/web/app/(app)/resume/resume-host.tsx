"use client";

// The résumé sheet carries Motion (the words morphing in place, the overflow receding); this
// boundary keeps it out of the route's first load (spec §6.11). The server still renders it whole.

import dynamic from "next/dynamic";

export const ResumeHost = dynamic(() => import("./resume-screen").then((m) => m.ResumeScreen));
