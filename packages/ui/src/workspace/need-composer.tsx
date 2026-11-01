"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../components/button";
import { FieldErrorRegion, FieldHint, Label } from "../components/text-field";
import { cx } from "../lib/cx";
import { countWords } from "./sentences";

export interface NeedComposerProps {
  /** The question as the chip asks it. */
  question: string;
  /** Roughly how long a good answer is. */
  approxWords: number;
  /** Save the answer: it goes to the dossier and only this paragraph regenerates (spec §5.8). */
  onSubmit: (answer: string) => void;
  onCancel: () => void;
  /** "saving" while the answer is stored and the paragraph redrafts. */
  status?: "idle" | "saving";
  /** A RecordButton that fills the answer by voice (Space to talk). */
  voiceSlot?: ReactNode;
  /** Text heard by voice, merged into the field as it arrives. */
  dictated?: string;
  className?: string;
}

/** "About 20 words. 12 so far." */
export function wordsHint(approxWords: number, count: number): string {
  const about = `About ${approxWords} words.`;
  return count === 0 ? about : `${about} ${count} so far.`;
}

/**
 * The mini-composer a NEED chip opens (spec §5.8): the question, a short answer in text or by
 * voice, and the length that works. Escape cancels. On phones the Workspace shows it in a bottom
 * sheet with the record button (design G).
 */
export function NeedComposer({
  question,
  approxWords,
  onSubmit,
  onCancel,
  status = "idle",
  voiceSlot,
  dictated,
  className,
}: NeedComposerProps) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [heard, setHeard] = useState(dictated);
  // New dictation lands in the field once, after whatever was typed.
  if (dictated !== heard) {
    setHeard(dictated);
    if (dictated)
      setValue((current) => (current.trim() ? `${current.trim()} ${dictated}` : dictated));
  }
  const saving = status === "saving";
  const count = countWords(value);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const answer = value.trim();
    if (!answer) {
      setError("Write a sentence or two, or cancel to answer later.");
      return;
    }
    setError(undefined);
    onSubmit(answer);
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      className={cx("plane flex flex-col gap-3 p-4 font-ui text-base", className)}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-answer`}>{question}</Label>
        <FieldHint id={`${id}-hint`} aria-live="polite" className="tabular-nums">
          {wordsHint(approxWords, count)} It goes into the draft as your own words.
        </FieldHint>
        <textarea
          id={`${id}-answer`}
          name="answer"
          rows={3}
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          aria-invalid={error ? true : undefined}
          className="w-full resize-y rounded-control border border-control bg-depth px-3 py-2 text-lg text-text placeholder:text-text-soft aria-invalid:border-risk sm:text-base"
        />
        <FieldErrorRegion id={`${id}-error`} error={error} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={saving}>
          {saving ? "Adding to draft" : "Add to draft"}
        </Button>
        {voiceSlot}
        <Button variant="quiet" onClick={onCancel}>
          Answer later
        </Button>
      </div>
    </form>
  );
}
