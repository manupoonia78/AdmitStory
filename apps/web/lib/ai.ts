import "server-only";

import { createAIFromEnv, type AI } from "@admitstory/ai";
import { createUsageLedgerSink, getDb } from "@admitstory/db";

// The app's one ai.run() entry point (spec §8.4), metering into usage_ledger in Postgres.
// Server-only: it reads canon, prompts and replay fixtures from disk, and holds API keys.
// Route handlers call `await ai().flush()` before returning so Langfuse traces are sent.

const globalForAI = globalThis as typeof globalThis & { __admitstoryAI?: AI };

export function ai(): AI {
  globalForAI.__admitstoryAI ??= createAIFromEnv(createUsageLedgerSink(getDb()));
  return globalForAI.__admitstoryAI;
}
