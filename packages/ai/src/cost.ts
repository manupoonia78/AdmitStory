// What one kit cost, from its usage_ledger rows, against the spec's unit-cost model (§12.2) and
// guardrails (§12.4). Pure: the Phase 4 AC ("cost per kit in the ledger within the 12.2 range on
// fixtures") and the admin cost view call it with rows they already loaded.

import { BUDGET_CAPS } from "./budget";

/** §12.2 "One School Kit": the generation stages and their estimates in USD. */
export const KIT_GENERATION_ESTIMATE_USD = {
  "kit.positioning_filemap": 0.2,
  "kit.gaps": 0.05,
  "kit.angles": 0.12,
  "kit.draft": 0.75,
  "kit.shortform": 0.05,
  "kit.critic": 0.4,
  // Stage 9 (forms, resume, recommender briefs, interview plan): Phases 5–7.
  "forms.advise": 0.05,
  "resume.review": 0.05,
  "lor.brief": 0.1,
  "interview.plan": 0.05,
} as const;

/** §12.2's "Kit generation subtotal ≈ $1.8". */
export const KIT_GENERATION_TYPICAL_USD = 1.8;

/**
 * The range a fixture kit's generation cost must fall in. §12.2 gives a point estimate and says
 * to verify against the ledger; ±50% around it is our reading of "within the range", and the
 * floor keeps a kit that skipped stages (no drafts ran) from passing.
 */
export const KIT_GENERATION_RANGE_USD = { low: 0.9, high: 2.7 } as const;

/** §12.2 refinements and NEED answers run after generation. */
const AFTER_GENERATION = new Set(["draft.revise", "draft.need_fill", "util.classify"]);

export interface KitLedgerRow {
  task: string;
  costUsd: number;
  attemptKind?: string;
}

export interface KitCostEstimate {
  totalUsd: number;
  /** Stages 2–9 of §5.7 (the kit.* agents and stage 9's agents). */
  generationUsd: number;
  /** Refinements, NEED answers and their classifier calls. */
  refinementUsd: number;
  /** Everything else billed to the kit (drills, mocks, embeddings…). */
  otherUsd: number;
  byTask: Record<string, { calls: number; usd: number }>;
  /** Repair, fallback and escalation attempts, which the estimates leave out. */
  extraAttempts: number;
  generationInRange: boolean;
  /** §12.4: the soft cap downgrades drafts, the hard cap blocks new expensive actions. */
  underSoftCap: boolean;
  underHardCap: boolean;
}

const round = (usd: number) => Math.round(usd * 1e6) / 1e6;

export function estimateKitCost(rows: readonly KitLedgerRow[]): KitCostEstimate {
  const byTask: Record<string, { calls: number; usd: number }> = {};
  let generation = 0;
  let refinement = 0;
  let other = 0;
  let extraAttempts = 0;
  for (const row of rows) {
    const entry = (byTask[row.task] ??= { calls: 0, usd: 0 });
    entry.calls += 1;
    entry.usd = round(entry.usd + row.costUsd);
    if (row.attemptKind && row.attemptKind !== "primary") extraAttempts += 1;
    if (Object.hasOwn(KIT_GENERATION_ESTIMATE_USD, row.task)) generation += row.costUsd;
    else if (AFTER_GENERATION.has(row.task)) refinement += row.costUsd;
    else other += row.costUsd;
  }
  const total = generation + refinement + other;
  return {
    totalUsd: round(total),
    generationUsd: round(generation),
    refinementUsd: round(refinement),
    otherUsd: round(other),
    byTask,
    extraAttempts,
    generationInRange:
      generation >= KIT_GENERATION_RANGE_USD.low && generation <= KIT_GENERATION_RANGE_USD.high,
    underSoftCap: total < BUDGET_CAPS.kitSoftUsd,
    underHardCap: total < BUDGET_CAPS.kitHardUsd,
  };
}
