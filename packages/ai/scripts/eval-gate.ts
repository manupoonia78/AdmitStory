/**
 * The §8.11 evaluation gate.
 *
 *   pnpm --filter @admitstory/ai eval:gate                      # replay (CI): free, no network
 *   pnpm --filter @admitstory/ai eval:gate --live               # live scoring (needs AI_MODE=live + key)
 *   pnpm --filter @admitstory/ai eval:gate --update-baseline    # write fixtures/evals/baseline.json
 *
 * Replay mode re-validates every recorded reply, runs the golden invented-fact check, and runs
 * every Phase 4–9 sample through ai.run() in replay, which fails if a prompt changed without its
 * fixtures being re-recorded. Live mode runs the same samples live, capped at $5 (EVAL_MAX_USD),
 * with eval.judge scoring the fixed judge samples. Either way the metrics are compared with the
 * baseline; EVAL_COST_APPROVED=1 waives the cost-rise rule for one run.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  baselinePath,
  compareToBaseline,
  createAI,
  createMemoryLedger,
  loadBaseline,
  runEvalSuite,
  type EvalCase,
} from "../src";
import { repoRoot } from "../src/paths";
import { PHASE4_SAMPLES } from "./record-phase4";
import { PHASE5_SAMPLES } from "./record-phase5";
import { PHASE6_SAMPLES } from "./record-phase6";
import { PHASE9_SAMPLES } from "./record-phase9";

const APPLICANT = "engineer-to-product";

function cases(): EvalCase[] {
  const fromSchool = (school: string | null | undefined) => `${APPLICANT}/${school ?? "none"}`;
  return [
    ...PHASE4_SAMPLES.map((s) => ({
      task: s.task,
      fixture: fromSchool(s.school),
      input: s.input,
      ctx: s.ctx,
    })),
    ...PHASE5_SAMPLES.map((s) => ({
      task: s.task,
      fixture: fromSchool(s.school),
      input: s.input,
      ctx: s.ctx,
    })),
    ...PHASE6_SAMPLES.map((s) => ({
      task: s.task,
      fixture: fromSchool(s.school),
      input: s.input,
      ctx: s.ctx,
    })),
    ...PHASE9_SAMPLES.map((s, i) => ({
      task: s.task,
      fixture: `${APPLICANT}/judge-${i + 1}`,
      input: s.input,
      ctx: s.ctx,
      seededInvention: i === 1,
    })),
  ];
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");
  const updateBaseline = process.argv.includes("--update-baseline");
  if (live) {
    const env = join(repoRoot(), ".env.local");
    if (existsSync(env)) process.loadEnvFile(env);
    if (process.env.AI_MODE !== "live" || !process.env.ANTHROPIC_API_KEY) {
      console.log("Live evals need AI_MODE=live and ANTHROPIC_API_KEY. Skipping.");
      return;
    }
  }
  const ledger = createMemoryLedger();
  const ai = createAI(
    live
      ? { mode: "live", apiKey: process.env.ANTHROPIC_API_KEY, ledger }
      : { mode: "replay", ledger },
  );
  const { metrics, samples, notes } = await runEvalSuite({
    mode: live ? "live" : "replay",
    ai,
    ledger,
    cases: cases(),
    maxUsd: Number(process.env.EVAL_MAX_USD ?? 5),
  });

  const baseline = loadBaseline();
  const gate = compareToBaseline(metrics, baseline, {
    enforce: true,
    costApproved: process.env.EVAL_COST_APPROVED === "1",
  });

  const failed = samples.filter((s) => !s.passed);
  console.log(
    `Eval gate (${live ? "live" : "replay"}): ${samples.length} samples, ${failed.length} failed.`,
  );
  console.log(JSON.stringify(metrics, null, 2));
  for (const sample of failed)
    console.log(
      `  ✗ ${sample.task} ${sample.fixture}${sample.invented.length ? `: ${sample.invented.map((i) => i.text).join("; ")}` : ""}`,
    );
  for (const note of notes) console.log(`  · ${note}`);
  if (gate.note) console.log(`  · ${gate.note}`);
  for (const failure of gate.failures)
    console.log(
      `  ✗ ${failure.metric}: ${failure.value} (rule: ${failure.rule}; baseline ${failure.baseline ?? "none"})`,
    );

  if (updateBaseline) {
    writeFileSync(baselinePath(), JSON.stringify(metrics, null, 2) + "\n");
    console.log(`Baseline written to ${baselinePath()}.`);
    return;
  }
  const judgeMissed = notes.some((n) => n.startsWith("The judge missed"));
  if (!gate.passed || judgeMissed) {
    console.log("Gate: FAILED");
    process.exitCode = 1;
  } else console.log("Gate: passed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
