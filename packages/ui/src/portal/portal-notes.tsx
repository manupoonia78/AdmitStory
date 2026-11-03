"use client";

// "Your notes" in the recommender portal (Phase 6 plan §8.4): say or type what you remember, read
// it back, edit it, delete it. The recommender's words are the only material the page ever uses,
// and the applicant never sees them (§14.3).
//
// Dictation is passed in as a slot so the voice client is code-split by the route: nothing of it
// loads until the record button is pressed. No audio is kept anywhere (decision 5): a dictated
// note arrives as text plus its seconds.

import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import type { PortalNote } from "@admitstory/shared/kit";
import { useState, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { PORTAL_COPY, noteMeta } from "./portal-text";

/** One dictated note, as the voice client hands it over. No audio, ever. */
export interface DictatedNote {
  text: string;
  seconds: number;
  language: string | null;
}

export interface PortalNotesProps {
  notes: readonly PortalNote[];
  /** Characters one note may hold (PORTAL_LIMITS.noteChars). */
  maxChars: number;
  /** False once the invite's note limit is reached, or while the link is read-only. */
  canAdd: boolean;
  /** Minutes of dictation left on this invite; 0 hides the record button. */
  voiceSecondsLeft: number;
  busy?: boolean;
  onAdd: (text: string, spoken: { seconds: number; language: string } | null) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  /** The record button, loaded on first press by the route. */
  record?: (onDictated: (answer: DictatedNote) => void) => ReactNode;
  className?: string;
}

function NoteRow({
  note,
  busy,
  maxChars,
  onUpdate,
  onDelete,
}: {
  note: PortalNote;
  busy: boolean;
  maxChars: number;
  onUpdate: PortalNotesProps["onUpdate"];
  onDelete: PortalNotesProps["onDelete"];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);

  if (editing)
    return (
      <li className="flex flex-col gap-2 border-t border-edge pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-soft">Edit this note</span>
          <textarea
            value={text}
            maxLength={maxChars}
            rows={5}
            autoFocus
            onChange={(event) => setText(event.target.value)}
            className="w-full resize-y rounded-plane border border-control bg-space p-3 text-base text-text"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              onUpdate(note.id, text.trim());
              setEditing(false);
            }}
            disabled={busy || text.trim().length === 0}
          >
            Save this note
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setText(note.text);
              setEditing(false);
            }}
          >
            Keep it as it was
          </Button>
        </div>
      </li>
    );

  return (
    <li className="flex flex-col gap-2 border-t border-edge pt-4">
      <p className="whitespace-pre-line text-base text-text">{note.text}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm tabular-nums text-text-soft">{noteMeta(note)}</p>
        <Button
          size="sm"
          variant="quiet"
          icon={PencilSimpleIcon}
          onClick={() => setEditing(true)}
          disabled={busy}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="quiet"
          icon={TrashIcon}
          onClick={() => onDelete(note.id)}
          disabled={busy}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function PortalNotes({
  notes,
  maxChars,
  canAdd,
  voiceSecondsLeft,
  busy = false,
  onAdd,
  onUpdate,
  onDelete,
  record,
  className,
}: PortalNotesProps) {
  const [draft, setDraft] = useState("");
  const [spoken, setSpoken] = useState<{ seconds: number; language: string } | null>(null);

  function dictated(answer: DictatedNote) {
    const text = answer.text.trim();
    if (!text) return;
    setDraft((current) => (current ? `${current.replace(/\s+$/, "")} ${text}` : text));
    setSpoken((current) => ({
      seconds: (current?.seconds ?? 0) + Math.max(0, Math.round(answer.seconds)),
      language: answer.language ?? current?.language ?? "en",
    }));
  }

  const ready = draft.trim().length > 0;

  return (
    <section id="your-notes" className={cx("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-display-sm text-text">{PORTAL_COPY.notesHeading}</h2>
        <p className="text-base text-text-soft">{PORTAL_COPY.notesLead}</p>
      </div>

      {canAdd ? (
        <div className="flex flex-col gap-3 plane p-4">
          {record && voiceSecondsLeft > 0 ? record(dictated) : null}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-soft">{PORTAL_COPY.typeNote}</span>
            <textarea
              value={draft}
              maxLength={maxChars}
              rows={4}
              placeholder="One moment you saw for yourself: what happened, what they did, how it turned out."
              onChange={(event) => setDraft(event.target.value)}
              className="w-full resize-y rounded-plane border border-control bg-space p-3 text-base text-text"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={() => {
                onAdd(draft.trim(), spoken);
                setDraft("");
                setSpoken(null);
              }}
              disabled={busy || !ready}
              loading={busy}
            >
              {PORTAL_COPY.saveNote}
            </Button>
            <p className="text-sm tabular-nums text-text-soft">
              {draft.length} / {maxChars}
            </p>
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="text-base text-text-soft">{PORTAL_COPY.notesEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              busy={busy}
              maxChars={maxChars}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
