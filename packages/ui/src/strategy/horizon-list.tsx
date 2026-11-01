// The horizon as a plain list (spec §6.12: an accessible list equivalent for the Horizon timeline),
// and the exact-shape placeholder the route shows while HorizonTimeline loads. Both server-safe:
// no Motion, no client state.

import { cx } from "../lib/cx";
import { horizonModel, markSummary, type HorizonOptions } from "./horizon";
import { AXIS_REM, HORIZON_HINT, LANE_REM } from "./horizon-parts";
import type { HorizonSchool } from "./types";

export interface HorizonListProps extends HorizonOptions {
  schools: readonly HorizonSchool[];
  headingLevel?: 3 | 4;
  className?: string;
}

/** Every school with its rounds in words, in the applicant's time zone. */
export function HorizonList({
  schools,
  now,
  timeZone,
  locale,
  headingLevel = 3,
  className,
}: HorizonListProps) {
  const Heading = `h${headingLevel}` as const;
  const { lanes } = horizonModel(schools, { now, timeZone, locale });
  if (lanes.length === 0) {
    return (
      <p className={cx("text-text-soft", className)}>
        No schools yet. Search for one to see its rounds and what it asks for.
      </p>
    );
  }
  return (
    <ul className={cx("flex flex-col border-t border-edge", className)}>
      {lanes.map((lane) => (
        <li
          key={lane.id}
          data-lane={lane.id}
          className="flex flex-col gap-1 border-b border-edge py-3"
        >
          <Heading className="font-semibold text-text">{lane.name}</Heading>
          {lane.pack !== "published" ? (
            <p className="text-sm text-text-soft">Pack coming soon</p>
          ) : (
            <>
              <ul className="flex flex-col tabular-nums text-text">
                {lane.marks.map((mark) => (
                  <li key={mark.id}>{markSummary(mark)}</li>
                ))}
              </ul>
              <p className="text-sm text-text-soft">
                {lane.source}
                {lane.verified ? `. ${lane.verified}` : null}
              </p>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface HorizonPlaceholderProps {
  /** How many schools the horizon will show. */
  count: number;
  className?: string;
}

/**
 * The horizon's exact shape while it loads (spec §6.1: placeholders hold the exact shape; no
 * spinner, no shimmer): the hint line, the axis and one lane per school, ruled like the real
 * thing. Below 640px lanes grow with their dated rounds, so there it holds a minimum instead.
 */
export function HorizonPlaceholder({ count, className }: HorizonPlaceholderProps) {
  const lanes = Math.max(count, 1);
  return (
    <div
      aria-hidden="true"
      data-placeholder="horizon"
      className={cx("flex flex-col gap-4", className)}
    >
      <p className="text-sm text-text-soft">{HORIZON_HINT}</p>
      <div>
        <div
          className="hidden border-b border-edge sm:block"
          style={{ height: `${AXIS_REM}rem` }}
        />
        {Array.from({ length: lanes }, (_, index) => (
          <div
            key={index}
            className="border-b border-edge"
            style={{ minHeight: `${LANE_REM}rem` }}
          />
        ))}
      </div>
    </div>
  );
}
