"use client";

// One candidate in the Form Advisor (spec §5.10): what it is, the one-sentence reason, the
// applicant's own facts behind it, and for items that go in the form, the entry with a live count
// by the school's rule and "Copy for portal". Coach mode (the school's AI policy) never shows a
// written entry: the applicant's material sits above an empty field they write in themselves.

import { ClipboardTextIcon, QuestionIcon } from "@phosphor-icons/react";
import { countAfterNormalize, normalizeForPortal } from "@admitstory/linters";
import type { FormItem, FormNeed } from "@admitstory/shared/kit";
import { useId, useState } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { LimitCounter } from "../workspace/limit-counter";
import type { CountRule } from "../workspace/portal-text";
import { entryCount, isEntryLane } from "./form-text";

export interface FormCitation {
  /** The F/S code. Internal: never shown, only used as a key. */
  code: string;
  /** What the fact is, in the applicant's terms: "Ran the Saturday coding class". */
  label: string;
  /** Their own words, as the Dossier holds them. */
  excerpt: string;
}

export interface FormAdvisorItem extends FormItem {
  /** The resolved F/S codes: the applicant's own facts behind this candidate. */
  citations: readonly FormCitation[];
  /** The applicant's edited entry. Wins over `entry.text`. */
  userText: string | null;
}

export type FormAdvisorMode = "draft" | "coach";

export interface FormItemViewProps {
  item: FormAdvisorItem;
  mode: FormAdvisorMode;
  rule: CountRule | null;
  /** combine_with: the other candidate's name. */
  combineWith?: string | null;
  /** move_to_essay: where it goes, in words ("Essay 2"). */
  moveTo?: string | null;
  headingLevel: 2 | 3 | 4;
  onEditEntry: (itemId: string, text: string) => void;
  onCopy: (itemId: string, text: string) => void;
  /** Leave-out items are quiet: name and reason only. */
  quiet?: boolean;
}

/** A detail the entry needs that only the applicant knows (§5.8 NEED). Shown, not a control. */
export function NeedTag({ need, className }: { need: FormNeed; className?: string }) {
  return (
    <span
      className={cx(
        "inline-block max-w-full rounded-control border border-dashed border-needs px-1.5 py-0.5 text-sm text-needs",
        className,
      )}
    >
      <QuestionIcon size={16} aria-hidden className="mr-1 inline-block align-[-0.2em]" />
      <span className="sr-only">Needs you:</span>{" "}
      {`${need.question} About ${need.approx_words} words.`}
    </span>
  );
}

function Citations({
  citations,
  label,
  prominent,
}: {
  citations: readonly FormCitation[];
  label: string;
  prominent: boolean;
}) {
  const id = useId();
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p id={id} className={cx("text-sm", prominent ? "font-medium text-text" : "text-text-soft")}>
        {label}
      </p>
      <ul
        aria-labelledby={id}
        className={cx("flex flex-col gap-1.5", prominent ? "text-base" : "text-sm")}
      >
        {citations.map((citation) => (
          <li key={citation.code} className="flex flex-col">
            <span className={prominent ? "text-text" : "text-text-soft"}>{citation.label}</span>
            {citation.excerpt ? (
              <q className={cx("text-text-soft", prominent ? "text-sm" : undefined)}>
                {citation.excerpt}
              </q>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryEditor({
  itemId,
  label,
  initial,
  seed,
  rule,
  onEditEntry,
  onCopy,
}: {
  itemId: string;
  label: string;
  /** What the field starts with: the applicant's edit, else the written entry. */
  initial: string;
  /** Changes when the advice is refreshed, which resets the field to `initial`. */
  seed: string | null;
  rule: CountRule | null;
  onEditEntry: FormItemViewProps["onEditEntry"];
  onCopy: FormItemViewProps["onCopy"];
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(seed);
  const [error, setError] = useState("");
  if (seed !== seen) {
    setSeen(seed);
    setValue(initial);
  }
  const count = rule ? entryCount(value, rule) : countAfterNormalize(value, "words");

  const copy = async () => {
    const text = normalizeForPortal(value);
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      onCopy(itemId, text);
    } catch {
      setError("Your browser blocked copying. Select the entry and copy it instead.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`${id}-entry`} className="pt-px text-sm font-medium text-text">
          {label}
        </label>
        {rule ? (
          <div id={`${id}-count`}>
            <LimitCounter count={count} limit={rule.limit} unit={rule.unit} />
          </div>
        ) : (
          <p id={`${id}-count`} className="text-sm tabular-nums text-text-soft">
            {count} {count === 1 ? "word" : "words"}
          </p>
        )}
      </div>
      <textarea
        id={`${id}-entry`}
        rows={4}
        value={value}
        spellCheck
        onChange={(event) => {
          setValue(event.target.value);
          onEditEntry(itemId, event.target.value);
        }}
        aria-describedby={`${id}-count`}
        className="w-full resize-y rounded-control border border-control bg-depth px-3 py-2 font-ui text-lg text-text placeholder:text-text-soft sm:text-base"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          icon={ClipboardTextIcon}
          disabled={!value.trim()}
          onClick={() => void copy()}
        >
          Copy for portal
        </Button>
        <p aria-live="polite" className="text-sm text-risk">
          {error}
        </p>
      </div>
    </div>
  );
}

export function FormItemView({
  item,
  mode,
  rule,
  combineWith,
  moveTo,
  headingLevel,
  onEditEntry,
  onCopy,
  quiet = false,
}: FormItemViewProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const coach = mode === "coach";
  const entryLane = isEntryLane(item.recommendation);
  const written = coach ? null : (item.entry?.text ?? null);
  return (
    <article aria-labelledby={id} data-item={item.id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading
          id={id}
          className={cx("font-semibold", quiet ? "text-base text-text-soft" : "text-lg text-text")}
        >
          {item.candidate}
        </Heading>
        {combineWith ? (
          <p className="text-sm text-text-soft">
            Combine with: <span className="font-medium text-text">{combineWith}</span>
          </p>
        ) : null}
        {moveTo ? (
          <p className="text-sm text-text-soft">
            Move to: <span className="font-medium text-text">{moveTo}</span>
          </p>
        ) : null}
        <p className={quiet ? "text-text-soft" : "text-text"}>{item.reason}</p>
      </div>

      {quiet ? null : (
        <Citations
          citations={item.citations}
          label={coach && entryLane ? "Your material" : "From your Dossier"}
          prominent={coach && entryLane}
        />
      )}

      {entryLane ? (
        <EntryEditor
          itemId={item.id}
          label={written === null ? "Write your entry" : "Entry"}
          initial={item.userText ?? written ?? ""}
          seed={written}
          rule={rule}
          onEditEntry={onEditEntry}
          onCopy={onCopy}
        />
      ) : null}

      {!quiet && item.stronger.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text">Make it stronger</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-text-soft marker:text-text-soft">
            {item.stronger.map((pointer) => (
              <li key={pointer}>{pointer}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!quiet && item.needs.length > 0 ? (
        <ul aria-label="Details only you know" className="flex flex-wrap gap-2">
          {item.needs.map((need) => (
            <li key={need.question} className="max-w-full">
              <NeedTag need={need} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
