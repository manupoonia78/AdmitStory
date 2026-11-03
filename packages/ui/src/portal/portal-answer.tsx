"use client";

// One question's answer in the recommender portal (Phase 6 plan §8.5). Two modes, and neither
// writes a letter:
//
//  - assist: the recommender's own notes are organised into an answer. Every sentence says which
//    note it came from, so nothing on the page is unaccounted for (LOR-10, decision 2).
//  - coach: a structure, the notes that belong under each beat, and questions to answer. No
//    sentences at all, for schools that ask recommenders not to use AI (decision 20).
//
// The answer is always an editable box with the school's own count beside it. "Copy for the
// school's form" copies exactly what the count measured.

import { ClipboardTextIcon, QuestionIcon } from "@phosphor-icons/react";
import type { PortalLetter, PortalMode, PortalNote } from "@admitstory/shared/kit";
import { useId, useState } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { LimitCounter } from "../workspace/limit-counter";
import {
  PORTAL_COPY,
  answerCount,
  assistActionLabel,
  limitLine,
  limitUnit,
  noteIdFromAssist,
  sentenceSourceLine,
  type PortalLimit,
} from "./portal-text";

export interface PortalQuestion {
  id: string;
  /** The school's wording, verbatim. */
  text: string;
  limit: PortalLimit | null;
}

export interface PortalAnswerProps {
  question: PortalQuestion;
  letter: PortalLetter | null;
  /** The mode in force for this group, after the school's policy and the recommender's choice. */
  mode: PortalMode;
  notes: readonly PortalNote[];
  assistsLeft: number;
  busy: boolean;
  /** Why this question is planned rather than organised, when it is. */
  policyNote: string | null;
  onAssist: () => void;
  onChange: (text: string) => void;
  onCopy: (text: string) => void;
  maxChars: number;
}

function MissingTag({ text }: { text: string }) {
  return (
    <li className="inline-flex max-w-full items-start gap-1 rounded-control border border-dashed border-needs px-2 py-1 text-sm text-needs">
      <QuestionIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </li>
  );
}

/** The assisted answer, sentence by sentence, each saying which note it came from. */
function AssistedAnswer({
  assisted,
  notes,
}: {
  assisted: NonNullable<PortalLetter["assisted"]>;
  notes: readonly PortalNote[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const sourceId = useId();
  const byId = new Map(notes.map((note) => [note.id, note]));
  if (!assisted.answer) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-soft">
        Your words, organised. Focus a sentence to see the note it came from.
      </p>
      <div className="flex flex-col gap-[1lh] font-reading text-read text-text">
        {assisted.answer.paragraphs.map((paragraph, pi) => (
          <p key={pi}>
            {paragraph.sentences.map((sentence, si) => {
              const key = `${pi}-${si}`;
              return (
                <span
                  key={key}
                  tabIndex={0}
                  aria-describedby={active === key ? sourceId : undefined}
                  onFocus={() => setActive(key)}
                  onBlur={() => setActive((current) => (current === key ? null : current))}
                  onMouseEnter={() => setActive(key)}
                  onMouseLeave={() => setActive((current) => (current === key ? null : current))}
                  className={cx(
                    "rounded-control px-0.5",
                    active === key ? "bg-veil" : undefined,
                    sentence.kind === "verbatim" ? "underline decoration-edge" : undefined,
                  )}
                >
                  {sentence.text}{" "}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      <div id={sourceId} aria-live="polite" className="min-h-[3lh] text-sm text-text-soft">
        {assisted.answer.paragraphs.flatMap((paragraph, pi) =>
          paragraph.sentences.map((sentence, si) => {
            if (active !== `${pi}-${si}`) return null;
            const cited = sentence.notes
              .map((id) => byId.get(noteIdFromAssist(id)))
              .filter((note): note is PortalNote => Boolean(note));
            return (
              <span key={`${pi}-${si}`} className="flex flex-col gap-1">
                <span className="font-medium text-text">{sentenceSourceLine(cited)}</span>
                {cited.map((note) => (
                  <span key={note.id} className="line-clamp-3">
                    {note.text}
                  </span>
                ))}
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Outline({
  assisted,
  notes,
}: {
  assisted: NonNullable<PortalLetter["assisted"]>;
  notes: readonly PortalNote[];
}) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  if (assisted.outline.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-base font-semibold text-text">{PORTAL_COPY.outlineHeading}</h4>
      <ol className="flex flex-col gap-4">
        {assisted.outline.map((beat, index) => (
          <li key={`${index}-${beat.beat}`} className="flex flex-col gap-1.5">
            <p className="text-base text-text">{beat.beat}</p>
            {beat.your_notes.length > 0 ? (
              <div className="flex flex-col gap-1 border-l border-edge pl-3">
                <p className="text-sm text-text-soft">{PORTAL_COPY.outlineNotes}</p>
                <ul className="flex flex-col gap-1 text-sm text-text">
                  {beat.your_notes.map((id) => {
                    const note = byId.get(noteIdFromAssist(id));
                    return note ? (
                      <li key={id} className="line-clamp-2">
                        {note.text}
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            ) : null}
            {beat.questions.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-text-soft">{PORTAL_COPY.outlineQuestions}</p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-soft">
                  {beat.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PortalAnswer({
  question,
  letter,
  mode,
  notes,
  assistsLeft,
  busy,
  policyNote,
  onAssist,
  onChange,
  onCopy,
  maxChars,
}: PortalAnswerProps) {
  const stamp = letter?.updatedAt ?? "";
  const [seed, setSeed] = useState(stamp);
  const [text, setText] = useState(letter?.text ?? "");
  // The box follows a saved change that came from somewhere else (an assist, another tab).
  if (seed !== stamp) {
    setSeed(stamp);
    setText(letter?.text ?? "");
  }

  const assisted = letter?.assisted ?? null;
  const count = answerCount(text, question.limit);
  const limitText = limitLine(question.limit);
  const noNotes = notes.length === 0;
  const outOfAssists = assistsLeft <= 0;

  return (
    <section className="flex flex-col gap-4 border-t border-edge pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-reading text-read text-text">{question.text}</h3>
        {limitText ? <p className="text-sm tabular-nums text-text-soft">{limitText}</p> : null}
      </div>

      {policyNote ? <p className="text-sm text-text-soft">{policyNote}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={onAssist}
          disabled={busy || noNotes || outOfAssists}
          loading={busy}
        >
          {assistActionLabel(mode)}
        </Button>
        {noNotes ? <p className="text-sm text-text-soft">{PORTAL_COPY.noNotesYet}</p> : null}
        {!noNotes && outOfAssists ? (
          <p className="text-sm text-text-soft">
            You&rsquo;ve used this page&rsquo;s help for now. Your notes and answers are saved.
          </p>
        ) : null}
      </div>

      {assisted && mode === "assist" && assisted.answer ? (
        <AssistedAnswer assisted={assisted} notes={notes} />
      ) : null}
      {assisted ? <Outline assisted={assisted} notes={notes} /> : null}
      {assisted && assisted.missing.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-base font-semibold text-text">{PORTAL_COPY.missingHeading}</h4>
          <ul className="flex flex-wrap gap-2">
            {assisted.missing.map((item) => (
              <MissingTag key={item} text={item} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-soft">
            {mode === "coach" ? "Write your answer" : PORTAL_COPY.answerLabel}
          </span>
          <textarea
            value={text}
            rows={10}
            maxLength={maxChars}
            onChange={(event) => {
              setText(event.target.value);
              onChange(event.target.value);
            }}
            className="w-full resize-y rounded-plane border border-control bg-space p-4 font-reading text-read text-text"
          />
        </label>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button
            size="sm"
            variant="quiet"
            icon={ClipboardTextIcon}
            onClick={() => onCopy(text)}
            disabled={text.trim().length === 0}
          >
            {PORTAL_COPY.copyAnswer}
          </Button>
          {question.limit ? (
            <LimitCounter
              count={count}
              limit={question.limit.value}
              unit={limitUnit(question.limit)}
            />
          ) : (
            <p className="text-sm tabular-nums text-text-soft">{count} words</p>
          )}
        </div>
      </div>
    </section>
  );
}
