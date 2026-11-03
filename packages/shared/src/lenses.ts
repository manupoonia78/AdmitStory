// The four admissions lenses (spec §5.4, Appendix A1) and the two extra bars the Studio coverage
// meter shows beside them (§5.2). Lens ids use underscores because they appear in model output
// schemas (Appendix I); the UI's own hyphenated ids are mapped at the edge, not here.

export const LENS_IDS = ["academics", "self_awareness", "employability", "leadership"] as const;

export type LensId = (typeof LENS_IDS)[number];

export const LENS_LABELS: Record<LensId, string> = {
  academics: "Academics",
  self_awareness: "Self-awareness",
  employability: "Employability",
  leadership: "Leadership",
};

/** One letter per lens, for the compact dossier's `lenses L,E` fields (spec §8.2). */
export const LENS_LETTERS: Record<LensId, string> = {
  academics: "A",
  self_awareness: "S",
  employability: "E",
  leadership: "L",
};

const LENS_BY_LETTER = new Map<string, LensId>(
  LENS_IDS.map((lens) => [LENS_LETTERS[lens], lens] as const),
);

export function lensLetters(lenses: readonly LensId[]): string {
  // Canonical order, so the same set always compiles to the same string (the prefix is cached).
  return LENS_IDS.filter((lens) => lenses.includes(lens))
    .map((lens) => LENS_LETTERS[lens])
    .join(",");
}

export function lensFromLetter(letter: string): LensId | undefined {
  return LENS_BY_LETTER.get(letter.toUpperCase());
}

/**
 * The coverage meter's bars: the four lenses plus Goals and School fit (spec §5.2). Not lenses —
 * nothing scores a story against them — but the applicant reads them the same way.
 */
export const COVERAGE_IDS = [...LENS_IDS, "goals", "school_fit"] as const;

export type CoverageId = (typeof COVERAGE_IDS)[number];

export const COVERAGE_LABELS: Record<CoverageId, string> = {
  ...LENS_LABELS,
  goals: "Goals",
  school_fit: "School fit",
};

/** Spec §5.2 AC: "all four lenses at least partial". */
export const COVERAGE_LEVELS = ["none", "thin", "partial", "strong"] as const;

export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

const LEVEL_ORDER: Record<CoverageLevel, number> = { none: 0, thin: 1, partial: 2, strong: 3 };

export function atLeast(level: CoverageLevel, floor: CoverageLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[floor];
}
