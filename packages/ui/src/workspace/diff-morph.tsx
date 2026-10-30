"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { cx } from "../lib/cx";
import { REDUCED_FADE, cssSpring, spring } from "../motion";
import { diffRuns, diffSide, diffWords, type DiffToken } from "./diff";

/** "pending": the change is shown for review. "kept" / "undone": the decision, morphing in. */
export type MorphDecision = "pending" | "kept" | "undone";

export interface DiffMorphProps {
  before: string;
  after: string;
  decision: MorphDecision;
  /**
   * The state to show on the first frame, when it differs from `decision`: the morph then plays
   * straight after mount (e.g. initial "undone", decision "pending" to bring a change in).
   */
  initial?: MorphDecision;
  /** Called once the morph for `decision` has finished, so the caller can swap in plain text. */
  onSettled?: (decision: MorphDecision) => void;
  className?: string;
}

// Spec §6.6: old words fade and blur out, new words sharpen in, over 240 ms. Words that stay
// hold still meanwhile; afterwards they close the gaps on the glide spring.
const BLEND: Transition = { duration: 0.24, ease: "linear" };
const BLUR = "blur(4px)";
const SHARP = "blur(0px)";
const SETTLE_MS = 240 + cssSpring("glide").durationMs;
const REDUCED_SETTLE_MS = 120;

function visible(token: DiffToken, decision: MorphDecision): boolean {
  if (decision === "kept") return token.kind !== "removed";
  if (decision === "undone") return token.kind !== "added";
  return true;
}

/** What a screen reader hears: the change spelled out while pending, plain text after. */
function spokenText(tokens: readonly DiffToken[], decision: MorphDecision): string {
  if (decision === "kept") return diffSide(tokens, "after");
  if (decision === "undone") return diffSide(tokens, "before");
  return diffRuns(tokens)
    .map((run) =>
      run.kind === "same"
        ? run.text
        : run.kind === "removed"
          ? `[removed: ${run.text}]`
          : `[added: ${run.text}]`,
    )
    .join(" ");
}

/**
 * A revision blended into the text in place (spec §6.6 "Diffs morph"). While pending, removed
 * words are struck through and added words underlined. Keeping the change fades and blurs the old
 * words out and sharpens the new ones in; undoing does the reverse. A new decision mid-morph
 * reverses it from wherever it is. Reduced motion: an instant swap with a 120 ms fade, no blur and
 * no movement.
 *
 * Inline content: place it inside a <p>.
 */
export function DiffMorph({
  before,
  after,
  decision,
  initial,
  onSettled,
  className,
}: DiffMorphProps) {
  const reduced = useReducedMotion();
  const tokens = useMemo(() => diffWords(before, after), [before, after]);
  // Show `initial` for the first frame, then follow `decision`.
  const [armed, setArmed] = useState(initial === undefined || initial === decision);
  useEffect(() => {
    if (armed) return;
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [armed]);
  const shown = armed ? decision : (initial ?? decision);

  // Bumped when exiting words leave the layout, so the words that stay re-measure together and
  // glide into the gaps instead of jumping.
  const [reflow, setReflow] = useState(0);

  const settle = useEffectEvent(() => onSettled?.(decision));
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(settle, reduced ? REDUCED_SETTLE_MS : SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [armed, decision, reduced]);

  const pending = shown === "pending";
  return (
    <span className={cx("relative", className)} data-decision={shown}>
      <span className="sr-only">{spokenText(tokens, shown)}</span>
      <span aria-hidden data-reflow={reflow}>
        <LayoutGroup>
          <AnimatePresence initial={false} onExitComplete={() => setReflow((n) => n + 1)}>
            {tokens
              .filter((token) => visible(token, shown))
              .map((token, index) => (
                <motion.span
                  key={token.key}
                  data-diff={token.kind}
                  // Fades and blurs need no box, so the word and its space stay inline.
                  initial={reduced ? { opacity: 0 } : { opacity: 0, filter: BLUR }}
                  animate={
                    reduced
                      ? { opacity: 1 }
                      : token.kind !== "same" && !pending
                        ? { opacity: [0.35, 1], filter: [BLUR, SHARP] }
                        : { opacity: 1, filter: SHARP }
                  }
                  exit={reduced ? { opacity: 0 } : { opacity: 0, filter: BLUR }}
                  transition={reduced ? REDUCED_FADE : BLEND}
                >
                  {index > 0 ? " " : null}
                  <motion.span
                    layout={reduced ? false : "position"}
                    transition={spring("glide")}
                    className={cx(
                      "inline-block transition-colors duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                      pending &&
                        token.kind === "removed" &&
                        "text-text-soft line-through decoration-1",
                      pending &&
                        token.kind === "added" &&
                        "bg-veil underline decoration-text-soft decoration-1 underline-offset-4",
                    )}
                  >
                    {token.text}
                  </motion.span>
                </motion.span>
              ))}
          </AnimatePresence>
        </LayoutGroup>
      </span>
    </span>
  );
}
