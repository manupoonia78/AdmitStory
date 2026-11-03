"use client";

import { deferred } from "../_ui/deferred";

export const UnlockPreviewIsland = deferred(() => import("./_unlock"), "visible");
