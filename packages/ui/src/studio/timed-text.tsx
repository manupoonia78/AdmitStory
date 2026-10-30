"use client";

// Text that follows speech word by word (spec §6.4): the Studio question brightening as it is
// read aloud, and live-mock captions appearing as the interviewer speaks. The playback position is
// read from a clock every animation frame, and React only re-renders when another word starts, a
// few times a second. Screen readers get the sentence once, as plain text, not word fragments.

import { useReducedMotion } from "motion/react";
import { Fragment, useEffect, useEffectEvent, useState } from "react";
import { cx } from "../lib/cx";
import { readingEndMs, splitWords, spokenWordCount, type WordTiming } from "./word-timing";

/**
 * Playback position in ms since the speech began, or null when nothing is playing. A function, not
 * state, so playback never re-renders the page; pass a new function to start a new playback.
 */
export type PlaybackClock = () => number | null;

/**
 * How many words have been spoken, or null when every word should show in full: nothing is
 * playing, playback has ended, or the user prefers reduced motion (spec §6.6). `onEnd` fires once
 * when the last word finishes, reduced motion included.
 */
export function useSpokenWordCount(
  timings: readonly WordTiming[] | null | undefined,
  clock: PlaybackClock | null | undefined,
  onEnd?: () => void,
): number | null {
  const reduced = useReducedMotion();
  // Keyed by the clock, so a new playback starts dimmed on its very first render.
  const [tracked, setTracked] = useState<{ clock: PlaybackClock | null; count: number | null }>({
    clock: null,
    count: null,
  });
  const ended = useEffectEvent(() => onEnd?.());

  useEffect(() => {
    if (!clock || !timings || timings.length === 0) return;
    const end = readingEndMs(timings);
    let frame = 0;
    const tick = () => {
      const ms = clock();
      if (ms === null || ms >= end) {
        setTracked({ clock, count: null });
        if (ms !== null) ended();
        return;
      }
      const count = spokenWordCount(timings, ms);
      setTracked((prev) =>
        prev.clock === clock && prev.count === count ? prev : { clock, count },
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, timings]);

  if (reduced || !clock || !timings || timings.length === 0) return null;
  return tracked.clock === clock ? tracked.count : 0;
}

export interface TimedTextProps {
  text: string;
  /** One timing per word of `text`, in order. Without timings the text is simply shown. */
  timings?: readonly WordTiming[] | null;
  clock?: PlaybackClock | null;
  /**
   * Words not yet spoken: "dim" shows them in --text-soft (the Studio question, which is read in
   * full before it is heard); "hidden" keeps their space but hides them (captions), so the line
   * never reflows as words arrive.
   */
  upcoming?: "dim" | "hidden";
  onEnd?: () => void;
  className?: string;
}

export function TimedText({
  text,
  timings,
  clock,
  upcoming = "dim",
  onEnd,
  className,
}: TimedTextProps) {
  const count = useSpokenWordCount(timings, clock, onEnd);
  const words = splitWords(text);
  return (
    <span className={className} data-speaking={count === null ? undefined : ""}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => {
          const spoken = count === null || index < count;
          return (
            <Fragment key={index}>
              <span
                data-spoken={spoken ? "" : undefined}
                className={cx(
                  "transition-[color,opacity] duration-(--spring-glide-duration) ease-glide",
                  !spoken && (upcoming === "dim" ? "text-text-soft" : "opacity-0"),
                )}
              >
                {word}
              </span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          );
        })}
      </span>
    </span>
  );
}
