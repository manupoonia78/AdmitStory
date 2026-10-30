import "server-only";

import { getDb, listFacts } from "@admitstory/db";
import { COVERAGE_LABELS, atLeast, type CoverageId } from "@admitstory/shared";
import { scoreSlots } from "@admitstory/slots";
import { loadKnowledge } from "./state";

// The end-of-session summary card (spec §5.2): "That's a strong start: 9 stories and 61 facts.
// Next, see how admissions will read your profile." Plus what is still thin, which is the thing
// that brings someone back for another ten minutes.

export interface StudioSummary {
  storyCount: number;
  factCount: number;
  confirmedFactCount: number;
  conflictCount: number;
  coverage: { id: CoverageId; label: string; level: string }[];
  /** Lenses not yet at "partial" (spec §5.2 AC). */
  thinLenses: { id: CoverageId; label: string }[];
  /** The most valuable things still missing, as plain sentences with a time estimate. */
  nextUp: { slot: string; what: string; minutes: number }[];
  /** How many stories are waiting on one detail. */
  partialStoryCount: number;
}

/** Roughly how long one answer takes, for "5 minutes next time?" (spec §5.2). */
const MINUTES_PER_SLOT = 3;

export async function sessionSummary(userId: string): Promise<StudioSummary> {
  const knowledge = await loadKnowledge(userId);
  const facts = await listFacts(getDb(), userId);

  const coverage = knowledge.coverage.map((bar) => ({
    id: bar.id,
    label: COVERAGE_LABELS[bar.id],
    level: bar.level,
  }));

  const thinLenses = knowledge.coverage
    .filter((bar) => !atLeast(bar.level, "partial"))
    .map((bar) => ({ id: bar.id, label: COVERAGE_LABELS[bar.id] }));

  // The three slots the selector would ask about next, described rather than scored.
  const nextUp = scoreSlots({ states: knowledge.states, now: new Date() })
    .filter((score) => score.score > 0)
    .slice(0, 3)
    .map((score) => ({
      slot: score.slot.key,
      what: describeSlot(score.slot.key),
      minutes: MINUTES_PER_SLOT,
    }));

  return {
    storyCount: knowledge.stories.filter((story) => story.mergedInto === null).length,
    factCount: facts.length,
    confirmedFactCount: facts.filter((fact) => fact.status === "confirmed").length,
    conflictCount: facts.filter((fact) => fact.status === "conflict").length,
    coverage,
    thinLenses,
    nextUp,
    partialStoryCount: knowledge.stories.filter((story) => story.status === "partial").length,
  };
}

/**
 * What a slot is, in the applicant's words rather than ours — "a setback story", not
 * "failure.consequential". Falls back to the key, prettified, for anything not listed.
 */
const SLOT_DESCRIPTIONS: Record<string, string> = {
  "failure.consequential": "a setback story",
  "leadership.originated_idea": "a time you started something",
  "leadership.persuaded_up": "a time you changed a senior person's mind",
  "leadership.developed_others": "someone you helped grow",
  "impact.biggest": "the work you're proudest of",
  "numbers.impact": "the numbers behind your impact",
  "self.feedback": "feedback that changed how you work",
  "support.someone_hard": "a time you supported someone when it was hard",
  "goals.short_term": "what you want to do after your MBA",
  "goals.long_term": "where you want to get to",
  "goals.origin": "where that goal came from",
  "goals.plan_b": "your Plan B",
  "why.gap": "what you can't do yet",
  "why.now": "why now",
  "identity.root": "where you grew up",
  "identity.turning_point": "a moment that changed how you think",
  "values.dilemma": "a time the right thing cost you something",
  "community.built": "something you built outside work",
  "fit.reasons": "the schools you're considering",
  "fit.conversations": "people you've spoken to at your schools",
  "fit.contribution": "what you'd do on campus",
  "academics.quant_evidence": "your most quantitative work",
  "lor.candidates": "who could recommend you",
};

export function describeSlot(key: string): string {
  return SLOT_DESCRIPTIONS[key] ?? key.split(".").slice(1).join(" ").replace(/_/g, " ");
}

/** Spec §5.2: "We don't yet have a setback story — 5 minutes next time?" */
export function thinMaterialLine(summary: StudioSummary): string | null {
  const [first] = summary.nextUp;
  if (!first) return null;
  const minutes = Math.max(5, summary.nextUp.length * MINUTES_PER_SLOT);
  return `We don't yet have ${first.what} — ${minutes} minutes next time?`;
}
