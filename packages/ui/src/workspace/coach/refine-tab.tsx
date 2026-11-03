"use client";

import { ArrowCounterClockwiseIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/button";
import { TextField } from "../../components/text-field";

/** The quick actions (spec §5.8 Refine), in the spec's order. */
export const QUICK_ACTIONS = [
  { id: "cut_to_limit", label: "Cut to limit" },
  { id: "warmer", label: "Warmer" },
  { id: "more_specific", label: "More specific" },
  { id: "sound_like_me", label: "Sound more like me" },
  { id: "stronger_opening", label: "Stronger opening" },
  { id: "stronger_ending", label: "Stronger ending" },
  { id: "different_story", label: "Use a different story" },
  { id: "deeper_reflection", label: "Make the reflection deeper" },
  { id: "answer_part_2", label: "Answer part 2 of the prompt better" },
] as const;

export type QuickActionId = (typeof QUICK_ACTIONS)[number]["id"];

export interface RefineRequest {
  /** What the applicant asked, or the quick action's label. */
  instruction: string;
  action: QuickActionId | null;
}

export interface RefineTabProps {
  onRefine: (request: RefineRequest) => void;
  /** "working" while the Reviser runs; "failed" when nothing changed. */
  status?: "idle" | "working" | "failed";
  /** For the failure line: the paragraph that wasn't changed (1-based), if one was targeted. */
  failedParagraph?: number | null;
  /** Re-send the last request after a failure. */
  onRetry?: () => void;
  /** When the draft is over its limit: "14 words over. Cut to limit?" with "Cut to 200 words". */
  over?: { by: number; limit: number; unit: "words" | "characters" } | null;
  /** What a change will touch: "Paragraph 2", "The whole draft". */
  target?: string;
  /**
   * Hold-to-talk: a RecordButton (Space to talk) that fills the request by voice. The slot is
   * the caller's, so voice code loads only where it is used.
   */
  voiceSlot?: ReactNode;
  /** Quick actions to leave out, e.g. "answer_part_2" when the prompt has one part. */
  hide?: readonly QuickActionId[];
}

/**
 * Coach tab 3, "Refine" (spec §5.8): ask for a change in words or by voice, or pick a quick
 * action. Each change comes back as a diff to keep or undo, never a silent rewrite.
 */
export function RefineTab({
  onRefine,
  status = "idle",
  failedParagraph = null,
  onRetry,
  over = null,
  target,
  voiceSlot,
  hide = [],
}: RefineTabProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const quickId = useId();
  const working = status === "working";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;
    const instruction = value.trim();
    if (!instruction) {
      setError("Say what to change, or pick a quick change below.");
      return;
    }
    setError(undefined);
    onRefine({ instruction, action: null });
    setValue("");
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text">Refine</h2>

      {over && over.by > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-risk">
            {over.by} {over.by === 1 ? over.unit.replace(/s$/u, "") : over.unit} over. Cut to limit?
          </p>
          <Button
            icon={ScissorsIcon}
            className="self-start"
            disabled={working}
            onClick={() => onRefine({ instruction: "Cut to limit", action: "cut_to_limit" })}
          >
            Cut to {over.limit} {over.unit}
          </Button>
        </div>
      ) : null}

      <p aria-live="polite" className="min-h-[1lh] text-text">
        {status === "failed"
          ? failedParagraph
            ? `Paragraph ${failedParagraph} wasn’t changed. Ask again?`
            : "The draft wasn’t changed. Ask again?"
          : working
            ? `Working on ${target ? target.toLowerCase() : "the draft"}.`
            : ""}
      </p>
      {status === "failed" && onRetry ? (
        <Button
          variant="secondary"
          icon={ArrowCounterClockwiseIcon}
          className="-mt-3 self-start"
          onClick={onRetry}
        >
          Ask again
        </Button>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Ask for a change"
          name="request"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint={
            target
              ? `${target}. Each change comes back for you to keep or undo.`
              : "Each change comes back for you to keep or undo."
          }
          error={error}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" loading={working}>
            {working ? "Asking" : "Ask for this change"}
          </Button>
          {voiceSlot}
        </div>
      </form>

      <section aria-labelledby={quickId} className="flex flex-col gap-2">
        <h3 id={quickId} className="font-medium text-text">
          Quick changes
        </h3>
        <ul className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.filter((action) => !hide.includes(action.id)).map((action) => (
            <li key={action.id}>
              <Button
                size="sm"
                variant="secondary"
                disabled={working}
                onClick={() => onRefine({ instruction: action.label, action: action.id })}
              >
                {action.label}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
