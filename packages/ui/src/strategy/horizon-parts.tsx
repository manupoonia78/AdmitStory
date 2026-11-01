// Pieces the horizon, its list equivalent and its placeholder share. Server-safe, so the route's
// first load gets the axis and the exact-shape placeholder without Motion.

import { cx } from "../lib/cx";
import type { HorizonMark } from "./horizon";
import type { MonthTick } from "./time-scale";

/** The keyboard path, said once in a quiet line above the list (docs/design, Raycast). */
export const HORIZON_HINT =
  "Select two or more schools to compare them. Arrow keys move, Space selects, Escape clears.";

/** The lane's name column, shared by the axis so marks and ticks line up. */
export const LANE_NAME_COLUMN = "sm:grid-cols-[12rem_minmax(0,1fr)]";

/** Lane height from 640px, in rem. HorizonPlaceholder holds exactly this per school. */
export const LANE_REM = 4;
/** The axis row's height, in rem. */
export const AXIS_REM = 2.5;

/**
 * A round's mark: the planned round is filled with a ring, a passed round is hollow, the others
 * are filled. Words say the same thing beside it, so the shape is never the only signal.
 */
export function markDotClass(mark: Pick<HorizonMark, "planned" | "past">): string {
  return cx(
    "block size-3 shrink-0 self-center rounded-full",
    mark.planned
      ? "bg-text ring-2 ring-text ring-offset-2 ring-offset-depth"
      : mark.past
        ? "border border-text-soft bg-transparent"
        : "bg-text-soft",
  );
}

export interface HorizonAxisProps {
  ticks: readonly MonthTick[];
  /** Today, 0 to 1 along the axis. */
  today: number;
  className?: string;
}

/** Month ticks and the "Today" label above the lanes. Decorative: every date is also in words. */
export function HorizonAxis({ ticks, today, className }: HorizonAxisProps) {
  return (
    <div
      aria-hidden="true"
      className={cx("hidden h-10 grid-cols-1 gap-x-4 px-3 sm:grid", LANE_NAME_COLUMN, className)}
    >
      <span />
      <span className="relative h-full border-b border-edge">
        {ticks.map((tick) => (
          <span
            key={`${tick.at}-${tick.label}`}
            className="absolute bottom-1 whitespace-nowrap text-sm tabular-nums text-text-soft"
            style={{ left: `${tick.at * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-sm font-medium text-text"
          style={{ left: `${today * 100}%` }}
        >
          Today
        </span>
      </span>
    </div>
  );
}
