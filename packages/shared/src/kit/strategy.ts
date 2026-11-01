// The free tier's two reads (spec §5.4 Profile Read, §5.5 School Strategy), as plain TypeScript,
// plus the median comparison School Strategy shows. The comparison is arithmetic, so it is done
// here in code and never asked of a model: a model would round "705 vs a 715 median" whichever
// way the prose around it leaned.

import type { LensId } from "../lenses";
import type { TraitId } from "../traits";
import type { Cite, CitedText } from "./types";

/**
 * The red-flag rule IDs of canon `red-flags.md` (Appendix A2). Profile Read's doubts cite one of
 * these. A unit test keeps this list equal to the canon's.
 */
export const RED_FLAG_IDS = [
  "FLAG-01",
  "FLAG-02",
  "FLAG-03",
  "FLAG-04",
  "FLAG-05",
  "FLAG-06",
  "FLAG-07",
  "FLAG-08",
  "FLAG-09",
  "FLAG-10",
  "FLAG-11",
] as const;
export type RedFlagId = (typeof RED_FLAG_IDS)[number];

/* Profile Read (profile.read, §5.4, §8.5.4) --------------------------------------------------- */

export interface ProfileDoubt {
  flag_id: RedFlagId;
  text: string;
  cites: Cite[];
}

export interface ProfileAction {
  action: string;
  /** "2 hours", "one evening a week for a month". */
  time_estimate: string;
  cites: Cite[];
}

export interface LensRead {
  helps: CitedText[];
  doubts: ProfileDoubt[];
  do: ProfileAction[];
}

export interface ProfileRead {
  /** One read per lens, in the order a reader checks them (LENS-02). */
  lenses: Record<LensId, LensRead>;
  strengthening_plan: (ProfileAction & { why: string })[];
  brand_preview: { trait: TraitId; why: string; cites: Cite[] }[];
}

/* School fit (strategy.school_fit, §5.5) ------------------------------------------------------ */

export interface SchoolFit {
  /** Each cites at least one K item of the school's pack (or a retrieved chunk). */
  honest_flags: CitedText[];
  /** What the school says it looks for, against the applicant's brand traits. */
  looks_for: { school_value: string; your_traits: TraitId[]; note: string; cites: Cite[] }[];
  /** Null when the pack has no employment data for the applicant's target function. */
  outcome_in_target_function: CitedText | null;
}

/* Median comparison --------------------------------------------------------------------------- */

export const MEDIAN_LABELS = ["above", "near", "below", "unknown"] as const;
export type MedianLabel = (typeof MEDIAN_LABELS)[number];

/** The applicant's numbers, in the compact dossier's shape (DossierApplicant). */
export interface ApplicantNumbers {
  test?: { type: string; score: number } | null;
  gpa?: { value: number; scale: number } | null;
  yearsExperience?: number | null;
}

/**
 * A class profile's medians, in the published pack's `class_profile` shape (packages/kb
 * `ClassProfile`), so the app passes the pack's record straight in. Every field may be null: a
 * school that does not publish a number gets "unknown", never a guess.
 */
export interface ClassMedians {
  /** GMAT Focus Edition median (205–805). */
  gmat_focus_median?: number | null;
  /** Classic GMAT median (200–800), for schools that still report it. */
  gmat_classic_median?: number | null;
  /** Section medians; compared as the combined total (260–340). */
  gre_median?: { verbal: number; quant: number } | null;
  gpa_median?: number | null;
  /** The scale `gpa_median` is on; null or missing is read as 4.0. */
  gpa_scale?: number | null;
  work_experience_years_median?: number | null;
}

/**
 * How far from the median still reads as "near". Chosen to match the precision schools publish
 * and admissions readers use, not statistical significance:
 *
 * - GMAT ±20: two score steps (Focus and classic scores both move in tens).
 * - GRE ±2: on the combined Verbal + Quant total (260–340), about one point per section.
 * - GPA ±0.10 on a 4.0 scale (scaled for another scale); class profiles report two decimals.
 * - Years of experience ±0.5: profiles report medians to the half year or month.
 *
 * A difference exactly at the threshold is "near".
 */
export const MEDIAN_NEAR_THRESHOLDS = {
  gmat: 20,
  gre: 2,
  gpa: 0.1,
  years_experience: 0.5,
} as const;

export interface MedianComparison {
  test: MedianLabel;
  gpa: MedianLabel;
  years_experience: MedianLabel;
}

const GMAT_FOCUS = { min: 205, max: 805 } as const;
const GMAT_CLASSIC = { min: 200, max: 800 } as const;
const GRE_TOTAL = { min: 260, max: 340 } as const;

/** One value against one median. Null, missing or non-finite on either side is "unknown". */
export function labelAgainstMedian(
  value: number | null | undefined,
  median: number | null | undefined,
  near: number,
): MedianLabel {
  if (value == null || median == null || !Number.isFinite(value) || !Number.isFinite(median))
    return "unknown";
  // Rounded so float noise (3.6 - 3.5 = 0.10000000000000009) never turns "near" into "above".
  const diff = Math.round((value - median) * 1e6) / 1e6;
  if (Math.abs(diff) <= near) return "near";
  return diff > 0 ? "above" : "below";
}

function testLabel(user: ApplicantNumbers, medians: ClassMedians): MedianLabel {
  const test = user.test;
  if (!test || !Number.isFinite(test.score)) return "unknown";
  const kind = test.type.trim().toLowerCase();
  if (kind.startsWith("gmat")) {
    // Focus Edition scores end in 5 (205–805); classic scores end in 0 (200–800). Each is
    // compared only with a median on its own scale: the two do not convert reliably.
    const focus =
      test.score >= GMAT_FOCUS.min && test.score <= GMAT_FOCUS.max && test.score % 10 === 5;
    if (focus)
      return labelAgainstMedian(test.score, medians.gmat_focus_median, MEDIAN_NEAR_THRESHOLDS.gmat);
    const classic =
      test.score >= GMAT_CLASSIC.min && test.score <= GMAT_CLASSIC.max && test.score % 10 === 0;
    return classic
      ? labelAgainstMedian(test.score, medians.gmat_classic_median, MEDIAN_NEAR_THRESHOLDS.gmat)
      : "unknown";
  }
  if (kind.startsWith("gre")) {
    const total = test.score >= GRE_TOTAL.min && test.score <= GRE_TOTAL.max;
    const gre = medians.gre_median;
    return total && gre
      ? labelAgainstMedian(test.score, gre.verbal + gre.quant, MEDIAN_NEAR_THRESHOLDS.gre)
      : "unknown";
  }
  // The Executive Assessment and anything else: schools rarely publish a median for it.
  return "unknown";
}

function gpaLabel(user: ApplicantNumbers, medians: ClassMedians): MedianLabel {
  const gpa = user.gpa;
  // Only like scales are compared. Converting a 10-point or percentage grade is a judgment
  // schools make with the transcript in hand; a straight ratio misleads.
  const scale = medians.gpa_scale ?? 4;
  if (!gpa || gpa.scale !== scale) return "unknown";
  return labelAgainstMedian(
    gpa.value,
    medians.gpa_median,
    MEDIAN_NEAR_THRESHOLDS.gpa * (scale / 4),
  );
}

/**
 * The applicant against a class profile, as "above / near / below median" (spec §5.5: no
 * admission odds). Pure and deterministic; see MEDIAN_NEAR_THRESHOLDS for what "near" means.
 */
export function compareToMedian(
  user: ApplicantNumbers,
  classProfile: ClassMedians,
): MedianComparison {
  return {
    test: testLabel(user, classProfile),
    gpa: gpaLabel(user, classProfile),
    years_experience: labelAgainstMedian(
      user.yearsExperience,
      classProfile.work_experience_years_median,
      MEDIAN_NEAR_THRESHOLDS.years_experience,
    ),
  };
}
