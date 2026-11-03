/**
 * Records the replay fixtures for the Phase 5 tasks (forms.advise, resume.review) from the fixed
 * samples in samples/phase5.ts.
 *
 *   pnpm --filter @admitstory/ai record:phase5 --synthetic   # hand-authored replies, no network
 *   pnpm --filter @admitstory/ai record:phase5               # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *
 * Both paths go through ai.run(), so each fixture is keyed by exactly the request the app sends.
 * The synthetic replies are in samples/phase5-replies.ts; two samples include a repair turn.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, type RunContext, type TaskName } from "../src";
import { repoRoot } from "../src/paths";
import {
  FORMS_ADVISE_COACH_INPUT,
  FORMS_ADVISE_INPUT,
  PHASE5_CTX,
  RESUME_CTX,
  RESUME_REVIEW_INPUT,
} from "./samples/phase5";
import {
  FORMS_ADVISE_COACH_REPLY,
  FORMS_ADVISE_REPLIES,
  RESUME_REVIEW_REPLIES,
} from "./samples/phase5-replies";
import { syntheticResponse } from "./samples/synthetic";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 5 was built), built from the " +
  "fictional engineer-to-product applicant{school}. Re-record live: " +
  "pnpm --filter @admitstory/ai record:phase5";

export interface Phase5Sample {
  task: TaskName;
  input: unknown;
  ctx: RunContext;
  school: "halvorsen" | null;
  /** The first reply, then the reply to the repair turn when the first breaks a rule. */
  replies: readonly unknown[];
}

export const PHASE5_SAMPLES: readonly Phase5Sample[] = [
  {
    task: "forms.advise",
    input: FORMS_ADVISE_INPUT,
    ctx: PHASE5_CTX,
    school: "halvorsen",
    replies: FORMS_ADVISE_REPLIES,
  },
  {
    task: "forms.advise",
    input: FORMS_ADVISE_COACH_INPUT,
    ctx: PHASE5_CTX,
    school: "halvorsen",
    replies: [FORMS_ADVISE_COACH_REPLY],
  },
  {
    task: "resume.review",
    input: RESUME_REVIEW_INPUT,
    ctx: RESUME_CTX,
    school: null,
    replies: RESUME_REVIEW_REPLIES,
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

  for (const sample of PHASE5_SAMPLES) {
    const ledger = createMemoryLedger();
    const school = sample.school ? ` and the fictional ${sample.school} pack` : "";
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

if (process.argv[1]?.endsWith("record-phase5.ts"))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    if (error && typeof error === "object" && "issues" in error)
      console.error(JSON.stringify((error as { issues: unknown }).issues, null, 2));
    process.exitCode = 1;
  });
