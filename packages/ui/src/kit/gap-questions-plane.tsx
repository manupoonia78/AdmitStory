"use client";

import { KeyboardIcon, MicrophoneIcon } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";

export interface GapQuestionsPlaneProps {
  /** Blocking gaps found (spec §5.7 stage 4), or null while the gap check is still running. */
  count: number | null;
  onAnswerByVoice?: () => void;
  onTypeAnswers?: () => void;
  onSkip?: () => void;
  /** Replaces the three choices once one is taken (the questions, a thank-you line). */
  children?: ReactNode;
  className?: string;
}

/**
 * The calm side plane for gap questions during kit generation (spec §6.7, §6.10 screen F):
 * "While you wait: 4 quick questions would make these drafts stronger." It holds its height from
 * the start, so nothing moves when the gap check finishes.
 */
export function GapQuestionsPlane({
  count,
  onAnswerByVoice,
  onTypeAnswers,
  onSkip,
  children,
  className,
}: GapQuestionsPlaneProps) {
  const headingId = useId();
  const heading =
    count === null
      ? "Checking whether the drafts need anything else from you."
      : count === 0
        ? "Your stories cover everything these drafts need."
        : `While you wait: ${count} quick ${count === 1 ? "question" : "questions"} would make these drafts stronger.`;
  return (
    <section
      aria-labelledby={headingId}
      className={cx("plane flex min-h-40 flex-col gap-4 p-5", className)}
    >
      <h2
        id={headingId}
        aria-live="polite"
        className={cx("text-lg font-medium", count === null ? "text-text-soft" : "text-text")}
      >
        {heading}
      </h2>
      {children ??
        (count ? (
          <div className="flex flex-wrap gap-2">
            <Button icon={MicrophoneIcon} onClick={onAnswerByVoice}>
              Answer by voice
            </Button>
            <Button variant="secondary" icon={KeyboardIcon} onClick={onTypeAnswers}>
              Type answers
            </Button>
            <Button variant="quiet" onClick={onSkip}>
              Skip, draft with gaps
            </Button>
          </div>
        ) : null)}
    </section>
  );
}
