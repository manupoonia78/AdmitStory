"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { useState, type CSSProperties } from "react";
import { cx } from "../lib/cx";
import { REDUCED_FADE } from "../motion";
import { streamedSentences } from "./sentences";

/** Spec §6.6: each streamed sentence fades up from 0 to 100% over 180 ms. Opacity only. */
const SENTENCE_FADE: Transition = { duration: 0.18, ease: "linear" };

export interface StreamingTextProps {
  /** Everything received so far. Only finished sentences are shown. */
  text: string;
  /** The stream has ended: show the last sentence too. */
  done?: boolean;
  /**
   * Space held for what is still coming, so nothing below moves as text arrives (spec §6.1):
   * the expected text (its exact shape is reserved, invisibly) or a number of lines.
   */
  reserve?: string | number;
  /**
   * Announce each finished sentence to screen readers (aria-live="polite"). Turn it off when
   * several streams run at once and something else reports progress.
   */
  live?: boolean;
  className?: string;
}

/**
 * Text that arrives sentence by sentence (spec §6.6). A sentence appears only once it is whole,
 * so screen readers hear whole sentences and nothing ever changes mid-word.
 */
export function StreamingText({
  text,
  done = false,
  reserve,
  live = true,
  className,
}: StreamingTextProps) {
  const reduced = useReducedMotion();
  const { complete } = streamedSentences(text, done);
  const lines = typeof reserve === "number" ? reserve : 0;
  const style: CSSProperties | undefined = lines ? { minHeight: `${lines}lh` } : undefined;

  // Sentences that are already whole on the first render were never streamed in: they arrive with
  // the view and so start at full opacity. Only what lands afterwards fades up. This also keeps
  // the server's HTML readable, since a fade would render the text at opacity 0 until hydration.
  const [settled, setSettled] = useState(complete.length);
  // A replaced stream (replaying a scripted run) drops back to fewer sentences and starts over:
  // from there on every sentence is streamed, so every sentence fades.
  if (complete.length < settled) setSettled(0);

  return (
    <div className={cx("grid", className)} style={style} data-done={done ? "" : undefined}>
      {typeof reserve === "string" ? (
        <p aria-hidden className="invisible col-start-1 row-start-1">
          {reserve}
        </p>
      ) : null}
      <p
        className="col-start-1 row-start-1"
        aria-live={live ? "polite" : undefined}
        aria-relevant={live ? "additions" : undefined}
      >
        {complete.map((sentence, index) => (
          <motion.span
            // Sentences only append; the text in the key restarts the fade if a stream is replaced.
            key={`${index}:${sentence}`}
            initial={index < settled ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? REDUCED_FADE : SENTENCE_FADE}
          >
            {index > 0 ? " " : null}
            {sentence}
          </motion.span>
        ))}
      </p>
    </div>
  );
}
