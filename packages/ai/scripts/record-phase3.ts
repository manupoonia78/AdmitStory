/**
 * Records the replay fixtures for the Phase 3 tasks from the fixed samples in samples/phase3.ts.
 *
 *   pnpm --filter @admitstory/ai record:phase3 --synthetic   # hand-authored replies, no network
 *   pnpm --filter @admitstory/ai record:phase3               # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *
 * Both paths go through ai.run(), so each fixture is keyed by exactly the request the app sends
 * (a batch item replays from the same fixture, see batch.ts). The synthetic replies are in
 * samples/phase3-replies.ts; two samples include a repair turn.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, type RunContext, type TaskName } from "../src";
import { repoRoot } from "../src/paths";
import {
  DOSSIER_CTX,
  KB_NORMALIZE_OFFICIAL_INPUT,
  KB_NORMALIZE_THIRD_PARTY_INPUT,
  KB_REFRESH_CHECK_INPUT,
  KIT_CTX,
  KIT_POSITIONING_INPUT,
  PACK_CTX,
  PROFILE_READ_INPUT,
  SCHOOL_FIT_INPUT,
} from "./samples/phase3";
import {
  KB_NORMALIZE_OFFICIAL_REPLY,
  KB_NORMALIZE_THIRD_PARTY_REPLIES,
  KB_REFRESH_CHECK_REPLY,
  KIT_POSITIONING_REPLIES,
  PROFILE_READ_REPLY,
  SCHOOL_FIT_REPLY,
} from "./samples/phase3-replies";
import { syntheticResponse } from "./samples/synthetic";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 3 was built), built from the " +
  "fictional engineer-to-product applicant and the fictional Halvorsen pack. Re-record live: " +
  "pnpm --filter @admitstory/ai record:phase3";

interface Sample {
  task: TaskName;
  input: unknown;
  ctx: RunContext;
  /** The first reply, then the reply to the repair turn when the first breaks a rule. */
  replies: readonly unknown[];
}

const SAMPLES: readonly Sample[] = [
  {
    task: "profile.read",
    input: PROFILE_READ_INPUT,
    ctx: DOSSIER_CTX,
    replies: [PROFILE_READ_REPLY],
  },
  {
    task: "strategy.school_fit",
    input: SCHOOL_FIT_INPUT,
    ctx: PACK_CTX,
    replies: [SCHOOL_FIT_REPLY],
  },
  {
    task: "kit.positioning_filemap",
    input: KIT_POSITIONING_INPUT,
    ctx: KIT_CTX,
    replies: KIT_POSITIONING_REPLIES,
  },
  {
    task: "kb.normalize",
    input: KB_NORMALIZE_OFFICIAL_INPUT,
    ctx: {},
    replies: [KB_NORMALIZE_OFFICIAL_REPLY],
  },
  {
    task: "kb.normalize",
    input: KB_NORMALIZE_THIRD_PARTY_INPUT,
    ctx: {},
    replies: KB_NORMALIZE_THIRD_PARTY_REPLIES,
  },
  {
    task: "kb.refresh_check",
    input: KB_REFRESH_CHECK_INPUT,
    ctx: {},
    replies: [KB_REFRESH_CHECK_REPLY],
  },
];

async function main(): Promise<void> {
  const synthetic = process.argv.includes("--synthetic");
  if (!synthetic) {
    const env = join(repoRoot(), ".env.local");
    if (existsSync(env)) process.loadEnvFile(env);
    if (process.env.AI_MODE !== "live" || !process.env.ANTHROPIC_API_KEY)
      throw new Error(
        "Live recording needs AI_MODE=live and ANTHROPIC_API_KEY (or pass --synthetic).",
      );
  }

  for (const sample of SAMPLES) {
    const ledger = createMemoryLedger();
    const ai = createAI({
      mode: "live",
      apiKey: synthetic ? "synthetic-no-network" : process.env.ANTHROPIC_API_KEY,
      ledger,
      record: true,
      recordOptions: synthetic
        ? { synthetic: true, note: SYNTHETIC_NOTE }
        : { synthetic: false, note: "Recorded live." },
      ...(synthetic
        ? {
            fetch: async (_input: unknown, init?: RequestInit) =>
              syntheticResponse(String(init?.body), sample.replies),
          }
        : {}),
    });
    await ai.run(sample.task, sample.input as never, sample.ctx);
    const cost = ledger.entries.reduce((sum, entry) => sum + entry.costUsd, 0);
    console.log(
      `${sample.task.padEnd(26)} ${ledger.entries.length} call(s) ` +
        `${ledger.entries.map((e) => e.attemptKind).join("+")}, $${cost.toFixed(4)}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
