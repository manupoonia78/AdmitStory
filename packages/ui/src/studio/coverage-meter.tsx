// The coverage meter (spec §5.2): the four admissions lenses plus Goals and School fit, each a
// short bar with its level in words. It is the applicant's progress indicator, not a percent
// complete, so it stays still and quiet: bars change width on the glide spring and nothing else
// moves. Server-safe.

import { cx } from "../lib/cx";

export type CoverageLevel = "none" | "thin" | "partial" | "strong";

export type CoverageLensId =
  "academics" | "self-awareness" | "employability" | "leadership" | "goals" | "school-fit";

export interface CoverageLens {
  id: CoverageLensId;
  level: CoverageLevel;
  /** What is missing or what proves it, in a few words: "no originated idea yet". */
  note?: string;
}

export const COVERAGE_LABELS: Record<CoverageLensId, string> = {
  academics: "Academics",
  "self-awareness": "Self-awareness",
  employability: "Employability",
  leadership: "Leadership",
  goals: "Goals",
  "school-fit": "School fit",
};

export const COVERAGE_ORDER: readonly CoverageLensId[] = [
  "academics",
  "self-awareness",
  "employability",
  "leadership",
  "goals",
  "school-fit",
];

export const LEVEL_WORDS: Record<CoverageLevel, string> = {
  none: "not yet",
  thin: "thin",
  partial: "partial",
  strong: "strong",
};

const LEVEL_FRACTION: Record<CoverageLevel, number> = {
  none: 0,
  thin: 1 / 3,
  partial: 2 / 3,
  strong: 1,
};

/** Share of the bar to fill. */
export function levelFraction(level: CoverageLevel): number {
  return LEVEL_FRACTION[level];
}

/** The lens in one line: "Leadership: partial — no originated idea yet". */
export function coverageText(lens: CoverageLens): string {
  const base = `${COVERAGE_LABELS[lens.id]}: ${LEVEL_WORDS[lens.level]}`;
  return lens.note ? `${base} — ${lens.note}` : base;
}

export interface CoverageMeterProps {
  lenses: readonly CoverageLens[];
  heading?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

export function CoverageMeter({
  lenses,
  heading = "Coverage",
  headingLevel = 3,
  className,
}: CoverageMeterProps) {
  const Heading = `h${headingLevel}` as const;
  const byId = new Map(lenses.map((lens) => [lens.id, lens]));
  const ordered = COVERAGE_ORDER.flatMap((id) => byId.get(id) ?? []);
  // SPEC §6.4: six thin lines. Each lens is a hairline track with a run to its level.
  return (
    <section className={cx("flex flex-col gap-1", className)}>
      <Heading className="label mb-1 text-text-label">{heading}</Heading>
      <ul className="flex flex-col">
        {ordered.map((lens) => (
          <li key={lens.id} data-lens={lens.id} data-level={lens.level} className="py-2.5">
            {/* One sentence for screen readers; the visual row splits it into label, line, note. */}
            <span className="sr-only">{coverageText(lens)}</span>
            <div aria-hidden="true" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-text-80">{COVERAGE_LABELS[lens.id]}</span>
                <span className="label text-text-label">{LEVEL_WORDS[lens.level]}</span>
              </div>
              <span className="relative block h-[1.25px] bg-edge">
                <span
                  className="absolute inset-0 origin-left bg-text-soft transition-transform duration-250 ease-rise motion-reduce:transition-none"
                  style={{ transform: `scaleX(${levelFraction(lens.level)})` }}
                />
              </span>
              {lens.note ? <span className="text-sm text-text-soft">{lens.note}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
