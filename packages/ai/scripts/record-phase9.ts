/**
 * Records the replay fixtures for the Phase 9b task eval.judge from the fixed samples in
 * samples/phase9.ts.
 *
 *   pnpm --filter @admitstory/ai record:phase9 --synthetic   # hand-authored replies, no network
 *   pnpm --filter @admitstory/ai record:phase9               # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *
 * Both paths go through ai.run(), so each fixture is keyed by exactly the request the harness
 * sends. The synthetic replies are in samples/phase9-replies.ts; one sample includes a repair turn.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, type RunContext, type TaskName } from "../src";
import { repoRoot } from "../src/paths";
import {
  EVAL_JUDGE_CLEAN_INPUT,
  EVAL_JUDGE_INVENTED_INPUT,
  EVAL_JUDGE_SHORT_INPUT,
  PHASE9_CTX,
} from "./samples/phase9";
import {
  EVAL_JUDGE_CLEAN_REPLY,
  EVAL_JUDGE_INVENTED_REPLY,
  EVAL_JUDGE_SHORT_REPLIES,
} from "./samples/phase9-replies";
import { syntheticResponse } from "./samples/synthetic";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 9b was built), judging the " +
  "fictional engineer-to-product applicant's Halvorsen draft. Re-record live: " +
  "pnpm --filter @admitstory/ai record:phase9";

export interface Phase9Sample {
  task: TaskName;
  input: unknown;
  ctx: RunContext;
  replies: readonly unknown[];
}

export const PHASE9_SAMPLES: readonly Phase9Sample[] = [
  {
    task: "eval.judge",
    input: EVAL_JUDGE_CLEAN_INPUT,
    ctx: PHASE9_CTX,
    replies: [EVAL_JUDGE_CLEAN_REPLY],
  },
  {
    task: "eval.judge",
    input: EVAL_JUDGE_INVENTED_INPUT,
    ctx: PHASE9_CTX,
    replies: [EVAL_JUDGE_INVENTED_REPLY],
  },
  {
    task: "eval.judge",
    input: EVAL_JUDGE_SHORT_INPUT,
    ctx: PHASE9_CTX,
    replies: EVAL_JUDGE_SHORT_REPLIES,
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

  for (const sample of PHASE9_SAMPLES) {
    const ledger = createMemoryLedger();
    const ai = createAI({
      mode: "live",
      apiKey: synthetic ? "synthetic-no-network" : process.env.ANTHROPIC_API_KEY,
      ledger,
      record: true,
      recordOptions: synthetic
        ? { synthetic: true, note: SYNTHETIC_NOTE }
        : { synthetic: false, note: "Recorded live (engineer-to-product, Halvorsen)." },
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

if (process.argv[1]?.endsWith("record-phase9.ts"))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    if (error && typeof error === "object" && "issues" in error)
      console.error(JSON.stringify((error as { issues: unknown }).issues, null, 2));
    process.exitCode = 1;
  });
