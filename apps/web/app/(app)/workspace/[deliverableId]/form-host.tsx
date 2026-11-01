"use client";

// The Form Advisor carries Motion (the lanes' deal-out); this boundary keeps it out of the route's
// first load (spec §6.11), as the Workspace host does. The server still renders the screen whole.

import dynamic from "next/dynamic";

export const FormHost = dynamic(() => import("./form-screen").then((m) => m.FormScreen));
