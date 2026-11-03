"use client";

// The chapter frames that use client components from @admitstory/ui. "never": the server HTML is
// the frame, and its JavaScript is never requested (plan §3.4, deviation D10).

import { deferred } from "../../_ui/deferred";

export const StudioFrameIsland = deferred(() => import("./studio-frame"), "never");
export const StoryFrameIsland = deferred(() => import("./story-frame"), "never");
export const EssayFrameIsland = deferred(() => import("./essay-frame"), "never");
