"use client";

import { cx } from "../lib/cx";
import { TimedText, type PlaybackClock } from "./timed-text";
import type { WordTiming } from "./word-timing";

export interface SpokenQuestionProps {
  text: string;
  /** TTS word timestamps for `text`. */
  timings?: readonly WordTiming[] | null;
  /** The TTS playback position; null when the question is not being read aloud. */
  clock?: PlaybackClock | null;
  /** The question is usually the screen's main heading. */
  as?: "h1" | "h2" | "h3" | "p";
  id?: string;
  /** Fires when the last word has been read: the Voiceprint leaves its listening state. */
  onReadingEnd?: () => void;
  className?: string;
}

/**
 * The interviewer's question (spec §6.4): Newsreader, 40–56px on wide screens. While it is read
 * aloud, each word brightens from --text-soft to --text as it is spoken, like karaoke subtitles
 * done with restraint. It is always on screen in full, so it doubles as the caption (spec §6.12).
 * With reduced motion every word is at full brightness.
 */
export function SpokenQuestion({
  text,
  timings,
  clock,
  as: Tag = "h2",
  id,
  onReadingEnd,
  className,
}: SpokenQuestionProps) {
  return (
    <Tag
      id={id}
      className={cx(
        // 28px on small phones so a two-sentence question fits above the fold; 56px at 1600px.
        "font-reading text-[length:clamp(1.75rem,1rem+2.6vw,3.5rem)] leading-[1.12] font-normal tracking-[-0.012em] text-balance text-text",
        className,
      )}
    >
      <TimedText text={text} timings={timings} clock={clock} onEnd={onReadingEnd} />
    </Tag>
  );
}
