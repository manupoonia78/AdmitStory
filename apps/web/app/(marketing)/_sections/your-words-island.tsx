"use client";

import { deferred } from "../_ui/deferred";

export const YourWordsToyIsland = deferred(() => import("./your-words-toy"), "visible");
