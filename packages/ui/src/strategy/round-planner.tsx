// The round planner (spec §5.5, §6.10 screen E: "round planner as a horizontal timeline"). One
// lane per round on a shared time axis. Each school is a bar that starts when work should begin
// and ends at its deadline, so the bar's length is the effort, and the same is said in words
// beside it ("Start by 12 Aug, about 3 weeks for 2 essays"). Order numbers say what to do first.
// Server-safe and still: the horizon above is the screen's one hero.

import { cx } from "../lib/cx";
import { citationText } from "./citation";
import {
  formatDay,
  formatDeadline,
  monthTicks,
  positionIn,
  timeDomain,
  toMs,
  type Instant,
  type MonthTick,
} from "./time-scale";
import type { PlannedApplication } from "./types";

export interface PlannerBar {
  item: PlannedApplication;
  /** 0 to 1 along the axis. */
  start: number;
  end: number;
  /** "Start by 12 Aug, about 3 weeks for 2 essays". */
  effortText: string;
  /** "Due 6 Jan 2027, 23:59 GMT+5:30". */
  dueText: string;
}

export interface PlannerLane {
  round: string;
  bars: PlannerBar[];
}

export interface PlannerModel {
  lanes: PlannerLane[];
  ticks: MonthTick[];
  today: number;
}

/** Lanes in deadline order, bars in the order to work on them. */
export function plannerModel(
  items: readonly PlannedApplication[],
  { now, timeZone, locale = "en-GB" }: { now: Instant; timeZone: string; locale?: string },
): PlannerModel {
  const domain = timeDomain(
    items.flatMap((item) => [item.startBy, item.deadline]),
    now,
  );
  const byRound = new Map<string, PlannedApplication[]>();
  for (const item of items)
    byRound.set(item.roundLabel, [...(byRound.get(item.roundLabel) ?? []), item]);
  const earliest = (list: PlannedApplication[]) =>
    Math.min(...list.map((item) => toMs(item.deadline)));
  const lanes = [...byRound.entries()]
    .sort(([, a], [, b]) => earliest(a) - earliest(b))
    .map(([round, list]) => ({
      round,
      bars: [...list]
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const start = positionIn(domain, item.startBy);
          return {
            item,
            start,
            end: Math.max(start, positionIn(domain, item.deadline)),
            effortText: `Start by ${formatDay(item.startBy, timeZone, locale, false)}, ${item.effort}`,
            dueText: `Due ${formatDeadline(item.deadline, timeZone, locale)}`,
          };
        }),
    }));
  return { lanes, ticks: monthTicks(domain, locale), today: positionIn(domain, now) };
}

export interface RoundPlannerProps {
  items: readonly PlannedApplication[];
  now: Instant;
  timeZone: string;
  locale?: string;
  headingLevel?: 3 | 4;
  className?: string;
}

export function RoundPlanner({
  items,
  now,
  timeZone,
  locale,
  headingLevel = 3,
  className,
}: RoundPlannerProps) {
  const Heading = `h${headingLevel}` as const;
  if (items.length === 0) {
    return (
      <p className={cx("text-text-soft", className)}>
        Choose a round for each school and the plan appears here.
      </p>
    );
  }
  const model = plannerModel(items, { now, timeZone, locale });
  return (
    <div className={cx("flex min-w-0 flex-col gap-6", className)}>
      {/* The shared axis, from 640px. Decorative: every date is also in words. */}
      <div
        aria-hidden="true"
        className="relative hidden h-6 border-b border-edge sm:ml-[18rem] sm:block"
      >
        {model.ticks.map((tick) => (
          <span
            key={`${tick.at}-${tick.label}`}
            className="absolute bottom-1 whitespace-nowrap text-sm tabular-nums text-text-soft"
            style={{ left: `${tick.at * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {model.lanes.map((lane) => (
        <section key={lane.round} data-round={lane.round} className="flex flex-col gap-2">
          <Heading className="font-semibold text-text">{lane.round}</Heading>
          <ol className="flex flex-col border-t border-edge">
            {lane.bars.map((bar) => (
              <li
                key={bar.item.schoolId}
                data-school={bar.item.schoolId}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-2 border-b border-edge py-3 sm:grid-cols-[2rem_14rem_minmax(0,1fr)] sm:gap-x-4"
              >
                <span className="text-lg font-semibold tabular-nums text-text">
                  <span className="sr-only">Step </span>
                  {bar.item.order}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-text">{bar.item.schoolName}</span>
                  <span className="text-sm text-text-soft">{bar.effortText}</span>
                  <span className="text-sm tabular-nums text-text-soft">{bar.dueText}</span>
                  <span className="text-sm text-text-soft">
                    Source: {citationText(bar.item.citation, locale)}
                  </span>
                  {bar.item.note ? (
                    <span className="text-sm text-text-soft">{bar.item.note}</span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className="relative col-span-2 hidden h-full min-h-6 sm:col-span-1 sm:block"
                >
                  <span
                    data-today=""
                    className="absolute inset-y-0 w-px bg-text"
                    style={{ left: `${model.today * 100}%` }}
                  />
                  <span
                    data-bar=""
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-text-soft"
                    style={{
                      left: `${bar.start * 100}%`,
                      width: `max(0.5rem, ${(bar.end - bar.start) * 100}%)`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
