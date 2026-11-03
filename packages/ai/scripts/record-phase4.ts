/**
 * Records the replay fixtures for the Phase 4 writing tasks from the fixed samples in
 * samples/phase4.ts.
 *
 *   pnpm --filter @admitstory/ai record:phase4 --synthetic   # hand-authored replies, no network
 *   pnpm --filter @admitstory/ai record:phase4               # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *
 * Both paths go through ai.run(), so each fixture is keyed by exactly the request the app sends.
 * The synthetic replies are in samples/phase4-replies.ts; three samples include a repair turn.
 * Each fixture's note names the fixture applicant and school, which the golden-set test reads.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, type RunContext, type TaskName } from "../src";
import { repoRoot } from "../src/paths";
import {
  DRAFT_NEED_FILL_INPUT,
  DRAFT_REVISE_INPUT,
  HALVORSEN_CTX,
  KESTREL_CTX,
  KIT_ANGLES_INPUT,
  KIT_CRITIC_INPUT,
  KIT_DRAFT_COACH_INPUT,
  KIT_DRAFT_INPUT,
  KIT_GAPS_INPUT,
  KIT_SHORTFORM_INPUT,
  UTIL_CLASSIFY_INPUT,
} from "./samples/phase4";
import {
  DRAFT_NEED_FILL_REPLY,
  DRAFT_REVISE_REPLIES,
  KIT_ANGLES_REPLY,
  KIT_CRITIC_REPLY,
  KIT_DRAFT_COACH_REPLY,
  KIT_DRAFT_REPLIES,
  KIT_GAPS_REPLY,
  KIT_SHORTFORM_REPLIES,
  UTIL_CLASSIFY_REPLY,
} from "./samples/phase4-replies";
import { syntheticResponse } from "./samples/synthetic";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 4 was built), built from the " +
  "fictional engineer-to-product applicant and the fictional {school} pack. Re-record live: " +
  "pnpm --filter @admitstory/ai record:phase4";

export interface Phase4Sample {
  task: TaskName;
  input: unknown;
  ctx: RunContext;
  /** The fixture school the sample writes for: the golden-set test checks against its pack. */
  school: "halvorsen" | "kestrel-lake";
  /** The first reply, then the reply to the repair turn when the first breaks a rule. */
  replies: readonly unknown[];
}

export const PHASE4_SAMPLES: readonly Phase4Sample[] = [
  {
    task: "kit.gaps",
    input: KIT_GAPS_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: [KIT_GAPS_REPLY],
  },
  {
    task: "kit.angles",
    input: KIT_ANGLES_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: [KIT_ANGLES_REPLY],
  },
  {
    task: "kit.draft",
    input: KIT_DRAFT_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: KIT_DRAFT_REPLIES,
  },
  {
    task: "kit.draft",
    input: KIT_DRAFT_COACH_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: [KIT_DRAFT_COACH_REPLY],
  },
  {
    task: "kit.shortform",
    input: KIT_SHORTFORM_INPUT,
    ctx: KESTREL_CTX,
    school: "kestrel-lake",
    replies: KIT_SHORTFORM_REPLIES,
  },
  {
    task: "kit.critic",
    input: KIT_CRITIC_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: [KIT_CRITIC_REPLY],
  },
  {
    task: "draft.revise",
    input: DRAFT_REVISE_INPUT,
    ctx: { schoolPack: HALVORSEN_CTX.schoolPack },
    school: "halvorsen",
    replies: DRAFT_REVISE_REPLIES,
  },
  {
    task: "draft.need_fill",
    input: DRAFT_NEED_FILL_INPUT,
    ctx: HALVORSEN_CTX,
    school: "halvorsen",
    replies: [DRAFT_NEED_FILL_REPLY],
  },
  {
    task: "util.classify",
    input: UTIL_CLASSIFY_INPUT,
    ctx: {},
    school: "halvorsen",
    replies: [UTIL_CLASSIFY_REPLY],
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

  for (const sample of PHASE4_SAMPLES) {
    const ledger = createMemoryLedger();
    const ai = createAI({
      mode: "live",
      apiKey: synthetic ? "synthetic-no-network" : process.env.ANTHROPIC_API_KEY,
      ledger,
      record: true,
      recordOptions: synthetic
        ? { synthetic: true, note: SYNTHETIC_NOTE.replace("{school}", sample.school) }
        : { synthetic: false, note: `Recorded live (engineer-to-product, ${sample.school}).` },
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

if (process.argv[1]?.endsWith("record-phase4.ts"))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    if (error && typeof error === "object" && "issues" in error)
      console.error(JSON.stringify((error as { issues: unknown }).issues, null, 2));
    process.exitCode = 1;
  });
