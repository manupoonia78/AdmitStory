"use client";

// School Strategy's hero (spec §6.7): schools on a horizon of deadlines. Each school is a lane
// across one shared time axis, its rounds are marks on it, and a hairline marks today. Selecting
// two or more schools morphs the lanes into side-by-side columns: each chosen lane narrows into a
// column, its name rises into the header and its round marks slide off the axis into a dated list,
// while the others fold into compact rows beneath. The comparison passed in fades up below.
//
// How it moves: Motion `layout` on the drift spring (§6.6), inside one LayoutGroup. The lanes are
// never re-created, only re-laid out, so focus stays on the same school through the morph, and
// because springs carry their velocity a quick reselect mid-flight just turns around. Selecting
// the first school moves nothing: the lane takes the --veil plane and its check appears (snap).
// Under reduced motion there is no morph: the view changes on the next frame and the comparison
// fades in over 120 ms.
//
// Motion is in this file, so routes load it with next/dynamic behind HorizonPlaceholder (exact
// shape) and render HorizonList until then; both are in ./horizon-list and server-safe.
//
// Keyboard: the list is one Tab stop. Arrow keys move between schools in the order they appear,
// Home and End jump, Space or Enter toggles one, Escape clears the comparison. A polite live
// region says what is being compared.

import { CheckIcon } from "@phosphor-icons/react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { EmptyState } from "../components/empty-state";
import { cx } from "../lib/cx";
import { REDUCED_FADE, spring } from "../motion";
import {
  COMPARE_AT,
  horizonModel,
  laneSummary,
  moveIndex,
  selectionAnnouncement,
  toggleSelection,
  visualOrder,
  type HorizonLane,
  type HorizonMark,
} from "./horizon";
import { HORIZON_HINT, HorizonAxis, LANE_NAME_COLUMN, markDotClass } from "./horizon-parts";
import type { Instant } from "./time-scale";
import type { HorizonSchool } from "./types";

export interface HorizonTimelineProps {
  schools: readonly HorizonSchool[];
  /** The instant "today" is drawn at. Passed in, so server and browser agree. */
  now: Instant;
  /** The applicant's IANA time zone: every date is shown in it (spec §5.5). */
  timeZone: string;
  locale?: string;
  /** Controlled selection. Leave undefined to let the timeline keep its own. */
  selectedIds?: readonly string[];
  defaultSelectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Shown below the columns while two or more schools are selected: the comparison table. */
  comparison?: ReactNode;
  /** Shown instead of the horizon when there are no schools, e.g. the search field's button. */
  emptyAction?: ReactNode;
  /** Names the list for assistive technology. */
  label?: string;
  className?: string;
}

export function HorizonTimeline({
  schools,
  now,
  timeZone,
  locale,
  selectedIds,
  defaultSelectedIds = [],
  onSelectionChange,
  comparison,
  emptyAction,
  label = "Your schools on the deadline horizon",
  className,
}: HorizonTimelineProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const hintId = `${uid}-hint`;
  const [ownSelection, setOwnSelection] = useState<readonly string[]>(defaultSelectedIds);
  const selected = selectedIds ?? ownSelection;
  const [rover, setRover] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const laneRefs = useRef(new Map<string, HTMLLIElement>());

  const model = horizonModel(schools, { now, timeZone, locale });
  const ids = model.lanes.map((lane) => lane.id);
  const live = selected.filter((id) => ids.includes(id));
  const comparing = live.length >= COMPARE_AT;
  const order = visualOrder(ids, live);
  const tabStop = rover !== null && ids.includes(rover) ? rover : (order[0] ?? null);

  function commit(next: string[]) {
    if (selectedIds === undefined) setOwnSelection(next);
    onSelectionChange?.(next);
    const names = next.flatMap((id) => model.lanes.find((lane) => lane.id === id)?.name ?? []);
    setAnnouncement(next.length === 0 ? "Comparison cleared." : selectionAnnouncement(names));
  }

  function focusLane(id: string) {
    setRover(id);
    laneRefs.current.get(id)?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    const current = (event.target as HTMLElement).closest<HTMLElement>("[data-lane]")?.dataset.lane;
    if (!current) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      commit(toggleSelection(live, current));
      return;
    }
    if (event.key === "Escape") {
      if (live.length === 0) return;
      event.preventDefault();
      commit([]);
      return;
    }
    const next = moveIndex(event.key, order.indexOf(current), order.length);
    if (next === null) return;
    event.preventDefault();
    const target = order[next];
    if (target) focusLane(target);
  }

  if (model.lanes.length === 0) {
    return (
      <EmptyState
        title="No schools yet"
        description="Search for one to see its rounds and what it asks for."
        action={emptyAction}
        headingLevel={3}
        className={cx("px-0", className)}
      />
    );
  }

  const layout = reduced ? false : true;
  const transition = reduced ? REDUCED_FADE : spring("drift");
  const columns: CSSProperties | undefined = comparing
    ? { gridTemplateColumns: `repeat(${live.length}, minmax(12rem, 1fr))` }
    : undefined;

  return (
    <section
      aria-label={label}
      data-comparing={comparing ? "" : undefined}
      data-reduced={reduced ? "" : undefined}
      className={cx("flex min-w-0 flex-col gap-4", className)}
    >
      <p id={hintId} className="text-sm text-text-soft">
        {HORIZON_HINT}
      </p>
      <LayoutGroup id={uid}>
        <motion.div layoutScroll className="min-w-0 overflow-x-auto">
          {comparing ? null : <HorizonAxis ticks={model.ticks} today={model.today} />}
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            aria-describedby={hintId}
            onKeyDown={onKeyDown}
            style={columns}
            className={cx(
              comparing ? "grid min-w-max gap-x-4 gap-y-0 sm:min-w-0" : "flex flex-col",
            )}
          >
            {model.lanes.map((lane) => {
              const isSelected = live.includes(lane.id);
              const shape: LaneShape = comparing ? (isSelected ? "column" : "folded") : "lane";
              return (
                <motion.li
                  key={lane.id}
                  ref={(node: HTMLLIElement | null) => {
                    if (node) laneRefs.current.set(lane.id, node);
                    else laneRefs.current.delete(lane.id);
                  }}
                  layout={layout}
                  transition={transition}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={laneSummary(lane)}
                  tabIndex={lane.id === tabStop ? 0 : -1}
                  data-lane={lane.id}
                  data-shape={shape}
                  onFocus={() => setRover(lane.id)}
                  onClick={() => commit(toggleSelection(live, lane.id))}
                  className={cx(
                    "relative cursor-pointer select-none rounded-control",
                    "transition-colors duration-(--spring-snap-duration) ease-snap hover:bg-veil",
                    isSelected && "bg-veil",
                    shape === "lane" &&
                      "grid min-h-16 grid-cols-1 items-center gap-x-4 gap-y-2 border-b border-edge px-3 py-3 sm:h-16 sm:py-0",
                    shape === "lane" && LANE_NAME_COLUMN,
                    shape === "column" && "mb-4 flex flex-col gap-4 rounded-plane p-4",
                    shape === "folded" &&
                      "order-1 col-span-full flex min-h-11 flex-wrap items-center gap-x-4 border-t border-edge px-3",
                  )}
                >
                  <LaneHead
                    lane={lane}
                    selected={isSelected}
                    shape={shape}
                    layout={layout}
                    transition={transition}
                  />
                  <LaneBody
                    lane={lane}
                    shape={shape}
                    uid={uid}
                    reduced={reduced}
                    transition={transition}
                    today={model.today}
                  />
                </motion.li>
              );
            })}
          </ul>
        </motion.div>
      </LayoutGroup>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {comparing && comparison ? (
        <motion.div
          key="comparison"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? REDUCED_FADE : spring("glide")}
          data-comparison=""
          className="min-w-0"
        >
          {comparison}
        </motion.div>
      ) : null}
    </section>
  );
}

type LaneShape = "lane" | "column" | "folded";

interface LanePartProps {
  lane: HorizonLane;
  shape: LaneShape;
  transition: ReturnType<typeof spring>;
}

function LaneHead({
  lane,
  selected,
  shape,
  layout,
  transition,
}: LanePartProps & { selected: boolean; layout: boolean }) {
  return (
    <motion.span
      layout={layout ? "position" : false}
      transition={transition}
      className="flex min-w-0 items-start gap-3"
    >
      <span
        aria-hidden="true"
        className={cx(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-control border",
          "transition-colors duration-(--spring-snap-duration) ease-snap",
          selected ? "border-signal bg-signal text-on-signal" : "border-control",
        )}
      >
        {selected ? <CheckIcon size={14} weight="bold" /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cx("truncate font-semibold text-text", shape === "column" && "text-lg")}>
          {lane.name}
        </span>
        {shape === "folded" ? null : (
          <span className="text-sm text-text-soft">{lane.verified ?? "Pack coming soon"}</span>
        )}
      </span>
    </motion.span>
  );
}

function LaneBody({
  lane,
  shape,
  uid,
  reduced,
  transition,
  today,
}: LanePartProps & { uid: string; reduced: boolean; today: number }) {
  const markId = (mark: HorizonMark) => (reduced ? undefined : `${uid}-${lane.id}-${mark.id}`);

  if (lane.pack !== "published") {
    return shape === "folded" ? (
      <span className="text-sm text-text-soft">Pack coming soon</span>
    ) : (
      <span className="text-sm text-text-soft">
        Pack coming soon. Its rounds appear here once its pack is verified.
      </span>
    );
  }

  if (shape === "folded") {
    return (
      <span className="text-sm tabular-nums text-text-soft">
        {lane.marks.map((mark) => `${mark.short} ${mark.day}`).join(", ")}
      </span>
    );
  }

  if (shape === "column") {
    return (
      <ol className="flex flex-col border-t border-edge">
        {lane.marks.map((mark) => (
          <li
            key={mark.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-edge py-2"
          >
            <MarkDot mark={mark} layoutId={markId(mark)} transition={transition} />
            <span className="flex flex-col">
              <span className="text-text">
                {mark.label}
                {mark.planned ? <span className="text-text-soft">, planned</span> : null}
              </span>
              <span className="text-sm tabular-nums text-text-soft">
                {mark.deadline}. {mark.daysLeftText}
              </span>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <>
      {/* From 640px: marks on the shared axis. */}
      <span aria-hidden="true" className="relative hidden h-10 sm:block">
        <span className="absolute inset-x-0 top-1/2 h-px bg-edge" />
        <span
          className="absolute inset-y-0 w-px bg-text-soft"
          style={{ left: `${today * 100}%` }}
          data-today=""
        />
        {lane.marks.map((mark) => (
          <span
            key={mark.id}
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${mark.at * 100}%` }}
          >
            <MarkDot mark={mark} layoutId={markId(mark)} transition={transition} />
            <span className="absolute top-4 whitespace-nowrap text-sm tabular-nums text-text-soft">
              {mark.short}
            </span>
          </span>
        ))}
      </span>
      {/* Below 640px a week can't be told apart on an axis: the rounds are dated items. */}
      <span
        aria-hidden="true"
        className="flex flex-col text-sm tabular-nums text-text-soft sm:hidden"
      >
        {lane.marks.map((mark) => (
          <span key={mark.id}>
            {mark.short} {mark.day}, {mark.daysLeftText}
          </span>
        ))}
      </span>
    </>
  );
}

/** A round's mark. With a layoutId it travels from the axis into the column's list. */
function MarkDot({
  mark,
  layoutId,
  transition,
}: {
  mark: HorizonMark;
  layoutId: string | undefined;
  transition: ReturnType<typeof spring>;
}) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={transition}
      data-mark={mark.id}
      data-planned={mark.planned ? "" : undefined}
      data-past={mark.past ? "" : undefined}
      className={markDotClass(mark)}
    />
  );
}
