import "server-only";

import {
  addPortalVoiceSeconds,
  getDb,
  writePortalNotes,
  writePortalVoice,
  type PortalAccess,
} from "@admitstory/db";
import { recommenderVoice } from "@admitstory/linters";
import { PORTAL_LIMITS, type PortalNote } from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";

// The recommender's notes (Phase 6 plan §6 `POST /api/r/:token/notes`). They are the only material
// the portal assistant ever works from, they are encrypted at rest, and the applicant can never
// read them (§14.3, decision 2).
//
// No audio is kept, here or anywhere (decision 5). A dictated note arrives as text with the
// seconds it took, which are metered against the invite's hour of dictation; the audio itself only
// ever existed between the microphone and the transcriber.

export type NoteOp =
  | { op: "add"; text: string; spoken?: { seconds: number; language: string } | null }
  | { op: "update"; id: string; text: string }
  | { op: "delete"; id: string };

const NOTE_ID = /^n(\d{1,4})$/;

/** The next free note id: "n1", "n2"… never reusing a deleted one within a session. */
export function nextNoteId(notes: readonly PortalNote[]): string {
  const used = notes
    .map((note) => Number(NOTE_ID.exec(note.id)?.[1] ?? 0))
    .filter((value) => Number.isFinite(value));
  return `n${Math.max(0, ...used) + 1}`;
}

function clean(text: string): string {
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length === 0) throw new ApiError(422, "Write a line or two first, then save it.");
  if (trimmed.length > PORTAL_LIMITS.noteChars)
    throw new ApiError(
      422,
      `That note is longer than this page keeps (${PORTAL_LIMITS.noteChars} characters). Split it into two.`,
    );
  return trimmed;
}

/**
 * Applies one note change and saves the whole list, encrypted. The returned list is what the page
 * then shows; `progress_at` moves, which is how the applicant learns that writing has started.
 */
export async function applyNoteOp(
  access: PortalAccess,
  notes: readonly PortalNote[],
  change: NoteOp,
  now: Date = new Date(),
): Promise<PortalNote[]> {
  let next: PortalNote[];
  if (change.op === "add") {
    if (notes.length >= PORTAL_LIMITS.notesMax)
      throw new ApiError(
        422,
        "This page is holding as many notes as it can. Tidy a few together, then add more.",
      );
    const spoken = change.spoken
      ? {
          seconds: Math.max(
            0,
            Math.min(PORTAL_LIMITS.voiceSeconds, Math.round(change.spoken.seconds)),
          ),
          language: change.spoken.language,
        }
      : null;
    next = [
      ...notes,
      { id: nextNoteId(notes), text: clean(change.text), at: now.toISOString(), spoken },
    ];
  } else if (change.op === "update") {
    if (!notes.some((note) => note.id === change.id))
      throw new ApiError(404, "That note isn't on this page any more.");
    const text = clean(change.text);
    next = notes.map((note) => (note.id === change.id ? { ...note, text } : note));
  } else {
    next = notes.filter((note) => note.id !== change.id);
    if (next.length === notes.length)
      throw new ApiError(404, "That note isn't on this page any more.");
  }

  const db = getDb();
  await writePortalNotes(db, access, next, now);
  // How they write, measured from their own words: the assistant is told the shape, never content.
  await writePortalVoice(db, access, recommenderVoice(next.map((note) => note.text)));
  return next;
}

/**
 * Meters a dictated note's seconds against the invite's hour (decision 21). The cap is enforced in
 * one statement, so two tabs can't spend the same minute twice.
 */
export async function meterPortalVoice(
  access: PortalAccess,
  seconds: number,
): Promise<{ voiceSecondsLeft: number }> {
  const { total } = await addPortalVoiceSeconds(
    getDb(),
    access,
    seconds,
    PORTAL_LIMITS.voiceSeconds,
  );
  return { voiceSecondsLeft: Math.max(0, PORTAL_LIMITS.voiceSeconds - total) };
}
