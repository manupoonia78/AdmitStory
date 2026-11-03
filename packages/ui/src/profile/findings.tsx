// The Profile Read's plain findings (spec §5.4, §6.10 screen D): one section per lens with three
// short columns, What helps, What may raise doubts and What to do, then the strengthening plan
// with its time estimates. Typography, not cards (docs/design/phase-3-4-direction.md). Every
// finding ends with an EvidenceLink, so the page needs one EvidenceDrawer for all of them; render
// these from a client component, since they take the drawer's open handler.

import { LENS_LABELS } from "@admitstory/shared";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { EvidenceLink } from "./evidence-link";
import { LENS_LEVEL_WORDS } from "./lens-geometry";
import type { EvidenceRef, Finding, FindingAction, LensFindingsData } from "./types";

type OpenEvidence = (refs: readonly EvidenceRef[]) => void;

function FindingText({
  finding,
  onOpenEvidence,
}: {
  finding: Finding;
  onOpenEvidence: OpenEvidence;
}) {
  return (
    <>
      {finding.text}
      {finding.evidence.length > 0 ? (
        <>
          {" "}
          <EvidenceLink refs={finding.evidence} onOpen={onOpenEvidence} />
        </>
      ) : null}
    </>
  );
}

function Column({
  title,
  empty,
  children,
  count,
  Heading,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
  Heading: "h3" | "h4";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Heading className="text-base font-semibold text-text">{title}</Heading>
      {count === 0 ? (
        <p className="text-text-soft">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-4 text-text">{children}</ul>
      )}
    </div>
  );
}

export interface LensFindingsProps {
  data: LensFindingsData;
  onOpenEvidence: OpenEvidence;
  /** The lens heading's level; the columns take the next one. */
  headingLevel?: 2 | 3;
  className?: string;
}

export function LensFindings({
  data,
  onOpenEvidence,
  headingLevel = 2,
  className,
}: LensFindingsProps) {
  const Heading = `h${headingLevel}` as const;
  const Sub = headingLevel === 2 ? "h3" : "h4";
  return (
    <section
      data-lens={data.lens}
      aria-label={LENS_LABELS[data.lens]}
      className={cx("flex flex-col gap-6 border-t border-edge pt-6", className)}
    >
      <Heading className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-display-sm text-text">{LENS_LABELS[data.lens]}</span>{" "}
        <span className="text-lg text-text-soft">{LENS_LEVEL_WORDS[data.level]}</span>
      </Heading>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Column
          Heading={Sub}
          title="What helps"
          empty="No stories show this yet."
          count={data.helps.length}
        >
          {data.helps.map((finding) => (
            <li key={finding.id}>
              <FindingText finding={finding} onOpenEvidence={onOpenEvidence} />
            </li>
          ))}
        </Column>
        <Column
          Heading={Sub}
          title="What may raise doubts"
          empty="Nothing here a reader is likely to doubt."
          count={data.doubts.length}
        >
          {data.doubts.map((finding) => (
            <li key={finding.id}>
              <FindingText finding={finding} onOpenEvidence={onOpenEvidence} />
            </li>
          ))}
        </Column>
        <Column
          Heading={Sub}
          title="What to do"
          empty="Nothing to do here for now."
          count={data.actions.length}
        >
          {data.actions.map((action) => (
            <li key={action.id} className="flex flex-col gap-1">
              <span>
                <FindingText finding={action} onOpenEvidence={onOpenEvidence} />
              </span>
              <span className="text-sm tabular-nums text-text-soft">{action.time}</span>
            </li>
          ))}
        </Column>
      </div>
    </section>
  );
}

export interface StrengtheningPlanProps {
  items: readonly FindingAction[];
  onOpenEvidence: OpenEvidence;
  className?: string;
}

/** What could still change before deadlines, in order, with the time each takes right-aligned. */
export function StrengtheningPlan({ items, onOpenEvidence, className }: StrengtheningPlanProps) {
  if (items.length === 0) {
    return (
      <p className={cx("text-text-soft", className)}>
        Nothing to strengthen before your deadlines.
      </p>
    );
  }
  return (
    <ol className={cx("flex flex-col border-t border-edge", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          data-action={item.id}
          className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-edge py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-x-4"
        >
          <span className="font-semibold tabular-nums text-text">{index + 1}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-text">
              <FindingText finding={item} onOpenEvidence={onOpenEvidence} />
            </span>
            {item.why ? <span className="text-sm text-text-soft">{item.why}</span> : null}
          </span>
          <span className="col-start-2 whitespace-nowrap text-sm tabular-nums text-text-soft sm:col-start-3 sm:text-right">
            {item.time}
          </span>
        </li>
      ))}
    </ol>
  );
}
