// The AI-tell index (spec §8.8): one "Sounds like you / Sounds generated" indicator built from
// the deterministic tells in Appendix A13: banned phrases, three-part lists, flat rhythm, heavy
// dashes, a thesis opening, a summary ending, and the TELL-02/03 constructions and formatting.
//
// It is guidance for authenticity. It is never presented as, or marketed as, a prediction of what
// any AI detector will say: §14.5 rules out "undetectable" and its cousins.

import {
  bannedPhrases,
  constructions,
  dashDensity,
  endingSummary,
  formatting,
  openingThesis,
  rhythm,
  tripletDensity,
} from "./linters/style";
import type { DraftDoc, RuleId } from "./types";

export type AiTellVerdict = "sounds_like_you" | "mixed" | "sounds_generated";

export const AI_TELL_LABELS: Record<AiTellVerdict, string> = {
  sounds_like_you: "Sounds like you",
  mixed: "Mixed",
  sounds_generated: "Sounds generated",
};

export const AI_TELL_NOTE =
  "A guide to how natural the writing reads, from patterns common in generated text. It doesn't predict what any detector will say.";

export interface AiTellReason {
  rule_id: RuleId;
  /** How much this pattern added to the score. */
  weight: number;
  explanation: string;
}

export interface AiTellIndex {
  verdict: AiTellVerdict;
  label: string;
  score: number;
  reasons: AiTellReason[];
  note: string;
}

/**
 * Weights: a banned phrase is 1 each (up to 3), structural tells (three-part lists, flat rhythm)
 * 1.5, the rest 1, constructions 0.5 each (up to 1.5). Under 2 sounds like you; 4 or more sounds
 * generated. One stray phrase or one thesis opening alone never tips a draft into "generated";
 * it takes two or three independent patterns together.
 */
const WEIGHTS: Partial<Record<RuleId, { each: number; cap: number }>> = {
  bannedPhrases: { each: 1, cap: 3 },
  tripletDensity: { each: 1.5, cap: 1.5 },
  rhythm: { each: 1.5, cap: 1.5 },
  dashDensity: { each: 1, cap: 1 },
  openingThesis: { each: 1, cap: 1 },
  endingSummary: { each: 1, cap: 1 },
  formatting: { each: 1, cap: 1 },
  constructions: { each: 0.5, cap: 1.5 },
};

export const AI_TELL_THRESHOLDS = { mixed: 2, generated: 4 } as const;

export function aiTellIndex(draft: DraftDoc): AiTellIndex {
  const findings = [
    ...bannedPhrases(draft),
    ...tripletDensity(draft),
    ...rhythm(draft),
    ...dashDensity(draft),
    ...openingThesis(draft),
    ...endingSummary(draft),
    ...formatting(draft),
    ...constructions(draft),
  ];
  const reasons: AiTellReason[] = [];
  for (const [rule, w] of Object.entries(WEIGHTS) as [RuleId, { each: number; cap: number }][]) {
    const hits = findings.filter((f) => f.rule_id === rule);
    if (hits.length === 0) continue;
    const weight = Math.min(w.cap, hits.length * w.each);
    const first = hits[0]?.explanation ?? "";
    const explanation =
      hits.length > 1 && rule === "bannedPhrases"
        ? `${hits.length} phrases that make essays sound generated.`
        : first;
    reasons.push({ rule_id: rule, weight, explanation });
  }
  reasons.sort((a, b) => b.weight - a.weight);
  const score = reasons.reduce((n, r) => n + r.weight, 0);
  const verdict: AiTellVerdict =
    score >= AI_TELL_THRESHOLDS.generated
      ? "sounds_generated"
      : score >= AI_TELL_THRESHOLDS.mixed
        ? "mixed"
        : "sounds_like_you";
  return { verdict, label: AI_TELL_LABELS[verdict], score, reasons, note: AI_TELL_NOTE };
}
