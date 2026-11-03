// The shapes of the kit agents' output (spec Appendix I), as plain TypeScript. Browser code reads
// these to render a kit; the Zod validators that check model output against them live in
// `./schemas.ts` and reach the app only through `@admitstory/shared/schemas`, which no client
// component imports (a top-level `z.enum()` cannot be tree-shaken out of a route's first load).
//
// Field names are snake_case because they are the JSON the models write and the jsonb we store.

import type { LensId } from "../lenses";
import type { TraitId } from "../traits";

/** A provenance code: "F12" | "S03" | "L041" | "K17" | "C2" | "P3" (spec §8.7). */
export type Cite = string;

/** Where the Strategist plans to address a red flag (Appendix I `Positioning.red_flags`). */
export const ADDRESS_IN = [
  "essay",
  "short_answer",
  "form",
  "recommender",
  "optional",
  "not_addressed",
] as const;
export type AddressIn = (typeof ADDRESS_IN)[number];

export const ANGLE_LABELS = ["A", "B", "C"] as const;
export type AngleLabel = (typeof ANGLE_LABELS)[number];

/** How much of a sentence is the applicant's: their words, their words reshaped, or written for them. */
export const SENTENCE_KINDS = ["verbatim", "adapted", "composed"] as const;
export type SentenceKind = (typeof SENTENCE_KINDS)[number];

export const FINDING_SEVERITIES = ["must", "should", "consider"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const PATCH_OPS = ["replace", "insert_after", "delete"] as const;
export type PatchOp = (typeof PATCH_OPS)[number];

/**
 * Numeric ranges the structured-output JSON Schema cannot carry (Appendix I note). The Zod
 * validators enforce them after parsing; the UI uses them to draw scales.
 */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
/** §8.5.5: "lead_traits: 2–3 of the applicant's brand traits". */
export const LEAD_TRAITS_MIN = 2;
export const LEAD_TRAITS_MAX = 3;

/* Positioning and file map (kit.positioning_filemap, §8.5.5) --------------------------------- */

export interface CitedText {
  text: string;
  cites: Cite[];
}

export interface Positioning {
  must_see: CitedText[];
  lead_traits: { trait: TraitId; why: string; cites: Cite[] }[];
  red_flags: { flag: string; address_in: AddressIn; how: string }[];
  career_lane_check: {
    short_term: string;
    realism: string;
    plan_b: string;
    risks: string[];
    cites: Cite[];
  };
  /** Null unless the applicant is a reapplicant to this school. */
  reapplicant_angle: string | null;
}

export interface FileMapItem {
  deliverable_key: string;
  /** "S03", or null with `primary_reason_if_none` saying why no story leads it. */
  primary_story: string | null;
  primary_reason_if_none: string | null;
  supporting: string[];
  traits_shown: TraitId[];
  lenses: LensId[];
  why: string;
}

export interface RecommenderPlan {
  recommender_id: string;
  strengths: TraitId[];
  stories: string[];
  facets: string[];
}

export interface FileMap {
  items: FileMapItem[];
  recommender_plan: RecommenderPlan[];
  coverage_gaps: string[];
  warnings: string[];
}

/* Angles, drafts, coaching (§8.5.7–8.5.9) ------------------------------------------------------ */

export interface Angle {
  deliverable_key: string;
  label: AngleLabel;
  pitch: string;
  opening_line: string;
  stories: string[];
  beats: { beat: string; words: number; sources: Cite[] }[];
  proves: TraitId[];
  risks: string[];
  recommended: boolean;
  reason: string;
}

export interface Sentence {
  text: string;
  kind: SentenceKind;
  sources: Cite[];
}

export interface Paragraph {
  id: string;
  sentences: Sentence[];
}

export interface DraftNeed {
  paragraph_id: string;
  /** Index of the sentence the answer goes after, counting from 0. */
  after_sentence: number;
  question: string;
  approx_words: number;
}

export interface Draft {
  paragraphs: Paragraph[];
  needs: DraftNeed[];
  prompt_parts_answered: { part: string; paragraph_ids: string[] }[];
  notes: {
    why_this_story: string;
    what_it_proves: string;
    school_fit_points: { text: string; k_ids: string[] }[];
  };
  verify: { text: string; reason: string }[];
}

export interface CoachBeats {
  beats: {
    beat: string;
    words: number;
    your_lines: { text: string; source: Cite }[];
    questions: string[];
  }[];
}

/* Gaps and short-form (§8.5.6, §8.5.9, §5.9) -------------------------------------------------- */

/** §8.5.6: at most this many blocking questions; the rest become NEED chips in the drafts. */
export const GAP_BLOCKING_MAX = 8;

/** A detail the plan needs and the dossier lacks, asked as one question. */
export interface Gap {
  question: string;
  /** True when a draft would be hollow without the answer: asked before drafting. */
  blocking: boolean;
  deliverable_key: string;
  /** The story the answer feeds, or null for a detail no story holds yet. */
  story: string | null;
  /** About how many words a good answer takes. */
  approx_words: number;
  /** One plain sentence on what the answer unlocks. */
  why: string;
}

/** How a short item is written: prose, a list of separate items, or spoken talking points. */
export const SHORTFORM_FORMATS = ["prose", "list", "talking_points"] as const;
export type ShortformFormat = (typeof SHORTFORM_FORMATS)[number];

/** §5.9: each list item keeps its own tone (wit as wit, pride as pride). */
export const LIST_TONES = ["wit", "pride", "warmth", "curiosity", "candour", "plain"] as const;
export type ListTone = (typeof LIST_TONES)[number];

/** §5.9: three bullets per likely question, and a 60- or 90-second structure. Never a script. */
export const TALKING_POINTS_PER_QUESTION = 3;
export const VIDEO_STRUCTURE_SECONDS = [60, 90] as const;

export interface TalkingPoint {
  text: string;
  sources: Cite[];
}

export interface VideoPlan {
  questions: { question: string; points: TalkingPoint[] }[];
  structure: { seconds: number; segments: { label: string; seconds: number }[] };
}

export interface ShortformItem {
  deliverable_key: string;
  format: ShortformFormat;
  /** The answer (prose), one paragraph per item (list), or empty (talking points). */
  paragraphs: Paragraph[];
  /** List format only: the tone of each item, by paragraph id. */
  list_tones: { paragraph_id: string; tone: ListTone }[];
  /** Talking-points format only. */
  video: VideoPlan | null;
  needs: DraftNeed[];
  /** Why this content went here; for a goal field, why this part of the goals statement. */
  why: string;
}

export interface Shortform {
  /**
   * §5.9: the full goals statement, written privately first and then split across the goal
   * fields. Null when the school has no goal fields. Never shown as a deliverable.
   */
  goals_statement: Sentence[] | null;
  items: ShortformItem[];
  verify: { text: string; reason: string }[];
}

/* Critique and revision (§8.5.10, §8.6) ------------------------------------------------------- */

export interface Finding {
  rule_id: string;
  severity: FindingSeverity;
  location: { paragraph_id: string | null; sentence: number | null };
  explanation: string;
  fix_hint: string | null;
}

export interface CriticReport {
  findings: Finding[];
  /** Each 1–5 (SCORE_MIN–SCORE_MAX). */
  scores: { answers_prompt: number; story_quality: number; voice_fidelity: number };
}

export interface Patch {
  op: PatchOp;
  paragraph_id: string;
  /** Null only for `delete`. */
  sentences: Sentence[] | null;
}

export interface RevisionResult {
  patches: Patch[];
  summary: string;
}

/* Interview and recommenders (§8.5.12, §8.5.14) ----------------------------------------------- */

export interface DrillFeedback {
  /** Each score 1–5. */
  scores: { criterion: string; score: number; quote: string }[];
  fixes: string[];
  stronger_version: string;
  consistency_flags: { text: string; conflicts_with: Cite }[];
}

/** Talking points for a recommender. Deliberately has no field for letter prose (§5.11). */
export interface LorBrief {
  cover_note: string;
  schools: {
    school_cycle_id: string;
    questions: {
      question_verbatim: string;
      talking_points: { point: string; evidence: string; trait: TraitId; cites: Cite[] }[];
    }[];
  }[];
  other_recommender_covers: string[];
  development_arc: {
    feedback: string;
    response: string;
    steps: string[];
    evidence: string;
  } | null;
  key_facts: string[];
}
