"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { diffWords, type DiffToken } from "./diff";

export interface OptionSide {
  /** "Option A". */
  label: string;
  /** The angle in a line: "The night-shift fix, told as one night". */
  pitch?: string;
  /** The draft, one string per paragraph. */
  paragraphs: readonly string[];
  recommended?: boolean;
}

export interface OptionSplitProps {
  left: OptionSide;
  right: OptionSide;
  /** Where the divider starts, as the left share, 0.2–0.8. Default 0.5. */
  initial?: number;
  /** "Use this option" on either side. */
  onUse?: (side: "left" | "right") => void;
  className?: string;
}

export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
const STEP = 0.05;
const PAGE = 0.1;
/** How close (px) the divider must come for a differing word to glow. */
const NEAR_PX = 140;
/** How long words keep glowing after the divider stops. */
const GLOW_HOLD_MS = 700;

export const clampSplit = (value: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));

/** The divider's next position for a key, or null when the key isn't one it handles. */
export function splitForKey(value: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampSplit(value - STEP);
    case "ArrowRight":
    case "ArrowUp":
      return clampSplit(value + STEP);
    case "PageDown":
      return clampSplit(value - PAGE);
    case "PageUp":
      return clampSplit(value + PAGE);
    case "Home":
      return SPLIT_MIN;
    case "End":
      return SPLIT_MAX;
    default:
      return null;
  }
}

/** Each paragraph pair's word diff; a paragraph without a partner differs throughout. */
function pairDiffs(left: readonly string[], right: readonly string[]): DiffToken[][] {
  const count = Math.max(left.length, right.length);
  return Array.from({ length: count }, (_, i) => diffWords(left[i] ?? "", right[i] ?? ""));
}

/**
 * Options compare, the hero of choosing an angle (spec §6.7): two drafts side by side with a
 * divider to drag. Words that differ between them are marked, and they glow softly as the divider
 * passes near, then settle. The divider is a focusable separator: arrow keys move it 5%, Page Up
 * and Page Down 10%, Home and End to either limit. Below 640px the drafts stack and the differing
 * words stay marked. Reduced motion: the glow appears and goes without a transition.
 */
export function OptionSplit({ left, right, initial = 0.5, onUse, className }: OptionSplitProps) {
  const [split, setSplit] = useState(clampSplit(initial));
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const leftId = useId();
  const rightId = useId();
  const diffs = useMemo(
    () => pairDiffs(left.paragraphs, right.paragraphs),
    [left.paragraphs, right.paragraphs],
  );

  // Light the differing words near the divider. Direct DOM writes: nothing re-renders per frame.
  const glow = () => {
    const container = containerRef.current;
    const divider = dividerRef.current;
    if (!container || !divider) return;
    const x = divider.getBoundingClientRect().left + divider.offsetWidth / 2;
    for (const word of container.querySelectorAll<HTMLElement>("[data-differs]")) {
      const box = word.getBoundingClientRect();
      const distance = Math.min(Math.abs(box.left - x), Math.abs(box.right - x));
      if (distance <= NEAR_PX) word.dataset.near = "";
      else delete word.dataset.near;
    }
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      for (const word of container.querySelectorAll<HTMLElement>("[data-near]")) {
        delete word.dataset.near;
      }
    }, GLOW_HOLD_MS);
  };

  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    const frame = requestAnimationFrame(glow);
    return () => cancelAnimationFrame(frame);
  }, [split]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const move = (value: number) => {
    moved.current = true;
    setSplit(clampSplit(value));
  };

  const fromPointer = (clientX: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    move((clientX - box.left) / box.width);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromPointer(event.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const next = splitForKey(split, event.key);
    if (next === null) return;
    event.preventDefault();
    move(next);
  };

  const percent = Math.round(split * 100);
  return (
    <div
      ref={containerRef}
      className={cx(
        "relative grid gap-y-8 sm:grid-cols-[minmax(0,var(--split-left))_2.75rem_minmax(0,var(--split-right))]",
        className,
      )}
      style={{ "--split-left": `${split}fr`, "--split-right": `${1 - split}fr` } as CSSProperties}
      data-split={percent}
    >
      <Column
        id={leftId}
        side={left}
        diffs={diffs}
        which="left"
        onUse={onUse ? () => onUse("left") : undefined}
      />
      <div
        ref={dividerRef}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuemin={SPLIT_MIN * 100}
        aria-valuemax={SPLIT_MAX * 100}
        aria-valuenow={percent}
        aria-valuetext={`${left.label} ${percent}%, ${right.label} ${100 - percent}%`}
        aria-label={`Width of ${left.label} and ${right.label}`}
        aria-controls={`${leftId} ${rightId}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="group relative hidden cursor-col-resize touch-none justify-center rounded-control sm:flex"
      >
        <span
          aria-hidden
          className="h-full w-px bg-edge transition-colors duration-(--spring-snap-duration) ease-snap group-hover:bg-control group-focus-visible:bg-signal motion-reduce:transition-none"
        />
        <span
          aria-hidden
          className="absolute top-24 flex h-11 w-6 items-center justify-center gap-0.5 rounded-control border border-control bg-depth"
        >
          <span className="h-4 w-px bg-control" />
          <span className="h-4 w-px bg-control" />
        </span>
      </div>
      <Column
        id={rightId}
        side={right}
        diffs={diffs}
        which="right"
        onUse={onUse ? () => onUse("right") : undefined}
      />
    </div>
  );
}

// Differing words carry a faint veil at rest; near the divider they glow softly in --signal,
// on `glide`. Not --voice: these are drafts, not the applicant's own words.
const DIFFERS =
  "rounded-[2px] bg-veil box-decoration-clone transition-[box-shadow,background-color] duration-(--spring-glide-duration) ease-glide motion-reduce:transition-none " +
  "data-[near]:shadow-[0_0_0.8em_color-mix(in_srgb,var(--signal)_45%,transparent)] " +
  "forced-colors:underline forced-colors:decoration-dotted";

function Column({
  id,
  side,
  diffs,
  which,
  onUse,
}: {
  id: string;
  side: OptionSide;
  diffs: DiffToken[][];
  which: "left" | "right";
  onUse: (() => void) | undefined;
}) {
  const skip = which === "left" ? "added" : "removed";
  return (
    <section id={id} aria-label={side.label} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-medium text-text">
            {side.label}
            {side.recommended ? (
              <span className="font-normal text-text-soft">, recommended</span>
            ) : null}
          </h3>
          {side.pitch ? <p className="text-sm text-text-soft">{side.pitch}</p> : null}
        </div>
        {onUse ? (
          <Button size="sm" variant="secondary" onClick={onUse}>
            Use {side.label}
          </Button>
        ) : null}
      </header>
      <div className="flex flex-col gap-[1lh] font-reading text-read text-text">
        {diffs.map((tokens, index) => {
          const words = tokens.filter((token) => token.kind !== skip);
          if (words.length === 0) return null;
          return (
            <p key={index}>
              {words.map((token, i) => (
                <span key={token.key}>
                  {i > 0 ? " " : null}
                  {token.kind === "same" ? (
                    token.text
                  ) : (
                    <span data-differs className={DIFFERS}>
                      {token.text}
                    </span>
                  )}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    </section>
  );
}
