"use client";

import { deferred } from "../_ui/deferred";

export const FinalVoiceprintIsland = deferred(() => import("./final-voiceprint"), "idle");
