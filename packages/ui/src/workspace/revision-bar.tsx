"use client";

import { ArrowCounterClockwiseIcon, CheckIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { useMotionToken } from "../motion";
import { usePlainKey } from "./shortcuts";
import type { MorphDecision } from "./diff-morph";

export interface RevisionBarProps {
  decision: MorphDecision;
  /** What changed, e.g. "Paragraph 2 rewritten. Review the change." (spec §6.9). */
  message: ReactNode;
  /** Shown once the change is kept. */
  keptMessage?: ReactNode;
  /** Shown while an undone change morphs back out. */
  undoneMessage?: ReactNode;
  /** A detail line, such as the word count after the change. */
  detail?: ReactNode;
  onKeep: () => void;
  onUndo: () => void;
  /** Also listen for A (keep) and R (undo) outside text fields (spec §6.12). Default true. */
  shortcuts?: boolean;
  className?: string;
}

/**
 * Keep or undo one refinement (spec §5.8 Refine, §6.9 "Keep change" / "Undo"). It takes focus
 * when it appears so keyboard users land on the decision, and keeps it when its own buttons
 * change. A keeps and R undoes from anywhere outside a text field. After keeping, Undo stays
 * available, and pressing it mid-morph reverses the morph.
 */
export function RevisionBar({
  decision,
  message,
  keptMessage = "Change kept.",
  undoneMessage = "Change undone.",
  detail,
  onKeep,
  onUndo,
  shortcuts = true,
  className,
}: RevisionBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const transition = useMotionToken("glide");
  usePlainKey("a", onKeep, shortcuts && decision === "pending");
  usePlainKey("r", onUndo, shortcuts && decision !== "undone");

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // A pressed button may disappear with the state; hold focus on the bar instead of losing it.
  const keep = () => {
    onKeep();
    ref.current?.focus({ preventScroll: true });
  };
  const undo = () => {
    onUndo();
    ref.current?.focus({ preventScroll: true });
  };

  return (
    <motion.div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={messageId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
      className={cx(
        "plane flex flex-col gap-3 p-4 font-ui text-base sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <p id={messageId} aria-live="polite" className="font-medium text-text">
          {decision === "kept" ? keptMessage : decision === "undone" ? undoneMessage : message}
        </p>
        {detail ? <p className="text-sm text-text-soft tabular-nums">{detail}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {decision === "pending" ? (
          <Button icon={CheckIcon} onClick={keep} aria-keyshortcuts={shortcuts ? "A" : undefined}>
            Keep change
          </Button>
        ) : null}
        {decision !== "undone" ? (
          <Button
            variant="secondary"
            icon={ArrowCounterClockwiseIcon}
            onClick={undo}
            aria-keyshortcuts={shortcuts ? "R" : undefined}
          >
            Undo
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}
