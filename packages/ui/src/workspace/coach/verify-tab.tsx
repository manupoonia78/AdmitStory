"use client";

import { CheckIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/button";
import { StatusLabel } from "../../components/status-label";
import { TextField } from "../../components/text-field";
import { cx } from "../../lib/cx";
import { SourceLine, type PackSource } from "./source-line";

export type VerifyStatus = "open" | "confirmed" | "corrected";

/** Something the applicant must confirm before submitting (spec §5.7 stage 10, §5.8 Verify). */
export interface VerifyEntry {
  id: string;
  /** The claim as the draft states it: "4:40 a.m.: the time you found the timeout". */
  text: string;
  /** Why it needs them: "Reconstructed from your story; you didn't give the time." */
  reason: string;
  status: VerifyStatus;
  /** What they corrected it to. */
  correction?: string | null;
  /** For a school specific: where it comes from. */
  sources?: readonly PackSource[];
}

export interface VerifyItemProps {
  item: VerifyEntry;
  onConfirm: (id: string) => void;
  onCorrect: (id: string, correction: string) => void;
  className?: string;
}

/** One Verify item: the claim, why it needs the applicant, and Confirm or Correct. */
export function VerifyItem({ item, onConfirm, onCorrect, className }: VerifyItemProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.correction ?? "");
  const [error, setError] = useState<string | undefined>();

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const correction = value.trim();
    if (!correction) {
      setError("Write what's true, or cancel to keep it as it is.");
      return;
    }
    onCorrect(item.id, correction);
    setEditing(false);
    setError(undefined);
  };

  return (
    <li
      data-verify={item.id}
      data-status={item.status}
      className={cx("flex flex-col gap-1.5 py-3", className)}
    >
      {item.status === "confirmed" ? (
        <StatusLabel tone="verified">Confirmed</StatusLabel>
      ) : item.status === "corrected" ? (
        <StatusLabel tone="verified">Corrected</StatusLabel>
      ) : (
        <StatusLabel tone="needs">Needs you</StatusLabel>
      )}
      <p
        className={cx(
          "text-text",
          item.status === "corrected" && "text-text-soft line-through decoration-1",
        )}
      >
        {item.text}
      </p>
      {item.status === "corrected" && item.correction ? (
        <p className="text-text">
          <span className="sr-only">Corrected to: </span>
          {item.correction}
        </p>
      ) : null}
      <p className="text-sm text-text-soft">{item.reason}</p>
      {item.sources ? <SourceLine sources={item.sources} /> : null}
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2 pt-1">
          <TextField
            label="What's true"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            autoComplete="off"
            error={error}
            hint="It replaces this detail in the draft and in your Fact Sheet."
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Save correction
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : item.status === "open" ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" icon={CheckIcon} onClick={() => onConfirm(item.id)}>
            Confirm
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={PencilSimpleIcon}
            onClick={() => setEditing(true)}
          >
            Correct
          </Button>
        </div>
      ) : (
        <div className="pt-1">
          <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
            Change correction
          </Button>
        </div>
      )}
    </li>
  );
}

export interface VerifyListProps {
  items: readonly VerifyEntry[];
  onConfirm: VerifyItemProps["onConfirm"];
  onCorrect: VerifyItemProps["onCorrect"];
}

/**
 * Coach tab 5, "Verify" (spec §5.8): everything to confirm personally before submitting:
 * assumptions, reconstructed details, numbers, names, school specifics with their sources.
 */
export function VerifyList({ items, onConfirm, onCorrect }: VerifyListProps) {
  const open = items.filter((item) => item.status === "open").length;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-text">Verify</h2>
      <p className="text-text-soft tabular-nums" aria-live="polite">
        {items.length === 0
          ? "Nothing to confirm in this draft."
          : open === 0
            ? "Everything here is confirmed."
            : `Confirm these before you submit. ${items.length - open} of ${items.length} done.`}
      </p>
      <ul className="flex flex-col divide-y divide-edge">
        {items.map((item) => (
          <VerifyItem key={item.id} item={item} onConfirm={onConfirm} onCorrect={onCorrect} />
        ))}
      </ul>
    </div>
  );
}
