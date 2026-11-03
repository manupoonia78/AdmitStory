import "server-only";

import { getDb, systemContext } from "@admitstory/db";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { evalsRun, inngestReady, kbPackPublished, kbSourceAdded } from "@/inngest/events";
import { ai } from "@/lib/ai";
import { ingestKbSource } from "./ingest";

// How the console starts background work. With Inngest configured (an event key, or the Dev
// Server) the event goes to Inngest, which retries and records runs. Without it (a laptop with no
// Dev Server running) ingestion runs in-process after the response, so adding a source still works.

export async function startIngest(sourceId: string): Promise<"queued" | "inline"> {
  if (inngestReady()) {
    await inngest.send(kbSourceAdded.create({ sourceId }));
    return "queued";
  }
  after(async () => {
    const admin = systemContext(getDb(), "inline:kb.ingest-source");
    await ingestKbSource({ admin, ai: ai() }, sourceId);
    await ai().flush();
  });
  return "inline";
}

export async function emitPackPublished(cycleId: string, version: number): Promise<void> {
  if (!inngestReady()) return;
  await inngest.send(kbPackPublished.create({ cycleId, version }));
}

/** §9.4: publishing canon runs the eval suite. It arrives in Phase 9; until then this is logged. */
export async function emitEvalsRun(data: {
  reason: "canon_published" | "prompt_activated";
  canonDocId?: string;
  slug?: string;
  version?: number;
}): Promise<void> {
  console.info("[evals] run requested (the eval suite arrives in Phase 9):", data);
  if (!inngestReady()) return;
  await inngest.send(evalsRun.create(data));
}
