// The coverage board said in words (§6.3 "text first"): each recommender is a list under their
// own heading, the essays are a list under theirs, and the shared facets are plain sentences with
// a status word. This is what anyone reads who has motion turned off, who is on a phone, or who
// is using a screen reader, and it is also the placeholder the board loads behind, so the page
// never changes shape.
//
// Server-safe: no hooks, no Motion.

import type { CoverageView, LorOverlapFindingView } from "@admitstory/shared/kit";
import { traitLabel, type TraitId } from "@admitstory/shared";
import type { ReactNode } from "react";
import { StatusLabel } from "../components/status-label";
import { cx } from "../lib/cx";

export const COVERAGE_LEAD =
  "Two vantage points on the same work: what each recommender can say first-hand, and what your essays already say.";

export const COVERAGE_EMPTY =
  "Nothing to compare yet. Once two recommenders have stories, this shows who covers what.";

/** The findings that still stand, with the dismissed ones kept out of the way. */
export function openFindings(findings: readonly LorOverlapFindingView[]): LorOverlapFindingView[] {
  return findings.filter((finding) => !finding.dismissed);
}

/** Traits as words, never as colour (§6.3). */
export function traitWords(traits: readonly TraitId[]): string {
  return traits.map((trait) => traitLabel(trait)).join(" · ");
}

export function CoverageEssaysList({ coverage }: { coverage: CoverageView }) {
  if (coverage.essays.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold text-text">What your essays already say</h3>
      <ul className="flex flex-col border-t border-edge">
        {coverage.essays.map((essay) => (
          <li
            key={essay.deliverableId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-edge py-3"
          >
            <span className="text-text">
              {essay.label}
              <span className="text-sm text-text-soft"> · {essay.school}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-text-soft">
              {essay.storyTitle ? (
                <>
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-voice" />
                  {essay.storyTitle}
                </>
              ) : (
                "No story chosen yet"
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface CoverageFindingsListProps {
  findings: readonly LorOverlapFindingView[];
  /** "Rebuild the plan" and, per finding, "These are different". */
  actions?: (finding: LorOverlapFindingView) => ReactNode;
  className?: string;
}

/** The shared facets as sentences. The explanation says what to do, not just what is wrong. */
export function CoverageFindingsList({ findings, actions, className }: CoverageFindingsListProps) {
  if (findings.length === 0)
    return (
      <p className={cx("text-text-soft", className)}>
        Nobody repeats anybody. Each recommender covers a different side of your work.
      </p>
    );
  return (
    <ul className={cx("flex flex-col border-t border-edge", className)}>
      {findings.map((finding) => (
        <li key={finding.id} className="flex flex-col gap-2 border-b border-edge py-3">
          <StatusLabel tone="needs">
            {finding.kind === "brief_brief" ? "Shared facet" : "Also in an essay"}
          </StatusLabel>
          <p className="text-text">{finding.explanation}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-soft">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-voice" />
              {finding.storyTitle}
            </span>
            {finding.places.map((place) => (
              <a
                key={`${place.label}-${place.href}`}
                href={place.href}
                className="text-signal underline-offset-2 hover:underline"
              >
                {place.label}
              </a>
            ))}
          </p>
          {actions ? <div className="flex flex-wrap gap-2">{actions(finding)}</div> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The board's shape before it loads (§6 "placeholders hold the exact shape"): the lanes' headings
 * and ruled lines where the facets will land. Not a grey skeleton: no shimmer, no fake bars.
 */
export function CoveragePlaceholder({ coverage }: { coverage: CoverageView }) {
  return (
    <div aria-hidden className="plane flex flex-col gap-6 p-5 lg:flex-row lg:gap-10">
      {(coverage.lanes.length > 0 ? coverage.lanes : [null, null]).map((lane, index) => (
        <div key={lane?.recommenderId ?? index} className="flex flex-1 flex-col gap-3">
          <span className="text-lg font-semibold text-text">{lane?.name ?? " "}</span>
          {[100, 88, 94, 70].map((width) => (
            <span key={width} className="h-px bg-edge" style={{ width: `${width}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
