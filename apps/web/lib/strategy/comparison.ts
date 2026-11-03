// The School Strategy comparison (spec §5.5 "List review", screen E): schools as columns, criteria
// as rows, in named groups. Built in code from the published packs and the applicant's numbers,
// never by a model: "above / near / below median" comes from compareToMedian, and every figure is
// read from the pack with its citation. A figure without a verified source is not shown at all
// (Phase 3 AC: "every displayed number has a source and date").

import type { ClassProfile, EmploymentByFunction, SchoolPack } from "@admitstory/kb/types";
import { traitLabel, type TraitId } from "@admitstory/shared";
import { compareToMedian, type ApplicantNumbers, type MedianLabel } from "@admitstory/shared/kit";
import type { Citation, MatrixCell, MatrixColumn, MatrixGroup, MatrixRow } from "@admitstory/ui";
import { citationFor, firstCitation } from "./pack";
import type { StoredFit } from "./stored-fit";

export interface ComparisonSchool {
  /** The column id: the applicant's user_schools id. */
  id: string;
  name: string;
  /** Null for a school without a published pack ("Pack coming soon"). */
  pack: SchoolPack | null;
  /** "Verified 12 Sep 2026" under the column heading. */
  meta?: string;
  fit: StoredFit | null;
}

export interface ComparisonApplicant {
  numbers: ApplicantNumbers;
  /** "Product management", in the applicant's words, or null. */
  targetFunction: string | null;
  brandTraits: readonly TraitId[];
}

export interface ComparisonModel {
  columns: MatrixColumn[];
  groups: MatrixGroup[];
}

const COMING_SOON: MatrixCell = { kind: "empty", reason: "Pack coming soon" };
const NOT_PUBLISHED: MatrixCell = { kind: "empty", reason: "Not published" };

/* Class profile ------------------------------------------------------------------------------ */

type TestKind = "gmat_focus" | "gmat_classic" | "gre";

/** Which median the applicant's test is compared with, mirroring compareToMedian's scale rules. */
export function applicantTestKind(numbers: ApplicantNumbers): TestKind | null {
  const test = numbers.test;
  if (!test || !Number.isFinite(test.score)) return null;
  const kind = test.type.trim().toLowerCase();
  if (kind.startsWith("gre")) return "gre";
  if (!kind.startsWith("gmat")) return null;
  if (test.score % 10 === 5) return "gmat_focus";
  if (test.score % 10 === 0) return "gmat_classic";
  return null;
}

const TEST_LABELS: Record<TestKind, string> = {
  gmat_focus: "GMAT Focus",
  gmat_classic: "GMAT",
  gre: "GRE (Verbal + Quant)",
};

function testMedian(profile: ClassProfile, kind: TestKind): number | null {
  if (kind === "gmat_focus") return profile.gmat_focus_median;
  if (kind === "gmat_classic") return profile.gmat_classic_median;
  return profile.gre_median ? profile.gre_median.verbal + profile.gre_median.quant : null;
}

function classCitation(pack: SchoolPack): Citation | null {
  const profile = pack.class_profile;
  return profile
    ? citationFor(pack, profile, { label: "Class profile", year: profile.class_year })
    : null;
}

function medianCell(
  pack: SchoolPack | null,
  median: (profile: ClassProfile) => number | null,
  standing: (profile: ClassProfile) => MedianLabel,
  digits?: number,
): MatrixCell {
  if (!pack) return COMING_SOON;
  const profile = pack.class_profile;
  const citation = classCitation(pack);
  if (!profile || !citation) return NOT_PUBLISHED;
  const value = median(profile);
  if (value === null) return NOT_PUBLISHED;
  return {
    kind: "median",
    standing: standing(profile),
    median: value,
    citation,
    ...(digits !== undefined ? { digits } : {}),
  };
}

function numberCell(
  pack: SchoolPack | null,
  value: (profile: ClassProfile) => number | null,
  extra: Partial<Extract<MatrixCell, { kind: "number" }>> = {},
): MatrixCell {
  if (!pack) return COMING_SOON;
  const profile = pack.class_profile;
  const citation = classCitation(pack);
  if (!profile || !citation) return NOT_PUBLISHED;
  const figure = value(profile);
  if (figure === null) return NOT_PUBLISHED;
  return { kind: "number", value: figure, citation, ...extra };
}

function applicantHint(numbers: ApplicantNumbers, kind: "test" | "gpa" | "years"): string {
  if (kind === "test") return numbers.test ? `You: ${numbers.test.score}` : "You: not given yet";
  if (kind === "gpa")
    return numbers.gpa ? `You: ${numbers.gpa.value} of ${numbers.gpa.scale}` : "You: not given yet";
  return numbers.yearsExperience != null
    ? `You: ${numbers.yearsExperience} years`
    : "You: not given yet";
}

function classProfileGroup(
  schools: readonly ComparisonSchool[],
  applicant: ComparisonApplicant,
): MatrixGroup {
  const cells = (cell: (school: ComparisonSchool) => MatrixCell) =>
    Object.fromEntries(schools.map((school) => [school.id, cell(school)]));
  const standings = (school: ComparisonSchool) =>
    school.pack?.class_profile
      ? compareToMedian(applicant.numbers, school.pack.class_profile)
      : null;

  const kind = applicantTestKind(applicant.numbers);
  // Without a comparable test, show the two medians schools publish most, each "No comparison yet".
  const testKinds: TestKind[] = kind ? [kind] : ["gmat_focus", "gre"];
  const testRows: MatrixRow[] = testKinds.map((testKind) => ({
    id: `test-${testKind}`,
    label: TEST_LABELS[testKind],
    hint: applicantHint(applicant.numbers, "test"),
    cells: cells((school) =>
      medianCell(
        school.pack,
        (profile) => testMedian(profile, testKind),
        () => (kind ? (standings(school)?.test ?? "unknown") : "unknown"),
      ),
    ),
  }));

  return {
    id: "class-profile",
    label: "Class profile",
    rows: [
      ...testRows,
      {
        id: "gpa",
        label: "GPA",
        hint: applicantHint(applicant.numbers, "gpa"),
        cells: cells((school) =>
          medianCell(
            school.pack,
            (profile) => profile.gpa_median,
            () => standings(school)?.gpa ?? "unknown",
            2,
          ),
        ),
      },
      {
        id: "experience",
        label: "Years of experience",
        hint: applicantHint(applicant.numbers, "years"),
        cells: cells((school) =>
          medianCell(
            school.pack,
            (profile) => profile.work_experience_years_median,
            () => standings(school)?.years_experience ?? "unknown",
            1,
          ),
        ),
      },
      {
        id: "class-size",
        label: "Class size",
        cells: cells((school) =>
          numberCell(school.pack, (profile) => profile.class_size, { unit: "students" }),
        ),
      },
      {
        id: "international",
        label: "International students",
        cells: cells((school) =>
          numberCell(
            school.pack,
            (profile) =>
              profile.international_share === null ? null : profile.international_share * 100,
            { style: "percent", unit: "of class" },
          ),
        ),
      },
    ],
  };
}

/* Outcomes ----------------------------------------------------------------------------------- */

const STOP = new Set(["and", "the", "of", "in", "a", "an", "at", "to", "for", "role", "roles"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * The employment report's line for the applicant's target function: the one sharing the most words
 * with it ("Product management" finds "Product and marketing"). Null when nothing matches, so a
 * share is never shown for the wrong function.
 */
export function matchFunction(
  rows: readonly EmploymentByFunction[],
  target: string | null,
): EmploymentByFunction | null {
  if (!target) return null;
  const wanted = new Set(words(target));
  let best: EmploymentByFunction | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = words(row.function).filter((w) => wanted.has(w)).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

function outcomesGroup(
  schools: readonly ComparisonSchool[],
  applicant: ComparisonApplicant,
): MatrixGroup {
  const target = applicant.targetFunction;
  const report = (school: ComparisonSchool) => {
    const employment = school.pack?.careers.employment_report ?? null;
    const citation =
      school.pack && employment
        ? citationFor(school.pack, employment, {
            label: "Employment report",
            year: employment.class_year,
          })
        : null;
    return employment && citation ? { employment, citation } : null;
  };
  const noTarget: MatrixCell = { kind: "empty", reason: "Name your target role first" };
  const forFunction = (
    school: ComparisonSchool,
    build: (row: EmploymentByFunction, citation: Citation, currency: string) => MatrixCell,
  ): MatrixCell => {
    if (!school.pack) return COMING_SOON;
    const found = report(school);
    if (!found) return NOT_PUBLISHED;
    if (!target) return noTarget;
    const row = matchFunction(found.employment.by_function, target);
    if (!row) return { kind: "empty", reason: "Not reported for this role" };
    return build(row, found.citation, found.employment.currency);
  };
  const cells = (cell: (school: ComparisonSchool) => MatrixCell) =>
    Object.fromEntries(schools.map((school) => [school.id, cell(school)]));

  return {
    id: "outcomes",
    label: target ? `Outcomes in ${target.toLowerCase()}` : "Outcomes in your target role",
    rows: [
      {
        id: "function-share",
        label: "Share of class",
        cells: cells((school) =>
          forFunction(school, (row, citation) => ({
            kind: "number",
            value: row.share * 100,
            style: "percent",
            citation,
          })),
        ),
      },
      {
        id: "function-base",
        label: "Median base salary",
        cells: cells((school) =>
          forFunction(school, (row, citation, currency) =>
            row.median_base === null
              ? NOT_PUBLISHED
              : { kind: "number", value: row.median_base, style: "currency", currency, citation },
          ),
        ),
      },
      {
        id: "top-employers",
        label: "Top employers",
        cells: cells((school): MatrixCell => {
          if (!school.pack) return COMING_SOON;
          const found = report(school);
          if (!found || found.employment.top_employers.length === 0) return NOT_PUBLISHED;
          return {
            kind: "text",
            text: found.employment.top_employers.slice(0, 4).join(", "),
            citation: found.citation,
          };
        }),
      },
    ],
  };
}

/* Location, scholarships, what the school looks for ------------------------------------------- */

function firstItemCell(pack: SchoolPack | null, items: (pack: SchoolPack) => SchoolPack["avoid"]) {
  if (!pack) return COMING_SOON;
  for (const item of items(pack)) {
    const citation = citationFor(pack, item);
    if (citation) return { kind: "text", text: item.text, citation } satisfies MatrixCell;
  }
  return { kind: "empty", reason: "Not in the pack yet" } satisfies MatrixCell;
}

function looksForCell(school: ComparisonSchool, applicant: ComparisonApplicant): MatrixCell {
  const pack = school.pack;
  if (!pack) return COMING_SOON;
  const lines: string[] = [];
  let citation: Citation | null = null;
  // The Strategist's reading first (strategy.school_fit), each line only with a source we can show.
  for (const entry of school.fit?.output?.looks_for ?? []) {
    const cite = firstCitation(pack, entry.cites, school.fit?.retrieval ?? []);
    if (!cite) continue;
    citation ??= cite;
    const yours = entry.your_traits.map((t) => traitLabel(t).toLowerCase());
    lines.push(
      yours.length > 0
        ? `${entry.school_value}: your ${yours.join(" and ")}`
        : `${entry.school_value}: not yet shown`,
    );
    if (lines.length === 2) break;
  }
  // Until the fit has run, the pack's own trait map, for the traits the applicant has.
  if (lines.length === 0) {
    const brand = new Set<string>(applicant.brandTraits);
    const fromMap: string[] = [];
    for (const entry of pack.values.trait_map) {
      const cite = citationFor(pack, entry.note);
      const shared = entry.admitstory_traits.filter((t) => brand.has(t));
      if (!cite || shared.length === 0) continue;
      citation ??= cite;
      fromMap.push(
        `${entry.school_value}: your ${shared.map((t) => traitLabel(t).toLowerCase()).join(" and ")}`,
      );
      if (fromMap.length === 2) break;
    }
    lines.push(...fromMap);
  }
  if (!citation || lines.length === 0) return { kind: "empty", reason: "No match shown yet" };
  return { kind: "text", text: lines.join("; "), citation };
}

/* The model ---------------------------------------------------------------------------------- */

export function comparisonModel(
  schools: readonly ComparisonSchool[],
  applicant: ComparisonApplicant,
): ComparisonModel {
  const cells = (cell: (school: ComparisonSchool) => MatrixCell) =>
    Object.fromEntries(schools.map((school) => [school.id, cell(school)]));
  const traits = applicant.brandTraits.map((t) => traitLabel(t)).join(", ");
  return {
    columns: schools.map((school) => ({
      id: school.id,
      label: school.name,
      ...(school.meta ? { meta: school.meta } : {}),
    })),
    groups: [
      classProfileGroup(schools, applicant),
      outcomesGroup(schools, applicant),
      {
        id: "place",
        label: "Location and scholarships",
        rows: [
          {
            id: "location",
            label: "Location",
            ...(applicant.targetFunction ? { hint: `For ${applicant.targetFunction}` } : {}),
            cells: cells((school) => firstItemCell(school.pack, (p) => p.culture_and_location)),
          },
          {
            id: "scholarships",
            label: "Scholarships",
            cells: cells((school) => firstItemCell(school.pack, (p) => p.scholarships)),
          },
        ],
      },
      {
        id: "looks-for",
        label: "What the school looks for",
        rows: [
          {
            id: "traits",
            label: "Against your brand",
            hint: traits ? `Your traits: ${traits}` : "Your brand traits appear after Story Studio",
            cells: cells((school) => looksForCell(school, applicant)),
          },
        ],
      },
    ],
  };
}

/**
 * Every number or median cell that lacks a source, a year or a verified date. The comparison is
 * built so this is always empty; the test suite and the route both check it.
 */
export function uncitedFigures(groups: readonly MatrixGroup[]): string[] {
  const bad: string[] = [];
  for (const group of groups)
    for (const row of group.rows)
      for (const [column, cell] of Object.entries(row.cells)) {
        if (cell.kind !== "number" && cell.kind !== "median") continue;
        const { source, year, verifiedOn } = cell.citation ?? ({} as Partial<Citation>);
        const ok =
          typeof source === "string" &&
          source.trim() !== "" &&
          String(year ?? "").trim() !== "" &&
          typeof verifiedOn === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(verifiedOn);
        if (!ok) bad.push(`${group.id}/${row.id}/${column}`);
      }
  return bad;
}
