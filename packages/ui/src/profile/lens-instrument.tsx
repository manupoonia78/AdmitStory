"use client";

// The Profile Read's hero (spec §6.7): a four-lens instrument. One dial cut into four quadrant
// arcs, Academics, Self-awareness, Employability and Leadership, each filled to its level and made
// of the stories behind it, one segment per story. The arcs fill as the dial comes into view;
// hover or focus an arc to see its stories beside the dial.
//
// How it moves: each arc is revealed by a mask whose stroke draws on the drift spring's CSS easing
// (tokens.css), 90 ms after the one before, once per page view. No Motion: the dial is SVG and CSS
// transitions, so it can sit in the route's first load. Under reduced motion the arcs are drawn at
// their level from the start and the dial fades in (spec §6.6).
//
// Keyboard: the dial is one Tab stop. Focusing an arc opens its lens; arrow keys move between
// arcs, Enter or Space reopens one, Escape closes it. Every arc is a labelled button ("Leadership: developing, from 3
// stories"), and LensList renders the same data as a plain list.

import { LENS_LABELS, type LensId } from "@admitstory/shared";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cx } from "../lib/cx";
import {
  LENS_DIAL,
  LENS_LEVEL_WORDS,
  arcPath,
  layoutLensDial,
  lensSummary,
  type LensArc,
} from "./lens-geometry";
import { usePrefersReducedMotion } from "./reduced-motion";
import type { LensReading } from "./types";

export interface LensInstrumentProps {
  readings: readonly LensReading[];
  /** A story in the panel was chosen: open it in the evidence drawer. */
  onOpenStory?: (storyId: string) => void;
  /** Names the instrument for assistive technology. */
  label?: string;
  className?: string;
}

/** The arc fills start this far apart, so the dial completes like a sweep. */
const STAGGER_MS = 90;
/** Share of the dial in view before it fills. */
const IN_VIEW = 0.4;

/** "a1b2" from React's "«r1»" or ":r1:", safe inside url(#…). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function LensInstrument({
  readings,
  onOpenStory,
  label = "Your four lenses",
  className,
}: LensInstrumentProps) {
  const arcs = layoutLensDial(readings);
  const reduced = usePrefersReducedMotion();
  const uid = safeId(useId());
  const panelId = `${uid}-panel`;
  const rootRef = useRef<HTMLElement>(null);
  const arcRefs = useRef<(SVGGElement | null)[]>([]);

  const [entered, setEntered] = useState(false);
  /** The lens kept open by focus, a click or Enter, until Escape or another arc. */
  const [active, setActive] = useState<LensId | null>(null);
  /** The lens under the pointer; it wins while the pointer is over the instrument. */
  const [hovered, setHovered] = useState<LensId | null>(null);
  /** Which arc holds the single Tab stop. */
  const [rover, setRover] = useState(0);
  const shown = hovered ?? active;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer to ask: draw on the next frame.
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: IN_VIEW },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function focusArc(index: number) {
    const count = arcs.length;
    const next = ((index % count) + count) % count;
    setRover(next);
    arcRefs.current[next]?.focus();
  }

  function onArcKeyDown(event: ReactKeyboardEvent<SVGGElement>, index: number, lens: LensId) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        focusArc(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        focusArc(index - 1);
        break;
      case "Home":
        focusArc(0);
        break;
      case "End":
        focusArc(arcs.length - 1);
        break;
      case "Enter":
      case " ":
        setActive(lens);
        break;
      case "Escape":
        setActive(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const shownArc = arcs.find((arc) => arc.lens === shown) ?? null;
  const totalStories = new Set(arcs.flatMap((arc) => arc.stories.map((story) => story.id))).size;
  const drawn = entered || reduced;

  return (
    <section
      ref={rootRef}
      aria-label={label}
      data-entered={entered ? "" : undefined}
      data-reduced={reduced ? "" : undefined}
      onPointerLeave={() => setHovered(null)}
      className={cx(
        "grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12",
        className,
      )}
    >
      <div
        className={cx(
          "relative mx-auto aspect-square w-full max-w-80",
          // Reduced motion: the whole dial fades in once it is in view (120 ms, tokens.css).
          reduced &&
            "transition-opacity duration-(--spring-drift-duration) ease-drift [&:not([data-in])]:opacity-0",
        )}
        data-in={entered ? "" : undefined}
      >
        <svg
          viewBox={`0 0 ${LENS_DIAL.size} ${LENS_DIAL.size}`}
          role="group"
          className="size-full overflow-visible"
        >
          <defs>
            {arcs.map((arc, index) => (
              <mask key={arc.lens} id={`${uid}-mask-${arc.lens}`} maskUnits="userSpaceOnUse">
                {arc.fillEnd > arc.trackStart ? (
                  <path
                    d={arcPath(arc.trackStart, arc.fillEnd)}
                    pathLength={1}
                    fill="none"
                    stroke="white"
                    strokeWidth={LENS_DIAL.stroke + 4}
                    strokeDasharray="1 1"
                    strokeDashoffset={drawn ? 0 : 1}
                    style={
                      reduced
                        ? undefined
                        : {
                            transition: `stroke-dashoffset var(--spring-drift-duration) var(--spring-drift) ${index * STAGGER_MS}ms`,
                          }
                    }
                  />
                ) : null}
              </mask>
            ))}
          </defs>
          {arcs.map((arc, index) => (
            <Arc
              key={arc.lens}
              arc={arc}
              maskId={`${uid}-mask-${arc.lens}`}
              panelId={panelId}
              tabIndex={index === rover ? 0 : -1}
              open={shown === arc.lens}
              dimmed={shown !== null && shown !== arc.lens}
              register={(node) => {
                arcRefs.current[index] = node;
              }}
              onFocus={() => {
                // Focus moved (keyboard or click): the focused lens is shown, not a stale hover.
                setHovered(null);
                setRover(index);
                setActive(arc.lens);
              }}
              onPointerEnter={() => setHovered(arc.lens)}
              onClick={() => setActive(arc.lens)}
              onKeyDown={(event) => onArcKeyDown(event, index, arc.lens)}
            />
          ))}
        </svg>
        {/* The centre readout repeats the focused arc's label, so it is hidden from AT. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          {shownArc ? (
            <>
              <span className="text-lg font-semibold text-text">{shownArc.label}</span>
              <span className="text-sm text-text-soft">{LENS_LEVEL_WORDS[shownArc.level]}</span>
            </>
          ) : (
            <>
              <span className="text-display-sm tabular-nums text-text">{totalStories}</span>
              <span className="text-sm text-text-soft">
                {totalStories === 1 ? "story" : "stories"}
              </span>
            </>
          )}
        </div>
      </div>

      <div id={panelId} className="min-h-40 min-w-0">
        {shownArc ? (
          <LensPanel arc={shownArc} onOpenStory={onOpenStory} />
        ) : (
          <p className="text-text-soft">
            {totalStories === 0
              ? "No stories behind your lenses yet. Talk for five minutes in Story Studio and they'll fill in."
              : "Choose a lens to see the stories behind it."}
          </p>
        )}
      </div>
    </section>
  );
}

interface ArcProps {
  arc: LensArc;
  maskId: string;
  panelId: string;
  tabIndex: number;
  open: boolean;
  dimmed: boolean;
  register: (node: SVGGElement | null) => void;
  onFocus: () => void;
  onPointerEnter: () => void;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => void;
}

function Arc({
  arc,
  maskId,
  panelId,
  tabIndex,
  open,
  dimmed,
  register,
  onFocus,
  onPointerEnter,
  onClick,
  onKeyDown,
}: ArcProps) {
  const ringGap = LENS_DIAL.stroke / 2 + 4;
  return (
    <g
      ref={register}
      role="button"
      tabIndex={tabIndex}
      aria-label={lensSummary(arc)}
      aria-expanded={open}
      aria-controls={panelId}
      data-lens={arc.lens}
      data-level={arc.level}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cx(
        "group cursor-pointer outline-none transition-opacity duration-(--spring-snap-duration) ease-snap",
        dimmed && "opacity-35",
      )}
    >
      {/* A wide invisible band over the whole quadrant: the arc is easy to hover and tap. */}
      <path
        d={arcPath(arc.trackStart, arc.trackEnd)}
        fill="none"
        stroke="transparent"
        strokeWidth={LENS_DIAL.stroke + 20}
        pointerEvents="stroke"
      />
      <path
        d={arcPath(arc.trackStart, arc.trackEnd)}
        fill="none"
        stroke="var(--edge)"
        strokeWidth={LENS_DIAL.stroke}
      />
      <g mask={`url(#${maskId})`} className="text-voice">
        {arc.segments.map((segment, index) => (
          <path
            key={segment.storyId ?? index}
            data-segment={segment.storyId ?? ""}
            d={arcPath(segment.start, segment.end)}
            fill="none"
            stroke="currentColor"
            strokeWidth={LENS_DIAL.stroke}
          />
        ))}
      </g>
      {/* Visible focus (spec §6.12): two --signal hairlines either side of the arc. */}
      <g className="opacity-0 group-focus-visible:opacity-100" stroke="var(--signal)" fill="none">
        <path
          d={arcPath(arc.trackStart, arc.trackEnd, LENS_DIAL.radius + ringGap)}
          strokeWidth={2}
        />
        <path
          d={arcPath(arc.trackStart, arc.trackEnd, LENS_DIAL.radius - ringGap)}
          strokeWidth={2}
        />
      </g>
    </g>
  );
}

function LensPanel({
  arc,
  onOpenStory,
}: {
  arc: LensArc;
  onOpenStory?: (storyId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-display-sm text-text">{LENS_LABELS[arc.lens]}</span>{" "}
        <span className="text-lg text-text-soft">{LENS_LEVEL_WORDS[arc.level]}</span>
      </h3>
      {arc.stories.length === 0 ? (
        <p className="text-text-soft">No stories behind this lens yet.</p>
      ) : (
        <ul className="flex flex-col border-t border-edge">
          {arc.stories.map((story) => (
            <li key={story.id} className="border-b border-edge">
              {onOpenStory ? (
                <button
                  type="button"
                  onClick={() => onOpenStory(story.id)}
                  className="flex min-h-11 w-full items-baseline justify-between gap-4 rounded-control py-2 text-left hover:bg-veil"
                >
                  <span className="text-signal">{story.title}</span>
                  {story.context ? (
                    <span className="shrink-0 text-sm text-text-soft">{story.context}</span>
                  ) : null}
                </button>
              ) : (
                <span className="flex min-h-11 items-baseline justify-between gap-4 py-2">
                  <span className="text-text">{story.title}</span>
                  {story.context ? (
                    <span className="shrink-0 text-sm text-text-soft">{story.context}</span>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
