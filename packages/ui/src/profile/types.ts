// What the Profile Read components show (spec §5.4, §6.7, §6.10 screen D). Plain data with no Zod,
// so the page can pass a validated profile read straight through and nothing heavy reaches the
// browser.

import type { CoverageLevel, LensId } from "@admitstory/shared";

/** A story or fact a claim rests on, by its dossier code ("S03", "F12"). */
export type EvidenceKind = "story" | "fact";

export interface EvidenceRef {
  id: string;
  kind: EvidenceKind;
  /** The story's nickname or the fact in a few words: "The night-shift fix". */
  title: string;
}

/** An evidence item as the drawer shows it. */
export interface EvidenceItem extends EvidenceRef {
  /** Where it sits in the applicant's life: "Work, 2024". */
  context?: string;
  /** A short excerpt in the applicant's own words, shown in the reading face. */
  excerpt?: string;
  /** Opens the story or fact in the Dossier. */
  href?: string;
}

/** One story behind a lens: a segment of that lens's arc. */
export interface LensStory {
  id: string;
  title: string;
  context?: string;
  /** Relative share of the arc (default 1). Stories that prove the lens more can weigh more. */
  weight?: number;
}

/**
 * One lens of the read. `level` reuses the coverage vocabulary (none, thin, partial, strong), so
 * the Profile Read and the Studio coverage meter never disagree about what a level means.
 */
export interface LensReading {
  lens: LensId;
  level: CoverageLevel;
  stories: readonly LensStory[];
}

/** One finding of the read: a sentence and what it rests on (spec §5.4 AC: every claim cites). */
export interface Finding {
  id: string;
  text: string;
  evidence: readonly EvidenceRef[];
}

/** A thing to do, with how long it takes in words: "2 hours", "one evening a week for a month". */
export interface FindingAction extends Finding {
  time: string;
  /** Why it matters for this applicant, for the strengthening plan. */
  why?: string;
}

/** One lens section of the read: what helps, what may raise doubts, what to do. */
export interface LensFindingsData {
  lens: LensId;
  level: CoverageLevel;
  helps: readonly Finding[];
  doubts: readonly Finding[];
  actions: readonly FindingAction[];
}
