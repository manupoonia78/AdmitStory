"use client";

// The Coverage tab carries Motion (the facets dealing out to their lanes), so the whole screen
// loads behind this boundary and none of it weighs on the route's first load (spec §6.11).

import dynamic from "next/dynamic";

export const DetailHost = dynamic(() => import("./detail-screen").then((m) => m.DetailScreen));
