// The cross-document consistency check, as Must fix rows (spec §5.10, canon FORM-01): what is
// compared, the plain sentence, then where each value lives. A one-click fix where the text is
// structured (résumé and form entries take the Fact Sheet's phrasing); a link where it is prose
// (essays and briefs are fixed in their own editor). No "use client": it holds no state, so a
// server component can render it read-only, and client screens pass the handlers.

import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  SealCheckIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react/ssr";
import type { ConsistencyFinding, ConsistencyValue } from "@admitstory/linters";
import { Button } from "../components/button";
import { TextLink } from "../components/text-link";
import { cx } from "../lib/cx";

export interface ConsistencyListProps {
  findings: readonly ConsistencyFinding[];
  /** Where a value lives, for essays and briefs: "Open Essay 2". Null hides the link. */
  hrefFor?: (value: ConsistencyValue) => string | null;
  /** Replace the value in a résumé or form entry with the Fact Sheet's phrasing. */
  onUseExpected?: (finding: ConsistencyFinding, value: ConsistencyValue) => void;
  /** "These are different things": the applicant says the values are not the same thing. */
  onDismiss?: (finding: ConsistencyFinding) => void;
  emptyLabel?: string;
  className?: string;
}

export const CONSISTENCY_EMPTY = "Everything matches across your resume, forms and essays.";

const same = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

/**
 * The value the others are measured against: the Fact Sheet's phrasing when there is one, else the
 * value most places give (the first of them on a tie).
 */
export function referenceValue(finding: Pick<ConsistencyFinding, "expected" | "values">): string {
  if (finding.expected !== null) return same(finding.expected);
  const tally = new Map<string, number>();
  for (const value of finding.values) {
    const key = same(value.said);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let best = same(finding.values[0]?.said ?? "");
  for (const [key, n] of tally) if (n > (tally.get(best) ?? 0)) best = key;
  return best;
}

/** True when this place says something other than the reference value. */
export function differs(
  finding: Pick<ConsistencyFinding, "expected" | "values">,
  value: ConsistencyValue,
): boolean {
  return value.docKind !== "fact_sheet" && same(value.said) !== referenceValue(finding);
}

/**
 * The one-click fix applies only to text the app holds as the applicant's: résumé bullets ("b4")
 * and form entries. A résumé's role headings and skills lines come from the uploaded file.
 */
export function canUseExpected(finding: ConsistencyFinding, value: ConsistencyValue): boolean {
  return (
    finding.expected !== null &&
    (value.docKind === "form" || (value.docKind === "resume" && /^b\d+$/.test(value.ref))) &&
    differs(finding, value)
  );
}

function ValueRow({
  finding,
  value,
  hrefFor,
  onUseExpected,
}: {
  finding: ConsistencyFinding;
  value: ConsistencyValue;
  hrefFor?: ConsistencyListProps["hrefFor"];
  onUseExpected?: ConsistencyListProps["onUseExpected"];
}) {
  const factSheet = value.docKind === "fact_sheet";
  const off = differs(finding, value);
  const prose = value.docKind === "essay" || value.docKind === "brief";
  const href = prose && off ? (hrefFor?.(value) ?? null) : null;
  return (
    <li
      data-doc={value.docId}
      data-differs={off ? "" : undefined}
      className="grid grid-cols-1 gap-x-4 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
    >
      <span className="text-text-soft">{value.docLabel}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {factSheet ? (
          <span className="inline-flex items-center gap-1 font-medium text-text">
            <SealCheckIcon size={16} aria-hidden className="shrink-0 text-verified" />
            <span>&ldquo;{value.said}&rdquo;</span>
            <span className="sr-only">, the approved phrasing on your Fact Sheet</span>
          </span>
        ) : off ? (
          <span className="inline-flex items-center gap-1 font-medium text-risk">
            <WarningIcon size={16} aria-hidden className="shrink-0" />
            <span>&ldquo;{value.said}&rdquo;</span>
            <span className="sr-only">, does not match</span>
          </span>
        ) : (
          <span className="text-text">&ldquo;{value.said}&rdquo;</span>
        )}
        {onUseExpected && canUseExpected(finding, value) ? (
          <Button size="sm" variant="secondary" onClick={() => onUseExpected(finding, value)}>
            Use &ldquo;{finding.expected}&rdquo; here
          </Button>
        ) : null}
        {href ? (
          <TextLink href={href} className="inline-flex items-center gap-1">
            Open {value.docLabel}
            <ArrowSquareOutIcon size={16} aria-hidden />
          </TextLink>
        ) : null}
      </span>
    </li>
  );
}

/**
 * Must fix rows for values that disagree across the résumé, forms, essays and briefs (§5.10).
 * Each row: what is compared, the plain sentence, then each place and what it says, with the
 * odd one out in --risk with an icon. A polite live region, so a fix that clears a row is heard.
 */
export function ConsistencyList({
  findings,
  hrefFor,
  onUseExpected,
  onDismiss,
  emptyLabel = CONSISTENCY_EMPTY,
  className,
}: ConsistencyListProps) {
  return (
    <section
      aria-label="Consistency across your application"
      aria-live="polite"
      className={cx("flex flex-col font-ui text-base", className)}
    >
      {findings.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 font-medium text-verified">
          <CheckCircleIcon size={16} aria-hidden className="shrink-0" />
          {emptyLabel}
        </p>
      ) : (
        <>
          <h2 className="inline-flex items-center gap-1 font-medium text-risk">
            <WarningOctagonIcon size={16} aria-hidden className="shrink-0" />
            Must fix
            <span className="font-normal tabular-nums text-text-soft">({findings.length})</span>
          </h2>
          <ul className="flex flex-col divide-y divide-edge">
            {findings.map((finding) => (
              <li
                key={finding.id}
                data-finding={finding.id}
                data-rule={finding.rule_id}
                className="flex flex-col gap-2 py-4"
              >
                <p className="font-medium text-text">{finding.what}</p>
                <p className="text-text-soft">{finding.explanation}</p>
                <ul className="flex flex-col text-sm">
                  {finding.values.map((value) => (
                    <ValueRow
                      key={`${value.docId}:${value.ref}`}
                      finding={finding}
                      value={value}
                      hrefFor={hrefFor}
                      onUseExpected={onUseExpected}
                    />
                  ))}
                </ul>
                {onDismiss ? (
                  <div>
                    <Button size="sm" variant="quiet" onClick={() => onDismiss(finding)}>
                      These are different things
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
