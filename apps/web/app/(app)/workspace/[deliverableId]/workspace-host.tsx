"use client";

// The Workspace's panes carry Motion (version crossfade, diff morph); this boundary keeps them out
// of the route's first load (spec §6.11). The server still renders the screen whole.

import dynamic from "next/dynamic";

export const WorkspaceHost = dynamic(() =>
  import("./workspace-screen").then((m) => m.WorkspaceScreen),
);
