import { getDb, systemContext } from "@admitstory/db";
import { ingestKbSource } from "../../lib/admin/ingest";
import { ai } from "../../lib/ai";
import { inngest } from "../client";
import { kbSourceAdded } from "../events";

// kb/ingest-source (spec §9.3): extract → chunk → ai.embed → chunks with embeddings →
// kb.normalize against the cycle's draft → kb_proposals with conflicts. The work lives in
// lib/admin/ingest.ts, which records every stage and any failure on the source itself; so the run
// is one step, and it is not retried: the console shows the failed step with "Normalise again".

export const kbIngestSourceFn = inngest.createFunction(
  {
    id: "kb-ingest-source",
    name: "kb/ingest-source",
    triggers: [kbSourceAdded],
    concurrency: { key: "event.data.sourceId", limit: 1 },
    retries: 0,
  },
  async ({ event, step }) =>
    step.run("ingest", async () => {
      const admin = systemContext(getDb(), "inngest:kb.ingest-source");
      const result = await ingestKbSource({ admin, ai: ai() }, event.data.sourceId);
      await ai().flush();
      return result;
    }),
);
