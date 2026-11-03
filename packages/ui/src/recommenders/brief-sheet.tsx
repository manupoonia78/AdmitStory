// The brief as one paper sheet (§6.10 H, design direction phase-6): the cover note, the own-words
// reminder, what admissions look for, then each school with its questions verbatim and the
// talking points under them, the strengths to bring out, what the other recommender covers, the
// development arc, the facts to keep consistent and the timeline.
//
// Every word comes from `briefSections` in @admitstory/shared/kit, which the portal, the PDF and
// the email text render too, so the applicant and the recommender read the same brief. Server-safe
// (no hooks, no Motion): the sheet is text, and only the toolbar around it is interactive.
//
// The product never writes a letter. These are talking points; nothing here is prose to copy.

import type { BriefSection, Cite } from "@admitstory/shared/kit";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { daysLeftText, daysUntil, formatDay, type Instant } from "../strategy/time-scale";

export interface BriefSheetProps {
  sections: readonly BriefSection[];
  /** "The night-shift fix" for a story code; null hides the source line. */
  sourceLabel?: (cite: Cite) => string | null;
  now: Instant;
  timeZone: string;
  /** Download PDF, Copy email text, Build again. */
  toolbar?: ReactNode;
  /** The stale or failed line, above the sheet. */
  notice?: ReactNode;
  className?: string;
}

/** The sheet is paper in either theme (§6.3): --depth, a 1px edge, a 720px text column. */
const SHEET = "plane flex w-full max-w-[45rem] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10";

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold text-text">{children}</h3>;
}

/** The applicant's own material carries their hue, and nothing else does (§6.3). */
function StoryMark({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-soft">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-voice" />
      from {label}
    </span>
  );
}

function Deadline({ at, now, timeZone }: { at: string; now: Instant; timeZone: string }) {
  const days = daysUntil(at, now, timeZone);
  return (
    <p className="text-sm tabular-nums text-text-soft">
      Deadline {formatDay(at, timeZone)} · {daysLeftText(days)}
    </p>
  );
}

function SectionBody({
  section,
  sourceLabel,
  now,
  timeZone,
}: {
  section: BriefSection;
  sourceLabel: ((cite: Cite) => string | null) | undefined;
  now: Instant;
  timeZone: string;
}) {
  switch (section.kind) {
    case "note":
      return <p className="max-w-essay font-reading text-read-lg text-text">{section.text}</p>;
    case "reminder":
      return <p className="max-w-essay text-text-soft">{section.text}</p>;
    case "explainer":
      return (
        <ul className="flex max-w-essay flex-col gap-2">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-text">
              <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-text-soft" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      );
    case "school":
      return (
        <div className="flex flex-col gap-5">
          {section.deadline ? (
            <Deadline at={section.deadline} now={now} timeZone={timeZone} />
          ) : null}
          <p className="text-sm text-text-soft">{section.howToSubmit}</p>
          {section.packNotes.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {section.packNotes.map((note) => (
                <li key={note} className="text-sm text-text-soft">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
          {section.questions.map((question) => (
            <div key={question.id} className="flex flex-col gap-3 border-t border-edge pt-5">
              <p className="max-w-essay font-reading text-read text-text">{question.text}</p>
              {question.limit ? (
                <p className="text-sm tabular-nums text-text-soft">{question.limit}</p>
              ) : null}
              {question.points.length === 0 ? (
                <p className="text-sm text-text-soft">
                  No talking points for this question yet. Build the brief again once you have told
                  more stories.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {question.points.map((point, index) => {
                    const label = point.story && sourceLabel ? sourceLabel(point.story) : null;
                    return (
                      <li key={`${question.id}-${index}`} className="flex flex-col gap-1">
                        <p className="text-text">{point.point}</p>
                        <p className="text-sm tabular-nums text-text-soft">{point.evidence}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-soft">
                          <span>{point.trait}</span>
                          {label ? <StoryMark label={label} /> : null}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    case "traits":
      return (
        <ul className="flex flex-col gap-3">
          {section.items.map((item) => (
            <li key={item.trait} className="flex flex-col gap-1">
              <span className="font-medium text-text">{item.trait}</span>
              <span className="text-text-soft">{item.why}</span>
            </li>
          ))}
        </ul>
      );
    case "covers":
      return (
        <ul className="flex flex-col gap-2">
          {section.items.map((item) => (
            <li key={item} className="text-text-soft">
              {item}
            </li>
          ))}
        </ul>
      );
    case "arc":
      return (
        <ol className="flex flex-col gap-3">
          {section.steps.map((step) => (
            <li key={step.label} className="flex flex-col gap-1">
              <span className="text-sm text-text-soft">{step.label}</span>
              <span className="text-text">{step.text}</span>
            </li>
          ))}
        </ol>
      );
    case "facts":
      return (
        <ul className="flex flex-col gap-2">
          {section.items.map((item) => (
            <li key={item.text} className="tabular-nums text-text">
              {item.text}
            </li>
          ))}
        </ul>
      );
    case "timeline":
      return (
        <ol className="flex flex-col">
          {section.items.map((item) => (
            <li
              key={`${item.date}-${item.text}`}
              className="flex flex-wrap items-baseline gap-x-4 border-b border-edge py-2 last:border-b-0"
            >
              <span className="w-28 shrink-0 text-sm tabular-nums text-text-soft">
                {formatDay(item.date, timeZone)}
              </span>
              <span className="text-text">{item.text}</span>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export function BriefSheet({
  sections,
  sourceLabel,
  now,
  timeZone,
  toolbar,
  notice,
  className,
}: BriefSheetProps) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {notice}
      {toolbar}
      <article className={SHEET}>
        {sections.map((section, index) => (
          <section key={`${section.kind}-${index}`} className="flex flex-col gap-3">
            <Heading>{section.heading}</Heading>
            <SectionBody
              section={section}
              sourceLabel={sourceLabel}
              now={now}
              timeZone={timeZone}
            />
          </section>
        ))}
      </article>
    </div>
  );
}

export interface BriefPlaceholderProps {
  /** The headings that are already known, so the sheet holds its shape while it builds. */
  headings: readonly string[];
  /** "Building Ravi's brief from 6 stories. About a minute." */
  message: string;
  className?: string;
}

/**
 * The building state: the sheet with every heading in place and faint ruled lines where the
 * talking points will land. No shimmer and no spinner — the page keeps the shape it will have.
 */
export function BriefPlaceholder({ headings, message, className }: BriefPlaceholderProps) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <p role="status" aria-live="polite" className="text-text-soft">
        {message}
      </p>
      <article className={SHEET} aria-hidden>
        {headings.map((heading) => (
          <section key={heading} className="flex flex-col gap-3">
            <Heading>{heading}</Heading>
            <span className="flex flex-col gap-3 pt-1">
              {[100, 94, 72].map((width) => (
                <span key={width} className="h-px bg-edge" style={{ width: `${width}%` }} />
              ))}
            </span>
          </section>
        ))}
      </article>
    </div>
  );
}
