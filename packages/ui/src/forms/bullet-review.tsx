"use client";

// The context plane beside the résumé sheet (spec §5.10): the focused bullet's review. Verdict,
// issues, the one plain sentence, the suggested rewrite as a word diff against the original, a
// field for each detail only the applicant knows ([?1], [?2]…), and the decision: Keep rewrite (A),
// Keep mine (R), Edit, and Undo once decided. Keep stays disabled until every detail is answered,
// so nothing half-written reaches the sheet or the Word file.

import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CheckIcon,
  ListDashesIcon,
  PencilSimpleIcon,
  QuestionIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { placeholdersIn } from "@admitstory/linters";
import {
  RESUME_ISSUE_LABELS,
  type BulletDecision,
  type ResumeBullet,
} from "@admitstory/shared/kit";
import { useId, useState, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { diffRuns, diffWords } from "../workspace/diff";
import { BULLET_STATE_WORDS, bulletState } from "./resume-text";

const SLOT = /(\[\?\d{1,2}\])/u;
const SLOT_NUMBER = /^\[\?(\d{1,2})\]$/u;

/** A rewrite with the answers given so far; open placeholders stay as `[?n]`. */
export function previewRewrite(text: string, answers: readonly string[]): string {
  return text.replace(/\[\?(\d{1,2})\]/gu, (slot, n: string) => {
    const answer = answers[Number(n) - 1]?.trim();
    return answer ? answer : slot;
  });
}

/** Placeholders still to answer, as 1-based numbers. */
export function openPlaceholders(text: string, answers: readonly string[]): number[] {
  return placeholdersIn(text).filter((n) => !answers[n - 1]?.trim());
}

/** A word, with any open placeholder drawn as a --needs slot ("?1") instead of "[?1]". */
function Word({ text }: { text: string }) {
  if (!SLOT.test(text)) return <>{text}</>;
  return (
    <>
      {text.split(SLOT).map((part, i) => {
        const n = SLOT_NUMBER.exec(part)?.[1];
        return n ? (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded-control border border-dashed border-needs px-1 text-sm text-needs"
          >
            <QuestionIcon size={12} aria-hidden />
            {n}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}

/**
 * The rewrite against the original, word by word: removed words struck through in the soft
 * colour, added words underlined on --veil. Static (the morph plays on the sheet, not here); the
 * change is spelled out for screen readers.
 */
export function WordDiff({ before, after }: { before: string; after: string }) {
  const tokens = diffWords(before, after);
  const spoken = diffRuns(tokens)
    .map((run) =>
      run.kind === "same"
        ? run.text
        : run.kind === "removed"
          ? `[removed: ${run.text}]`
          : `[added: ${run.text}]`,
    )
    .join(" ")
    .replace(/\[\?(\d{1,2})\]/gu, "[detail $1 to add]");
  return (
    <>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden>
        {tokens.map((token, index) => (
          <span key={token.key} data-diff={token.kind}>
            {index > 0 ? " " : null}
            <span
              className={cx(
                token.kind === "removed" && "text-text-soft line-through decoration-1",
                token.kind === "added" &&
                  "bg-veil underline decoration-text-soft decoration-1 underline-offset-4",
              )}
            >
              <Word text={token.text} />
            </span>
          </span>
        ))}
      </span>
    </>
  );
}

function Shortcut({ letter }: { letter: string }) {
  // CSS-generated, so it stays out of the button's accessible name (WCAG 2.5.3).
  return (
    <kbd
      aria-hidden
      data-shortcut={letter}
      className="rounded-control border border-current/30 px-1 font-ui text-sm opacity-80 before:content-[attr(data-shortcut)]"
    />
  );
}

export interface BulletReviewProps {
  bullet: ResumeBullet;
  /** 1-based position on the sheet, and how many bullets there are. */
  position: number;
  total: number;
  decision: BulletDecision | undefined;
  answers: readonly string[];
  onAnswer: (n: number, value: string) => void;
  /** Ids for the placeholder fields: `${idPrefix}-q${n}`, so A can focus the first open one. */
  idPrefix: string;
  /** The bullet's text as it stands, to start an edit from. */
  currentText: string;
  onKeep: () => void;
  onKeepMine: () => void;
  onSaveEdit: (text: string) => void;
  onUndo: () => void;
  shortcuts: boolean;
  className?: string;
}

const DECIDED: Record<BulletDecision["status"], string> = {
  accepted: "Rewrite kept. It's on the sheet.",
  rejected: "You kept your own line.",
  edited: "Your edit is on the sheet.",
};

export function BulletReview({
  bullet,
  position,
  total,
  decision,
  answers,
  onAnswer,
  idPrefix,
  currentText,
  onKeep,
  onKeepMine,
  onSaveEdit,
  onUndo,
  shortcuts,
  className,
}: BulletReviewProps) {
  const headingId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const [editingFor, setEditingFor] = useState(bullet.id);
  // A different bullet closes the edit.
  if (editingFor !== bullet.id) {
    setEditingFor(bullet.id);
    setEditing(null);
  }
  const rewrite = bullet.rewrite;
  const slots = rewrite ? placeholdersIn(rewrite.text) : [];
  const open = rewrite ? openPlaceholders(rewrite.text, answers) : [];
  const state = bulletState(bullet, decision);
  const Verdict = bullet.verdict === "achievement" ? TrophyIcon : ListDashesIcon;

  let actions: ReactNode;
  if (editing !== null) {
    actions = (
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing.trim()) return;
          onSaveEdit(editing.trim());
          setEditing(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setEditing(null);
          }
        }}
      >
        <label htmlFor={`${idPrefix}-edit`} className="text-sm font-medium text-text">
          Your line
        </label>
        <textarea
          id={`${idPrefix}-edit`}
          rows={3}
          autoFocus
          value={editing}
          onChange={(event) => setEditing(event.target.value)}
          className="w-full resize-y rounded-control border border-control bg-depth px-3 py-2 font-ui text-lg text-text sm:text-base"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!editing.trim()}>
            Save my line
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  } else if (decision) {
    actions = (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 font-medium text-text">
          <CheckCircleIcon size={16} aria-hidden className="shrink-0 text-verified" />
          {DECIDED[decision.status]}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={ArrowCounterClockwiseIcon} onClick={onUndo}>
            Undo
          </Button>
          <Button
            size="sm"
            variant="quiet"
            icon={PencilSimpleIcon}
            onClick={() => setEditing(currentText)}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  } else {
    actions = (
      <div className="flex flex-wrap gap-2">
        {rewrite ? (
          <>
            <Button
              size="sm"
              icon={CheckIcon}
              disabled={open.length > 0}
              aria-describedby={open.length > 0 ? `${idPrefix}-open` : undefined}
              aria-keyshortcuts={shortcuts ? "A" : undefined}
              onClick={onKeep}
            >
              Keep rewrite
              {shortcuts ? <Shortcut letter="A" /> : null}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-keyshortcuts={shortcuts ? "R" : undefined}
              onClick={onKeepMine}
            >
              Keep mine
              {shortcuts ? <Shortcut letter="R" /> : null}
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="quiet"
          icon={PencilSimpleIcon}
          onClick={() => setEditing(currentText)}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      data-bullet={bullet.id}
      data-state={state}
      className={cx("plane flex flex-col gap-5 p-5 font-ui text-base", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="font-medium tabular-nums text-text">
          Line {position} of {total}
        </h2>
        {shortcuts ? (
          <p className="text-sm text-text-soft">
            <Shortcut letter="J" /> <Shortcut letter="K" />
            <span className="sr-only">J and K</span> to move
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 text-sm font-medium",
              bullet.verdict === "achievement" ? "text-verified" : "text-text-soft",
            )}
          >
            <Verdict size={16} aria-hidden className="shrink-0" />
            {bullet.verdict === "achievement" ? "Achievement" : "Activity"}
          </span>
          {bullet.issues.length > 0 ? (
            <ul aria-label="What to fix" className="flex flex-wrap gap-1.5">
              {bullet.issues.map((issue) => (
                <li
                  key={issue}
                  className="rounded-control border border-edge px-1.5 text-sm text-text-soft"
                >
                  {RESUME_ISSUE_LABELS[issue]}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-text">{bullet.feedback}</p>
      </div>

      {rewrite ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-text-soft">
            {decision?.status === "accepted" ? "The rewrite" : "Suggested rewrite"}
          </p>
          <p className="text-text">
            <WordDiff before={bullet.original} after={previewRewrite(rewrite.text, answers)} />
          </p>
        </div>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-text-soft">
          <CheckCircleIcon size={16} aria-hidden className="shrink-0 text-verified" />
          {BULLET_STATE_WORDS.strong}
        </p>
      )}

      {rewrite && slots.length > 0 && !decision ? (
        <div className="flex flex-col gap-3">
          {slots.map((n) => {
            const need = rewrite.needs[n - 1];
            return (
              <div key={n} className="flex flex-col gap-1">
                <label htmlFor={`${idPrefix}-q${n}`} className="text-sm font-medium text-text">
                  {need?.question ?? `Detail ${n}`}
                </label>
                <p id={`${idPrefix}-q${n}-hint`} className="text-sm text-text-soft">
                  {need ? `About ${need.approx_words} words.` : "A few words."} Only you know this.
                </p>
                <input
                  id={`${idPrefix}-q${n}`}
                  type="text"
                  value={answers[n - 1] ?? ""}
                  onChange={(event) => onAnswer(n, event.target.value)}
                  aria-describedby={`${idPrefix}-q${n}-hint`}
                  className="min-h-11 w-full rounded-control border border-control bg-depth px-3 font-ui text-lg text-text sm:text-base"
                />
              </div>
            );
          })}
          <p id={`${idPrefix}-open`} aria-live="polite" className="min-h-[1lh] text-sm text-needs">
            {open.length > 0
              ? open.length === 1
                ? "Answer the question above to keep this rewrite."
                : `Answer the ${open.length} questions above to keep this rewrite.`
              : ""}
          </p>
        </div>
      ) : null}

      {actions}
    </section>
  );
}
