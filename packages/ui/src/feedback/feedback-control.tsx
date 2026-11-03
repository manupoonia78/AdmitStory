"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import {
  FEEDBACK_REASON_LABELS,
  FEEDBACK_REASONS,
  type FeedbackReason,
  type FeedbackTarget,
} from "@admitstory/shared";
import { useId, useState } from "react";
import { buttonStyles } from "../components/button-styles";
import { cx } from "../lib/cx";

// "Was this useful?" (spec §15, Phase 9b decision 24): two 44 px icon buttons; after a thumbs-down,
// reason chips and an optional note for our team; then a thank-you. Quiet, at the foot of the
// thing it rates. No Radix and no dialogs, so it costs almost nothing on the routes it's mounted on.

export interface FeedbackControlProps {
  targetType: FeedbackTarget;
  targetId: string;
  /** Defaults to /api/feedback. */
  endpoint?: string;
  className?: string;
}

type Stage = "ask" | "why" | "sending" | "thanks" | "error";

export function FeedbackControl({
  targetType,
  targetId,
  endpoint = "/api/feedback",
  className,
}: FeedbackControlProps) {
  const [stage, setStage] = useState<Stage>("ask");
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();
  const headingId = useId();

  async function send(rating: 1 | -1, withReason: FeedbackReason | null) {
    setStage("sending");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          rating,
          ...(withReason ? { reason: withReason } : {}),
          ...(note.trim() ? { text: note.trim().slice(0, 500) } : {}),
        }),
      });
      setStage(response.ok ? "thanks" : "error");
    } catch {
      setStage("error");
    }
  }

  const icon = (Icon: typeof ThumbsUpIcon, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(buttonStyles({ variant: "quiet", shape: "icon" }), "min-h-11 min-w-11")}
    >
      <Icon size={20} aria-hidden />
    </button>
  );

  return (
    <section aria-labelledby={headingId} className={cx("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="font-medium text-text-soft">
          Was this useful?
        </h2>
        {stage === "ask" ? (
          <>
            {icon(ThumbsUpIcon, "Useful", () => void send(1, null))}
            {icon(ThumbsDownIcon, "Not useful", () => setStage("why"))}
          </>
        ) : null}
      </div>
      {stage === "why" ? (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-text-soft">What was wrong? (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(reason === r ? null : r)}
                  className={cx(
                    "min-h-11 rounded-full border px-3 text-text transition-colors",
                    reason === r
                      ? "border-signal bg-signal/10"
                      : "border-edge hover:border-text-soft",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  )}
                >
                  {FEEDBACK_REASON_LABELS[r]}
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor={noteId} className="flex flex-col gap-1 text-text-soft">
            A note for our team (optional)
            <textarea
              id={noteId}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20 rounded-control border border-control bg-depth p-2 text-base text-text focus-visible:outline-2 focus-visible:outline-signal"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
              onClick={() => void send(-1, reason)}
            >
              Send
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: "quiet", size: "sm" })}
              onClick={() => setStage("ask")}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="text-text-soft">
        {stage === "sending"
          ? "Sending…"
          : stage === "thanks"
            ? "Thanks. We read every one."
            : stage === "error"
              ? "That didn't send. Try again in a moment."
              : ""}
      </p>
    </section>
  );
}
