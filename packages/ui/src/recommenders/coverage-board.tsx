"use client";

// Screen H's hero (§6.7, one per screen): two vantage points on the same work.
//
// Each recommender is a lane — their name, what they are to you, the strengths they carry — and
// the facets of your stories they can speak to sit under them. Your essays are one band
// underneath. When a new plan lands, the facets start as a loose stack in the seam between the
// lanes and deal out to their recommender, 40 ms apart, on the drift spring; the final layout is
// what is rendered, so nothing on the page shifts. Then every facet two recommenders share draws
// a hairline across the seam in --needs, with the warning icon and the words "Shared facet"; a
// facet an essay already uses is tagged with the essay's name.
//
// It plays once per plan version (remembered per viewer in localStorage) and is interruptible.
// With reduced motion the lanes are present from the first frame, fade over 120 ms, and the
// hairlines appear at once. Below 1024px the lanes stack and the hairlines become tags only.
// Colour never carries this on its own: every mark is a word as well, and the findings are a
// plain list under the board.

import type { CoverageView, LorOverlapFindingView } from "@admitstory/shared/kit";
import { WarningIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { spring } from "../motion";
import { CoverageEssaysList, traitWords } from "./coverage-list";
import { roleLine } from "./recommender-text";

/** Each facet deals out this long after the one before it. */
export const DEAL_STAGGER_S = 0.04;

const SEEN_PREFIX = "admitstory.coverage-plan:";

/** True when this viewer has already watched this plan version deal out. Storage may throw. */
export function hasSeenPlan(planVersion: number | null): boolean {
  if (planVersion === null) return true;
  try {
    return window.localStorage.getItem(`${SEEN_PREFIX}${planVersion}`) === "1";
  } catch {
    return true;
  }
}

export function markPlanSeen(planVersion: number | null): void {
  if (planVersion === null) return;
  try {
    window.localStorage.setItem(`${SEEN_PREFIX}${planVersion}`, "1");
  } catch {
    /* A private window keeps nothing; the board simply plays again next time. */
  }
}

export interface FacetMark {
  findingId: string;
  kind: "brief_brief" | "brief_essay";
  /** "Shared facet", "Same as Essay 1". */
  label: string;
}

const facetKey = (recommenderId: string, index: number) => `${recommenderId}:${index}`;

/**
 * Which facets a finding touches, by lane and row. A finding names the story and the side of it
 * that is shared, so a facet is marked when it tells the same story; where two facets of the same
 * story exist, the one whose words match the finding is marked first.
 */
export function facetMarks(
  coverage: CoverageView,
  findings: readonly LorOverlapFindingView[],
): Map<string, FacetMark> {
  const marks = new Map<string, FacetMark>();
  for (const finding of findings) {
    const label =
      finding.kind === "brief_brief"
        ? "Shared facet"
        : `Same as ${finding.places[0]?.label ?? "an essay"}`;
    for (const lane of coverage.lanes) {
      const candidates = lane.facets
        .map((facet, index) => ({ facet, index }))
        .filter((entry) => entry.facet.story === finding.story);
      const exact = candidates.find((entry) => entry.facet.facet === finding.facet);
      const chosen = exact ?? candidates[0];
      if (!chosen) continue;
      const key = facetKey(lane.recommenderId, chosen.index);
      if (!marks.has(key)) marks.set(key, { findingId: finding.id, kind: finding.kind, label });
    }
  }
  return marks;
}

interface Chord {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The hairlines to draw: one per shared facet, from the left lane's row to the right lane's. */
function chordsFor(
  board: HTMLElement,
  rows: Map<string, HTMLElement | null>,
  coverage: CoverageView,
  findings: readonly LorOverlapFindingView[],
  marks: Map<string, FacetMark>,
): Chord[] {
  const [left, right] = coverage.lanes;
  if (!left || !right || coverage.lanes.length !== 2) return [];
  const frame = board.getBoundingClientRect();
  const chords: Chord[] = [];
  for (const finding of findings) {
    if (finding.kind !== "brief_brief") continue;
    const find = (recommenderId: string): HTMLElement | null => {
      for (const [key, mark] of marks)
        if (mark.findingId === finding.id && key.startsWith(`${recommenderId}:`))
          return rows.get(key) ?? null;
      return null;
    };
    const a = find(left.recommenderId);
    const b = find(right.recommenderId);
    if (!a || !b) continue;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    if (ra.width === 0 || rb.width === 0) continue;
    chords.push({
      id: finding.id,
      x1: ra.right - frame.left,
      y1: ra.top + ra.height / 2 - frame.top,
      x2: rb.left - frame.left,
      y2: rb.top + rb.height / 2 - frame.top,
    });
  }
  return chords;
}

function sameChords(a: readonly Chord[], b: readonly Chord[]): boolean {
  return (
    a.length === b.length &&
    a.every((chord, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        chord.id === other.id &&
        Math.abs(chord.x1 - other.x1) < 0.5 &&
        Math.abs(chord.y1 - other.y1) < 0.5 &&
        Math.abs(chord.x2 - other.x2) < 0.5 &&
        Math.abs(chord.y2 - other.y2) < 0.5
      );
    })
  );
}

export interface CoverageBoardProps {
  coverage: CoverageView;
  /** The findings that still stand (dismissed ones are left out). */
  findings: readonly LorOverlapFindingView[];
  className?: string;
}

export function CoverageBoard({ coverage, findings, className }: CoverageBoardProps) {
  const reduced = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLElement | null>());
  const [chords, setChords] = useState<Chord[]>([]);
  const [play] = useState(() => !hasSeenPlan(coverage.planVersion));
  const marks = facetMarks(coverage, findings);
  const paired = coverage.lanes.length === 2;

  useEffect(() => {
    if (play) markPlanSeen(coverage.planVersion);
  }, [play, coverage.planVersion]);

  // The hairlines are measured from the layout that was actually rendered, so they follow the
  // text however it wraps, and they are redrawn when the board changes size.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !paired) return;
    const measure = () => {
      const next = chordsFor(
        board,
        rows.current,
        coverage,
        findings,
        facetMarks(coverage, findings),
      );
      // Only a changed measurement re-renders, so a parent that rebuilds its props every render
      // (a filtered findings array, say) can never put the board in a loop.
      setChords((previous) => (sameChords(previous, next) ? previous : next));
    };
    const frame = requestAnimationFrame(measure);
    if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [coverage, findings, paired]);

  // Every facet on the board deals one stagger step after the last, lane by lane, so the order
  // is the reading order. The offsets are derived, never counted up during render.
  const laneOffsets = coverage.lanes.reduce<number[]>(
    (offsets, lane, index) => [...offsets, (offsets[index] ?? 0) + lane.facets.length],
    [0],
  );

  return (
    <div ref={boardRef} className={cx("plane relative flex flex-col gap-8 p-5 sm:p-6", className)}>
      {/* The seam the facets deal out of. */}
      {paired ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-6 left-1/2 hidden w-px bg-edge lg:block"
        />
      ) : null}

      <div
        className={cx(
          "flex flex-col gap-8",
          paired ? "lg:flex-row lg:gap-12" : "lg:flex-row lg:gap-8 lg:overflow-x-auto lg:pb-2",
        )}
        {...(paired
          ? {}
          : { tabIndex: 0, role: "group", "aria-label": "Your recommenders' lanes" })}
      >
        {coverage.lanes.map((lane, laneIndex) => (
          <section
            key={lane.recommenderId}
            className={cx("flex flex-col gap-3", paired ? "flex-1" : "lg:w-72 lg:shrink-0")}
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-text">{lane.name}</h3>
              <p className="text-sm text-text-soft">{roleLine(lane)}</p>
              {lane.strengths.length > 0 ? (
                <p className="text-sm text-text">{traitWords(lane.strengths)}</p>
              ) : null}
            </div>
            <ul className="flex flex-col border-t border-edge">
              {lane.facets.map((facet, index) => {
                const key = facetKey(lane.recommenderId, index);
                const mark = marks.get(key);
                const delay = ((laneOffsets[laneIndex] ?? 0) + index) * DEAL_STAGGER_S;
                return (
                  <motion.li
                    key={key}
                    ref={(element: HTMLLIElement | null) => {
                      rows.current.set(key, element);
                    }}
                    initial={
                      play
                        ? reduced
                          ? { opacity: 0 }
                          : { opacity: 0, x: laneIndex === 0 ? 20 : -20, y: 10 }
                        : false
                    }
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={
                      reduced
                        ? { duration: 0.12, ease: "linear", delay }
                        : { ...spring("drift"), delay }
                    }
                    className="flex flex-col gap-1 border-b border-edge py-3"
                  >
                    <span className="flex items-center gap-1.5 text-sm text-text-soft">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-voice" />
                      {facet.storyTitle}
                    </span>
                    <span className="text-text">{facet.facet}</span>
                    <span className="text-sm tabular-nums text-text-soft">{facet.evidence}</span>
                    {mark ? (
                      <span className="inline-flex items-center gap-1 self-start text-sm font-medium text-needs">
                        <WarningIcon size={16} aria-hidden className="shrink-0" />
                        {mark.label}
                      </span>
                    ) : null}
                  </motion.li>
                );
              })}
              {lane.facets.length === 0 ? (
                <li className="border-b border-edge py-3 text-sm text-text-soft">
                  No sides of a story assigned yet.
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      {/* The hairlines across the seam. Decoration: every one is a word in its facet too. */}
      {chords.length > 0 ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          {chords.map((chord) => (
            <motion.path
              key={chord.id}
              d={`M ${chord.x1} ${chord.y1} C ${(chord.x1 + chord.x2) / 2} ${chord.y1}, ${(chord.x1 + chord.x2) / 2} ${chord.y2}, ${chord.x2} ${chord.y2}`}
              fill="none"
              stroke="var(--needs)"
              strokeWidth={1}
              initial={reduced ? { opacity: 1 } : { pathLength: 0, opacity: 0.8 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : spring("glide")}
            />
          ))}
        </svg>
      ) : null}

      <CoverageEssaysList coverage={coverage} />
    </div>
  );
}
