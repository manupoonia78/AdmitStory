import "server-only";

import {
  createAIFromEnv,
  createRegistryOverlay,
  type AI,
  type OverlayCanonDoc,
  type OverlayPromptVersion,
  type RegistryOverlay,
} from "@admitstory/ai";
import {
  createUsageLedgerSink,
  getActivePromptVersions,
  getDb,
  getPublishedCanon,
  type DbExecutor,
} from "@admitstory/db";

// The app's one ai.run() entry point (spec §8.4), metering into usage_ledger in Postgres.
// Server-only: it reads canon, prompts and replay fixtures from disk, and holds API keys.
// Route handlers call `await ai().flush()` before returning so Langfuse traces are sent.
//
// The registry overlay (spec §5.18, §9.4) lays what the admin console publishes over the files:
// active prompt versions with their A/B weights and route overrides (`prompt_versions`) and
// published canon documents (`canon_docs`). Answers are cached for OVERLAY_TTL_MS (60 s), so a
// publish reaches every call within a minute without a database read per call.

/**
 * The overlay over `prompt_versions` and `canon_docs`. Only active versions are handed over: an
 * inactive one never serves traffic, and the files stay the fallback when nothing is active.
 */
export function registryOverlay(
  db: DbExecutor,
  options: { ttlMs?: number; now?: () => number } = {},
): RegistryOverlay {
  return createRegistryOverlay({
    ...options,
    async promptVersions(agent): Promise<OverlayPromptVersion[]> {
      const rows = await getActivePromptVersions(db, agent);
      return rows.map((row) => ({
        version: row.version,
        template: row.template,
        active: row.active,
        abWeight: row.abWeight,
        routeOverride: row.routeOverride,
      }));
    },
    async canonDocs(): Promise<OverlayCanonDoc[]> {
      const rows = await getPublishedCanon(db);
      return rows.map((row) => ({ slug: row.slug, version: row.version, content: row.content }));
    },
  });
}

const globalForAI = globalThis as typeof globalThis & { __admitstoryAI?: AI };

export function ai(): AI {
  const db = getDb();
  globalForAI.__admitstoryAI ??= createAIFromEnv(
    createUsageLedgerSink(db),
    process.env,
    undefined,
    registryOverlay(db),
  );
  return globalForAI.__admitstoryAI;
}
