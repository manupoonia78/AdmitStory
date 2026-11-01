import "server-only";

import { getDb } from "@admitstory/db";
import { ai } from "@/lib/ai";
import { runPipeline, type KitRef } from "./pipeline";

// The kit pipeline without Inngest (local development): every stage in order, after the webhook's
// response. With Inngest configured, inngest/functions/kit-generate.ts runs the same stages as steps.

export function runKitGeneration(ref: KitRef): Promise<{ status: string }> {
  return runPipeline({ ai: ai(), db: getDb() }, ref).finally(() => ai().flush());
}
