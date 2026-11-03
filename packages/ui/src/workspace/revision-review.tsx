"use client";

import { ArrowCounterClockwiseIcon, CheckIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { cssSpring, useMotionToken } from "../motion";
import { DiffMorph } from "./diff-morph";
import {
  changeText,
  nextPending,
  revisionMessage,
  type ChangeDecision,
  type RevisionChange,
} from "./revision";
import { usePlainKey } from "./shortcuts";

export interface RevisionReviewProps {
  changes: readonly RevisionChange[];
  /** Decisions so far, by paragraph id; missing means pending. Controlled. */
  decisions: Readonly<Record<string, ChangeDecision>>;
  onDecisionsChange: (decisions: Record<string, ChangeDecision>) => void;
  /**
   * Every change is decided and its morph has played (240 ms plus the glide spring): apply the
   * kept ones (`applyDecisions`) and end the review.
   */
  onSettled?: (decisions: Record<string, ChangeDecision>) => void;
  /** The Reviser's one-line summary, or the quick action ("Cut to limit"). */
  summary?: ReactNode;
  /** A detail line, e.g. the count with the change: "196 / 200 words". */
  detail?: ReactNode;
  /** Show each change's diff here too (phones, or when the canvas isn't on screen). */
  showDiff?: boolean;
  /** A keeps and R undoes the next undecided change, outside text fields (spec §6.12). */
  shortcuts?: boolean;
  className?: string;
}

const SETTLE_MS = 240 + cssSpring("glide").durationMs;

function decidedMessage(
  changes: readonly RevisionChange[],
  decisions: Readonly<Record<string, ChangeDecision>>,
): string {
  const kept = changes.filter((c) => decisions[c.paragraphId] === "kept");
  if (changes.length === 1) {
    const [change] = changes as [RevisionChange];
    return kept.length === 1
      ? `Change kept in paragraph ${change.number}.`
      : `Change undone. Paragraph ${change.number} is as it was.`;
  }
  if (kept.length === changes.length) return "All changes kept.";
  if (kept.length === 0) return "All changes undone. The draft is as it was.";
  return `${kept.length} of ${changes.length} changes kept.`;
}

/**
 * Keep or undo a refinement (spec §5.8 Refine, §6.9): "Paragraph 2 rewritten. Review the
 * change." with "Keep change" and "Undo"; with several paragraphs, all at once or one by one.
 * A keeps and R undoes the next undecided change. It takes focus when it appears, so keyboard
 * users land on the decision, and holds it when its buttons change. The canvas morphs each
 * paragraph as its decision lands; once all are decided and settled, `onSettled` applies them.
 */
export function RevisionReview({
  changes,
  decisions,
  onDecisionsChange,
  onSettled,
  summary,
  detail,
  showDiff = false,
  shortcuts = true,
  className,
}: RevisionReviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const transition = useMotionToken("glide");
  const next = nextPending(changes, decisions);
  const allDecided = changes.length > 0 && !next;
  const single = changes.length === 1;

  const decide = (paragraphId: string | "all", decision: ChangeDecision) => {
    const updated: Record<string, ChangeDecision> = { ...decisions };
    for (const change of changes) {
      if (paragraphId === "all" || change.paragraphId === paragraphId) {
        updated[change.paragraphId] = decision;
      }
    }
    onDecisionsChange(updated);
    ref.current?.focus({ preventScroll: true });
  };

  usePlainKey("a", () => next && decide(next.paragraphId, "kept"), shortcuts && Boolean(next));
  usePlainKey(
    "r",
    () => {
      if (next) decide(next.paragraphId, "undone");
      // A single kept change can still be undone, as in the toast.
      else if (single) decide("all", "undone");
    },
    shortcuts && (Boolean(next) || (single && decisions[changes[0]?.paragraphId ?? ""] === "kept")),
  );

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // Once everything is decided, let the morph play, then hand the decisions back.
  const decisionKey = changes.map((c) => decisions[c.paragraphId] ?? "pending").join(",");
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });
  useEffect(() => {
    if (!allDecided) return;
    const snapshot = { ...decisions };
    const timer = window.setTimeout(() => settledRef.current?.(snapshot), SETTLE_MS);
    return () => window.clearTimeout(timer);
    // decisionKey carries the decisions' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDecided, decisionKey]);

  const message = allDecided ? decidedMessage(changes, decisions) : revisionMessage(changes);

  return (
    <motion.div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={messageId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
      className={cx("plane flex flex-col gap-4 p-4 font-ui text-base", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p id={messageId} aria-live="polite" className="font-medium text-text">
            {message}
          </p>
          {summary ? <p className="text-sm text-text-soft">{summary}</p> : null}
          {detail ? <p className="text-sm text-text-soft tabular-nums">{detail}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Button
              icon={CheckIcon}
              onClick={() => decide("all", "kept")}
              aria-keyshortcuts={shortcuts && single ? "A" : undefined}
            >
              {single ? "Keep change" : "Keep all changes"}
            </Button>
          ) : null}
          {next || (single && decisions[changes[0]?.paragraphId ?? ""] === "kept") ? (
            <Button
              variant="secondary"
              icon={ArrowCounterClockwiseIcon}
              onClick={() => decide("all", "undone")}
              aria-keyshortcuts={shortcuts && single ? "R" : undefined}
            >
              {single ? "Undo" : "Undo all"}
            </Button>
          ) : null}
        </div>
      </div>

      {single && !showDiff ? null : (
        <ol className="flex flex-col divide-y divide-edge border-t border-edge">
          {changes.map((change) => {
            const decision = decisions[change.paragraphId] ?? "pending";
            const isNext = next?.paragraphId === change.paragraphId;
            return (
              <li
                key={change.paragraphId}
                data-change={change.paragraphId}
                data-decision={decision}
                className="flex flex-col gap-2 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text">
                    Paragraph {change.number}
                    <span className="font-normal text-text-soft">
                      {decision === "kept"
                        ? ", kept"
                        : decision === "undone"
                          ? ", undone"
                          : isNext && shortcuts
                            ? ", next for A or R"
                            : ""}
                    </span>
                  </p>
                  {single ? null : (
                    <div className="flex gap-2">
                      {decision === "pending" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={CheckIcon}
                          onClick={() => decide(change.paragraphId, "kept")}
                          aria-label={`Keep change to paragraph ${change.number}`}
                        >
                          Keep change
                        </Button>
                      ) : null}
                      {decision !== "undone" ? (
                        <Button
                          size="sm"
                          variant="quiet"
                          icon={ArrowCounterClockwiseIcon}
                          onClick={() => decide(change.paragraphId, "undone")}
                          aria-label={`Undo change to paragraph ${change.number}`}
                        >
                          Undo
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
                {showDiff ? (
                  <p className="font-reading text-read text-text">
                    <DiffMorph
                      before={changeText(change, "before")}
                      after={changeText(change, "after")}
                      decision={decision}
                    />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </motion.div>
  );
}
