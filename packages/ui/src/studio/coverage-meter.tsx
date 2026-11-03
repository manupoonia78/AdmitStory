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
  return (
    <section className={cx("flex flex-col gap-3", className)}>
      <Heading className="text-base font-medium text-text">{heading}</Heading>
      <ul className="flex flex-col gap-3">
        {ordered.map((lens) => (
          <li key={lens.id} data-lens={lens.id} data-level={lens.level}>
            {/* One sentence for screen readers; the visual row splits it into label, bar, note. */}
            <span className="sr-only">{coverageText(lens)}</span>
            <div aria-hidden="true" className="flex flex-col gap-1">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-3 text-sm">
                <span className="text-text">{COVERAGE_LABELS[lens.id]}</span>
                <span className="h-1 overflow-hidden rounded-full bg-edge">
                  <span
                    className="block h-full origin-left rounded-full bg-text-soft transition-transform duration-(--spring-glide-duration) ease-glide motion-reduce:transition-none"
                    style={{ transform: `scaleX(${levelFraction(lens.level)})` }}
                  />
                </span>
                <span className="text-right text-text-soft">{LEVEL_WORDS[lens.level]}</span>
              </div>
              {lens.note ? <span className="text-sm text-text-soft">{lens.note}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
