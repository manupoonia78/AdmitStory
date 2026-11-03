// What the School Strategy components show (spec §5.5, §6.7, §6.10 screen E). Plain data with no
// Zod. The shapes make the spec's rules hard to break: a school figure can't be passed without a
// Citation, and a school without a published pack can't carry deadlines or be bought.

import type { MedianLabel } from "@admitstory/shared/kit";

/**
 * Where a school figure comes from (spec §0: every school-specific fact carries a source and a
 * verified date; §5.5 AC: every number carries source + year).
 */
export interface Citation {
  /** The document, e.g. "Class profile" or "Employment report". */
  source: string;
  /** The year the figure describes, e.g. 2026 for the class entering in 2026. */
  year: string | number;
  /** The official page it was read from. */
  url?: string;
  /** When the pack last verified it, as an ISO date ("2026-09-12"). */
  verifiedOn?: string;
}

/** A pack is either published (verified, sellable) or not yet. */
export type PackStatus = "published" | "coming_soon";

export interface HorizonRound {
  id: string;
  /** "Round 1". */
  label: string;
  /** "R1": the mark's label on the horizon. */
  short: string;
  /** The deadline as an ISO instant, "2026-09-08T23:59:00-04:00". */
  deadline: string;
}

interface HorizonSchoolBase {
  id: string;
  name: string;
}

export interface PublishedHorizonSchool extends HorizonSchoolBase {
  pack: "published";
  rounds: readonly HorizonRound[];
  /** Where the deadlines come from. Shown as "Verified 12 Sep 2026". */
  citation: Citation;
  /** The round the applicant plans to apply in, if chosen. */
  plannedRoundId?: string | null;
}

/** Nothing unverified is shown, so a school without a published pack has no deadlines here. */
export interface ComingSoonHorizonSchool extends HorizonSchoolBase {
  pack: "coming_soon";
}

export type HorizonSchool = PublishedHorizonSchool | ComingSoonHorizonSchool;

/* The comparison table (MatrixTable) ---------------------------------------------------------- */

/** "above / near / below median" (spec §5.5), as `compareToMedian` in `@admitstory/shared/kit` labels it. */
export type MedianStanding = MedianLabel;

/**
 * A school figure. `citation` is required: a number can't reach the table without its source and
 * year (spec §5.5 AC). Formatting is the table's job, so every figure is typeset the same way.
 */
export interface NumberCell {
  kind: "number";
  value: number;
  citation: Citation;
  /** "percent" reads 0–100 and adds "%". "currency" needs `currency`. Default "decimal". */
  style?: "decimal" | "percent" | "currency";
  /** ISO 4217 code for `style: "currency"`, e.g. "USD". */
  currency?: string;
  /** Fraction digits shown, default 0 (GPA passes 2). */
  digits?: number;
  /** Shown after the figure in the soft colour: "yrs", "of class". */
  unit?: string;
}

/**
 * The applicant against a class median, in words, with the median itself small beside it. The
 * median is a school figure, so it carries a citation too.
 */
export interface MedianCell {
  kind: "median";
  standing: MedianStanding;
  /** The class median, e.g. 715. Omitted when the school doesn't publish one. */
  median?: number;
  digits?: number;
  citation: Citation;
}

/**
 * Words. A school claim ("Looks for: community builders") cites its source. Internal figures that
 * are not school facts (Admin's costs and counts) are text too, preformatted, with `align: "end"`
 * for tabular alignment.
 */
export interface TextCell {
  kind: "text";
  text: string;
  citation?: Citation;
  align?: "start" | "end";
}

/** Nothing to show, and why: "Not published", "Pack coming soon". */
export interface EmptyCell {
  kind: "empty";
  reason?: string;
}

export type MatrixCell = NumberCell | MedianCell | TextCell | EmptyCell;

export interface MatrixColumn {
  id: string;
  /** The school's name, or the column's heading. */
  label: string;
  /** A second line under the label: "Verified 12 Sep 2026", "Round 2". */
  meta?: string;
}

export interface MatrixRow {
  id: string;
  /** The criterion: "GMAT", "Share of class in technology". */
  label: string;
  /** What the applicant's own value is, shown under the label: "You: 705". */
  hint?: string;
  /** Keyed by column id. A missing cell is shown as an empty cell. */
  cells: Readonly<Record<string, MatrixCell>>;
}

export interface MatrixGroup {
  id: string;
  /** "Class profile", "Outcomes in product management". */
  label: string;
  rows: readonly MatrixRow[];
}

/* Honest flags, round planner, kit preview ----------------------------------------------------- */

/** "risk": something that could hurt the application. "note": worth knowing. */
export type HonestFlagTone = "risk" | "note";

export interface HonestFlag {
  id: string;
  tone: HonestFlagTone;
  /** One sentence: "This school placed 4% of its class in technology last year." */
  text: string;
  /** Every flag rests on the school's own material. */
  citation: Citation;
}

export interface PlannedApplication {
  schoolId: string;
  schoolName: string;
  /** "Round 2". The planner draws one lane per round label. */
  roundLabel: string;
  /** The deadline as an ISO instant. */
  deadline: string;
  /** When work should begin, as an ISO instant. The bar runs from here to the deadline. */
  startBy: string;
  /** The effort in words: "about 3 weeks for 2 essays". */
  effort: string;
  /** What to do first: 1, 2, 3. */
  order: number;
  /** Why it is placed here, e.g. "Round 1 applicants are guaranteed an interview decision first". */
  note?: string;
  /** Where the deadline comes from. */
  citation: Citation;
}

/** One line of the kit preview's file map: which story goes where, titles only (spec §5.5). */
export interface FileMapEntry {
  key: string;
  /** "Essay 1". */
  deliverable: string;
  /** The primary story's title, or null when no story leads it. */
  story: string | null;
}

/** A deliverable the kit will draft, shown present but locked. */
export interface LockedDeliverable {
  key: string;
  /** "Essay 1". */
  title: string;
  /** "200 words". */
  limit: string;
  /** The story it will use, by title. */
  story?: string | null;
}
