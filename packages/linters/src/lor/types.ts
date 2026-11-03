// The Recommender Kit's deterministic overlap check and voice profile (Phase 6 plan §3, decision
// 17): types and thresholds. The foundation owns this file; package E implements overlap.ts and
// voice.ts against it.

import type { RecommenderVoice } from "@admitstory/shared/kit";

export type { RecommenderVoice };

/** One talking point of one recommender's brief, flattened for the overlap check. */
export interface LorFacetPoint {
  recommenderId: string;
  /** The recommender's display name, for explanations ("Ravi"). */
  recommenderLabel: string;
  groupKey: string;
  questionId: string;
  /** The point's index within its question. */
  index: number;
  /** The story code it draws on (R## or S##), or null. */
  story: string | null;
  /** The trait id it supports. */
  trait: string;
  facet: string;
  /** point + evidence. */
  text: string;
}

/** One essay deliverable, with the stories each paragraph tells. */
export interface LorEssayFacet {
  deliverableId: string;
  label: string;
  primaryStory: string | null;
  traits: string[];
  paragraphs: { id: string; text: string; stories: string[] }[];
}

export interface LorOverlapInput {
  points: readonly LorFacetPoint[];
  essays: readonly LorEssayFacet[];
  /** Finding ids the applicant marked "These are different". */
  dismissed?: ReadonlySet<string>;
}

export interface LorOverlapFinding {
  /** "lor:<fnv1a>", stable across input order. */
  id: string;
  kind: "brief_brief" | "brief_essay";
  severity: "should";
  story: string;
  facet: string;
  a: LorFacetPoint;
  b: LorFacetPoint | { deliverableId: string; label: string; paragraphId: string | null };
  explanation: string;
  fix_hint: string;
}

/** Between two talking points on the same story. */
export const LOR_FACET_SIMILARITY = 0.5;
/** Between a talking point and an essay paragraph on the same story. */
export const LOR_ESSAY_SIMILARITY = 0.35;
