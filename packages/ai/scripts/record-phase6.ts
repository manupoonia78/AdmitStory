/**
 * Records the replay fixtures for the Phase 6 tasks (lor.extract, lor.plan, lor.brief,
 * lor.recommender_assist) from the fixed samples in samples/phase6.ts.
 *
 *   pnpm --filter @admitstory/ai record:phase6 --synthetic   # hand-authored replies, no network
 *   pnpm --filter @admitstory/ai record:phase6               # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *
 * Both paths go through ai.run(), so each fixture is keyed by exactly the request the app sends.
 * The synthetic replies are in samples/phase6-replies.ts; four samples include a repair turn.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, type RunContext, type TaskName } from "../src";
import { repoRoot } from "../src/paths";
import {
  ASSIST_COACH_INPUT,
  ASSIST_INPUT,
  LOR_BRIEF_REC1_INPUT,
  LOR_BRIEF_REC2_INPUT,
  LOR_EXTRACT_REC1_INPUT,
  LOR_EXTRACT_REC2_INPUT,
  LOR_PLAN_INPUT,
  PHASE6_CTX,
  PORTAL_CTX,
} from "./samples/phase6";
import {
  ASSIST_COACH_REPLY,
  ASSIST_REPLIES,
  LOR_BRIEF_REC1_REPLIES,
  LOR_BRIEF_REC2_REPLY,
  LOR_EXTRACT_REC1_REPLIES,
  LOR_EXTRACT_REC2_REPLY,
  LOR_PLAN_REPLIES,
} from "./samples/phase6-replies";
import { syntheticResponse } from "./samples/synthetic";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 6 was built), built from the " +
  "fictional engineer-to-product applicant and his fictional recommenders{school}. Re-record live: " +
  "pnpm --filter @admitstory/ai record:phase6";

export interface Phase6Sample {
  task: TaskName;
  input: unknown;
  ctx: RunContext;
  school: "halvorsen" | "marrowgate" | null;
  /** The first reply, then the reply to the repair turn when the first breaks a rule. */
  replies: readonly unknown[];
}

export const PHASE6_SAMPLES: readonly Phase6Sample[] = [
  {
    task: "lor.extract",
    input: LOR_EXTRACT_REC1_INPUT,
    ctx: PHASE6_CTX,
    school: null,
    replies: LOR_EXTRACT_REC1_REPLIES,
  },
  {
    task: "lor.extract",
    input: LOR_EXTRACT_REC2_INPUT,
    ctx: PHASE6_CTX,
    school: null,
    replies: [LOR_EXTRACT_REC2_REPLY],
  },
  {
    task: "lor.plan",
    input: LOR_PLAN_INPUT,
    ctx: PHASE6_CTX,
    school: "halvorsen",
    replies: LOR_PLAN_REPLIES,
  },
  {
    task: "lor.brief",
    input: LOR_BRIEF_REC1_INPUT,
    ctx: PHASE6_CTX,
    school: "halvorsen",
    replies: LOR_BRIEF_REC1_REPLIES,
  },
  {
    task: "lor.brief",
    input: LOR_BRIEF_REC2_INPUT,
    ctx: PHASE6_CTX,
    school: "marrowgate",
    replies: [LOR_BRIEF_REC2_REPLY],
  },
  {
    task: "lor.recommender_assist",
    input: ASSIST_INPUT,
    ctx: PORTAL_CTX,
    school: "halvorsen",
    replies: ASSIST_REPLIES,
  },
  {
    task: "lor.recommender_assist",
    input: ASSIST_COACH_INPUT,
    ctx: PORTAL_CTX,
    school: "marrowgate",
    replies: [ASSIST_COACH_REPLY],
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

  for (const sample of PHASE6_SAMPLES) {
    const ledger = createMemoryLedger();
    const school = sample.school ? ` and the fictional ${sample.school} school` : "";
    const ai = createAI({
      mode: "live",
      apiKey: synthetic ? "synthetic-no-network" : process.env.ANTHROPIC_API_KEY,
      ledger,
      record: true,
      recordOptions: synthetic
        ? { synthetic: true, note: SYNTHETIC_NOTE.replace("{school}", school) }
        : { synthetic: false, note: `Recorded live (engineer-to-product${school}).` },
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

if (process.argv[1]?.endsWith("record-phase6.ts"))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    if (error && typeof error === "object" && "issues" in error)
      console.error(JSON.stringify((error as { issues: unknown }).issues, null, 2));
    process.exitCode = 1;
  });
