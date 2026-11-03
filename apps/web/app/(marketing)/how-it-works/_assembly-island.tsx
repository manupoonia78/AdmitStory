"use client";

import { deferred } from "../_ui/deferred";

export const AssemblyIsland = deferred(() => import("./_assembly"), "visible");
