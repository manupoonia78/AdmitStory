// Escalation (spec §8.3): "if the Critic scores a draft below threshold on structural rules twice,
// regenerate once on the escalation route. Never more than one escalation per deliverable per
// request." The kit pipeline keeps the Critic reports for one deliverable in one request and asks
// selectEscalation what to do after each; ai.run(task, input, {escalate: true}) then runs on the
// route's escalation choice. Pure: no model calls, no I/O.

import type { CriticReport } from "@admitstory/shared/kit";
import { ROUTES, type ModelChoice, type Route, type RouteTask } from "./routing";

/** A structural score below this fails (scores are 1–5). */
export const CRITIC_PASS_SCORE = 3;

/** Consecutive structural failures before the one escalation. */
export const FAILS_BEFORE_ESCALATION = 2;

/**
 * Rules about the essay's structure rather than its surface (§8.8): a must-fix on any of these
 * fails the draft even when the scores pass. Mechanical rules (limit, banned phrases) are fixed
 * by the auto-fix pass instead, so they never escalate.
 */
export const STRUCTURAL_RULES: ReadonlySet<string> = new Set([
  "promptParts",
  "openingThesis",
  "endingSummary",
  "contextRatio",
  "weHiding",
  "storyReuse",
]);

type CriticResult = Pick<CriticReport, "findings" | "scores">;

/** True when the Critic says the draft's structure is below threshold. */
export function criticFailsStructure(report: CriticResult): boolean {
  const { answers_prompt, story_quality } = report.scores;
  if (answers_prompt < CRITIC_PASS_SCORE || story_quality < CRITIC_PASS_SCORE) return true;
  return report.findings.some((f) => f.severity === "must" && STRUCTURAL_RULES.has(f.rule_id));
}

export interface EscalationState {
  /** The Critic's reports on this deliverable in this request, oldest first. */
  reports: readonly CriticResult[];
  /** Whether this deliverable has already been regenerated on the escalation route. */
  escalated: boolean;
}

export type EscalationDecision =
  /** The latest draft passes: keep it. */
  | { action: "accept" }
  /** One failure so far: auto-fix or regenerate on the normal route, then critique again. */
  | { action: "retry" }
  /** Failed twice: regenerate once with ai.run(task, input, {escalate: true}). */
  | { action: "escalate"; choice: ModelChoice }
  /** Failed after the escalation, or no escalation route: keep the draft and show the findings. */
  | { action: "keep"; reason: string };

function trailingFailures(reports: readonly CriticResult[]): number {
  let count = 0;
  for (let i = reports.length - 1; i >= 0; i -= 1) {
    const report = reports[i];
    if (!report || !criticFailsStructure(report)) break;
    count += 1;
  }
  return count;
}

/** `route` defaults to the task's static route; pass the resolved one when admin overrides apply. */
export function selectEscalation(
  task: RouteTask,
  state: EscalationState,
  route: Pick<Route, "escalation"> = ROUTES[task],
): EscalationDecision {
  const last = state.reports.at(-1);
  if (!last || !criticFailsStructure(last)) return { action: "accept" };
  if (state.escalated)
    return { action: "keep", reason: "Already escalated once for this deliverable" };
  if (trailingFailures(state.reports) < FAILS_BEFORE_ESCALATION) return { action: "retry" };
  const choice = route.escalation;
  if (!choice) return { action: "keep", reason: `${task} has no escalation route` };
  return { action: "escalate", choice };
}
