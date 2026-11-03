import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVAL_GATE,
  type EvalGateFailure,
  type EvalGateResult,
  type EvalJudgement,
  type EvalMetrics,
  type NewEvalSample,
} from "@admitstory/shared";
import { inventedFacts } from "../fixtures/golden";
import { loadApplicant } from "../fixtures/load";
import type { MemoryLedger } from "../ledger";
import { repoRoot } from "../paths";
import { computeCost, hasPrice } from "../pricing";
import { tokenUsageFromApi, type ApiUsage } from "../ledger";
import type { AI, RunContext } from "../run";
import { getTask, type TaskName } from "../tasks";

/**
 * The evaluation harness (spec §8.11, Phase 9b). Two layers:
 *
 *  - The replay scan: every recorded reply under fixtures/llm-replays is re-validated against its
 *    task's current schema, the golden invented-fact check runs over kit.draft and kit.shortform,
 *    and per-call cost and repair rate are computed from the recorded usage. Free, no network.
 *  - Cases: fixed task inputs run through ai.run() (replay or live, whatever the AI is), then
 *    optionally judged by eval.judge. In replay mode this proves the recorded fixtures still match
 *    the prompts the app would send; in live mode it is the real §8.11 scoring run.
 *
 * compareToBaseline() applies §8.11's gate rules against fixtures/evals/baseline.json.
 */

export interface EvalCase {
  task: TaskName;
  /** e.g. `engineer-to-product/halvorsen`. */
  fixture: string;
  input: unknown;
  ctx?: RunContext;
  /** A judge case with an invention planted on purpose: the judge must find it. */
  seededInvention?: boolean;
}

interface ReplayFile {
  meta: { task: string; note?: string; synthetic?: boolean; model?: string };
  request: { model: string; messages: unknown[] };
  response: { body: string };
}

const KIT_TASKS = new Set(["kit.draft", "kit.shortform"]);

function replayDir(): string {
  return join(repoRoot(), "fixtures", "llm-replays");
}

function replayOutput(body: string): unknown {
  const parsed = JSON.parse(body) as {
    content?: { type: string; text?: string; input?: unknown }[];
    usage?: ApiUsage;
  };
  const block = parsed.content?.find((b) => b.type === "tool_use" || b.type === "text");
  if (!block) return null;
  return block.type === "tool_use" ? block.input : JSON.parse(block.text ?? "null");
}

function replayCost(file: ReplayFile): number {
  const body = JSON.parse(file.response.body) as { usage?: ApiUsage };
  if (!body.usage || !hasPrice(file.request.model)) return 0;
  return computeCost({ modelId: file.request.model, usage: tokenUsageFromApi(body.usage) });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

function goldenFor(
  task: string,
  output: unknown,
  note: string | undefined,
): { text: string; why: string }[] {
  if (!KIT_TASKS.has(task) || !note) return [];
  const applicant = /fictional ([a-z-]+) applicant/.exec(note)?.[1];
  const school = /fictional ([a-z-]+) pack/.exec(note)?.[1];
  if (!applicant || !school) return [];
  const packFile = join(repoRoot(), "packages/ai/scripts/samples", `${school}.compiled.txt`);
  if (!existsSync(packFile)) return [];
  const fixture = loadApplicant(applicant);
  return inventedFacts(output, {
    truth: fixture.groundTruth,
    profile: fixture.profile,
    pack: readFileSync(packFile, "utf8"),
  }).map((f) => ({ text: f.text, why: `${f.kind} not in the ground truth: "${f.sentence}"` }));
}

/** Every recorded reply, re-validated (the CI layer). */
export function scanReplays(opts: { tasks?: readonly string[] } = {}): {
  samples: NewEvalSample[];
  primaries: number;
  repairs: number;
  schemaFailures: number;
  costByTask: Record<string, number[]>;
} {
  const root = replayDir();
  const samples: NewEvalSample[] = [];
  const costByTask: Record<string, number[]> = {};
  let primaries = 0;
  let repairs = 0;
  let schemaFailures = 0;
  if (!existsSync(root)) return { samples, primaries, repairs, schemaFailures, costByTask };
  const tasks = readdirSync(root)
    .filter((task) => !opts.tasks || opts.tasks.includes(task))
    .sort();
  for (const task of tasks) {
    let def;
    try {
      def = getTask(task);
    } catch {
      continue;
    }
    for (const name of readdirSync(join(root, task))
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      const file = JSON.parse(readFileSync(join(root, task, name), "utf8")) as ReplayFile;
      const isRepair = file.request.messages.length > 1;
      if (isRepair) repairs += 1;
      else primaries += 1;
      const cost = replayCost(file);
      (costByTask[task] ??= []).push(cost);
      let output: unknown = null;
      let valid = false;
      try {
        output = replayOutput(file.response.body);
        valid = def.output.safeParse(output).success;
      } catch {
        valid = false;
      }
      // A first attempt that failed and was repaired is expected; only a final reply must parse.
      if (!valid && isRepair) schemaFailures += 1;
      const invented = valid ? goldenFor(task, output, file.meta.note) : [];
      samples.push({
        task,
        fixture: `${task}/${name.slice(0, 12)}`,
        output: null,
        judgement: null,
        invented,
        mustFix: 0,
        costUsd: cost,
        latencyMs: null,
        passed: (valid || !isRepair) && invented.length === 0,
      });
    }
  }
  return { samples, primaries, repairs, schemaFailures, costByTask };
}

function plainText(output: unknown): string {
  if (typeof output === "string") return output;
  const paragraphs = (value: unknown): string[] => {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.paragraphs))
      return (record.paragraphs as { sentences?: { text?: string }[] }[]).map((p) =>
        (p.sentences ?? []).map((s) => s.text ?? "").join(" "),
      );
    return Object.values(record).flatMap((v) =>
      Array.isArray(v) ? v.flatMap(paragraphs) : paragraphs(v),
    );
  };
  return paragraphs(output).join("\n\n").trim();
}

const SCORE_KEYS = ["story_quality", "voice_fidelity", "prompt_coverage", "school_fit"] as const;

/**
 * Runs the replay scan, then the cases through `ai` (and the judge over judge cases), stopping
 * the cases once `maxUsd` is spent. Never throws for a failing case: a failure is a sample.
 */
export async function runEvalSuite(opts: {
  mode: "replay" | "live";
  ai?: AI;
  ledger?: MemoryLedger;
  cases?: readonly EvalCase[];
  maxUsd?: number;
  tasks?: readonly string[];
}): Promise<{ metrics: EvalMetrics; samples: NewEvalSample[]; notes: string[] }> {
  const scan = scanReplays(opts.tasks ? { tasks: opts.tasks } : {});
  const samples: NewEvalSample[] = [...scan.samples];
  const notes: string[] = [];
  const costByTask = { ...scan.costByTask };
  const latencies: number[] = [];
  const judgeScores: number[] = [];
  let judged = 0;
  let mustFixTotal = 0;
  let schemaFailures = scan.schemaFailures;
  let primaries = scan.primaries;
  let repairs = scan.repairs;
  let inventedFacts = scan.samples.reduce((sum, s) => sum + s.invented.length, 0);

  const spent = () => opts.ledger?.entries.reduce((sum, e) => sum + e.costUsd, 0) ?? 0;
  for (const evalCase of opts.cases ?? []) {
    if (!opts.ai) break;
    if (opts.maxUsd !== undefined && spent() >= opts.maxUsd) {
      notes.push(`Stopped at the $${opts.maxUsd} cap before ${evalCase.task} ${evalCase.fixture}.`);
      break;
    }
    const before = opts.ledger?.entries.length ?? 0;
    const started = Date.now();
    let output: unknown = null;
    let error: string | null = null;
    try {
      output = await opts.ai.run(evalCase.task, evalCase.input as never, evalCase.ctx ?? {});
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const entries = opts.ledger?.entries.slice(before) ?? [];
    const cost = entries.reduce((sum, e) => sum + e.costUsd, 0);
    primaries += entries.filter((e) => e.attemptKind === "primary").length;
    repairs += entries.filter((e) => e.attemptKind === "repair").length;
    latencies.push(Date.now() - started);
    (costByTask[evalCase.task] ??= []).push(cost);

    if (error !== null) {
      schemaFailures += 1;
      notes.push(`${evalCase.task} ${evalCase.fixture}: ${error.slice(0, 300)}`);
      samples.push({
        task: evalCase.task,
        fixture: evalCase.fixture,
        output: { error: error.slice(0, 500) },
        judgement: null,
        invented: [],
        mustFix: 0,
        costUsd: cost,
        latencyMs: Date.now() - started,
        passed: false,
      });
      continue;
    }

    let judgement: EvalJudgement | null = null;
    let invented: { text: string; why: string }[] = [];
    let passed = true;
    if (evalCase.task === "eval.judge") {
      judgement = output as EvalJudgement;
      if (evalCase.seededInvention) {
        // The judge is under test: it must catch the planted invention.
        passed = judgement.invented_facts.length > 0;
        if (!passed) notes.push(`The judge missed the planted invention in ${evalCase.fixture}.`);
      } else {
        judged += 1;
        const { scores } = judgement;
        judgeScores.push(SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0) / SCORE_KEYS.length);
        mustFixTotal += judgement.must_fix.length;
        invented = judgement.invented_facts;
        inventedFacts += invented.length;
        passed = invented.length === 0;
      }
    } else if (KIT_TASKS.has(evalCase.task)) {
      const [applicant, school] = evalCase.fixture.split("/");
      invented = goldenFor(
        evalCase.task,
        output,
        applicant && school
          ? `fictional ${applicant} applicant, fictional ${school} pack`
          : undefined,
      );
      inventedFacts += invented.length;
      passed = invented.length === 0;
    }
    samples.push({
      task: evalCase.task,
      fixture: evalCase.fixture,
      // Synthetic fixture outputs only (never applicant content), so they can be stored and read.
      output: KIT_TASKS.has(evalCase.task) ? { text: plainText(output) } : output,
      judgement,
      invented,
      mustFix: judgement?.must_fix.length ?? 0,
      costUsd: cost,
      latencyMs: Date.now() - started,
      passed,
    });
  }

  const costUsdPerCall: Record<string, number> = {};
  for (const [task, costs] of Object.entries(costByTask))
    if (costs.length > 0)
      costUsdPerCall[task] =
        Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 1e6) / 1e6;
  const costUsdTotal = samples.reduce((sum, s) => sum + s.costUsd, 0);
  const metrics: EvalMetrics = {
    samples: samples.length,
    inventedFacts,
    inventedFactRate: samples.length === 0 ? 0 : inventedFacts / samples.length,
    mustFixRate: judged === 0 ? 0 : mustFixTotal / judged,
    judgeMean:
      judgeScores.length === 0
        ? null
        : Math.round((judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length) * 100) / 100,
    repairRate: primaries === 0 ? 0 : Math.round((repairs / primaries) * 1000) / 1000,
    costUsdTotal: Math.round(costUsdTotal * 1e5) / 1e5,
    costUsdPerCall,
    latencyP50Ms: opts.mode === "live" ? median(latencies) : null,
    schemaFailures,
  };
  return { metrics, samples, notes };
}

export function baselinePath(): string {
  return join(repoRoot(), "fixtures", "evals", "baseline.json");
}

export function loadBaseline(): EvalMetrics | null {
  const path = baselinePath();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as EvalMetrics;
}

/** §8.11's gate: no invented facts, no schema failures, no regression against the baseline. */
export function compareToBaseline(
  metrics: EvalMetrics,
  baseline: EvalMetrics | null,
  opts: { enforce: boolean; costApproved: boolean },
): EvalGateResult {
  const failures: EvalGateFailure[] = [];
  if (metrics.inventedFacts > EVAL_GATE.maxInventedFacts)
    failures.push({
      metric: "inventedFacts",
      rule: `at most ${EVAL_GATE.maxInventedFacts}`,
      baseline: baseline?.inventedFacts ?? null,
      value: metrics.inventedFacts,
    });
  if (metrics.schemaFailures > 0)
    failures.push({
      metric: "schemaFailures",
      rule: "none",
      baseline: baseline?.schemaFailures ?? null,
      value: metrics.schemaFailures,
    });
  if (baseline) {
    if (metrics.mustFixRate > baseline.mustFixRate + 1e-9)
      failures.push({
        metric: "mustFixRate",
        rule: "not above the baseline",
        baseline: baseline.mustFixRate,
        value: metrics.mustFixRate,
      });
    if (
      metrics.judgeMean !== null &&
      baseline.judgeMean !== null &&
      metrics.judgeMean < baseline.judgeMean - EVAL_GATE.judgeDrop
    )
      failures.push({
        metric: "judgeMean",
        rule: `no drop of more than ${EVAL_GATE.judgeDrop}`,
        baseline: baseline.judgeMean,
        value: metrics.judgeMean,
      });
    if (!opts.costApproved)
      for (const [task, cost] of Object.entries(metrics.costUsdPerCall)) {
        const before = baseline.costUsdPerCall[task];
        if (before !== undefined && before > 0 && cost > before * (1 + EVAL_GATE.costRise))
          failures.push({
            metric: `costUsdPerCall.${task}`,
            rule: `no rise of more than ${Math.round(EVAL_GATE.costRise * 100)}%`,
            baseline: before,
            value: cost,
          });
      }
  }
  return {
    passed: failures.length === 0,
    enforced: opts.enforce,
    failures,
    note: baseline ? null : "No baseline yet: only the absolute rules were checked.",
  };
}
