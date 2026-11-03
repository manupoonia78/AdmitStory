// The recommender portal's words and counts (Phase 6 plan §8, spec §5.11, §6.7, §6.9). Pure and
// server-safe: no React, no Motion, no fetch. The server page and the work screen share it, so the
// count beside an answer is the number "Copy for the school's form" puts on the clipboard.
//
// Two rules shape the copy: the page belongs to the recommender (the applicant sees status only),
// and the product never writes a letter for them. Nothing here offers to draft, sample or
// template anything.

import { countAfterNormalize, type LimitKind } from "@admitstory/linters";
import type { PortalClosedView, PortalMode, PortalNote } from "@admitstory/shared/kit";
import { formatDate } from "../strategy/time-scale";

/** A question's limit as the portal view carries it. */
export interface PortalLimit {
  kind: LimitKind;
  value: number;
}

/* Dates --------------------------------------------------------------------------------------- */

/** "12 Sep 2026" from an ISO date or time; "" when there is none. The house month rule applies. */
export function portalDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (!Number.isFinite(time)) return "";
  return formatDate(time, "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Halvorsen, by 3 Jan 2027" — or just the school when its deadline isn't known. */
export function schoolDeadlineLine(name: string, deadline: string | null): string {
  const day = portalDay(deadline);
  return day ? `${name}, by ${day}` : name;
}

/* Header and privacy -------------------------------------------------------------------------- */

/** The page's title: "Recommendation for Asha Varma". */
export const portalTitle = (applicantName: string): string => `Recommendation for ${applicantName}`;

/**
 * §14.3 verbatim, in the second person: the recommender is told exactly what the applicant can
 * see. Shown in the header, not hidden in a footer.
 */
export const privacyLine = (applicantFirstName: string): string =>
  `This page is private to you. ${applicantFirstName} sees only whether you've opened it, started, and marked it submitted.`;

export const expiryLine = (expiresAt: string): string => {
  const day = portalDay(expiresAt);
  return day ? `This link works until ${day}.` : "This link works for a limited time.";
};

/* Notes --------------------------------------------------------------------------------------- */

/** "Spoken, 2 min" or "Typed": how the note was made, never the audio (no recording is kept). */
export function noteSourceLabel(note: Pick<PortalNote, "spoken">): string {
  if (!note.spoken) return "Typed";
  const minutes = Math.round(note.spoken.seconds / 60);
  return minutes >= 1 ? `Spoken, ${minutes} min` : `Spoken, under a minute`;
}

/** "Spoken, 2 min · 14 Oct 2026". */
export function noteMeta(note: Pick<PortalNote, "spoken" | "at">): string {
  const day = portalDay(note.at);
  return day ? `${noteSourceLabel(note)} · ${day}` : noteSourceLabel(note);
}

/** "From your note, 14 Oct 2026": where one sentence of an assisted answer came from. */
export function sentenceSourceLine(notes: readonly PortalNote[]): string {
  if (notes.length === 0) return "From your notes";
  const days = notes.map((note) => portalDay(note.at)).filter(Boolean);
  if (days.length === 0) return notes.length === 1 ? "From your note" : "From your notes";
  return days.length === 1
    ? `From your note, ${days[0]}`
    : `From your notes, ${days.join(" and ")}`;
}

/** The note ids a sentence cites, as the assistant writes them (N1), back to portal ids (n1). */
export const noteIdFromAssist = (id: string): string => id.replace(/^N/, "n");

/** A portal note id (n1) as the assistant's input wants it (N1). */
export const assistNoteId = (id: string): string => id.replace(/^n/, "N");

/* Answers ------------------------------------------------------------------------------------- */

/** The count of an answer by the school's own rule, on the text that gets pasted. */
export function answerCount(text: string, limit: PortalLimit | null): number {
  return countAfterNormalize(text, limit?.kind ?? "words");
}

/** "words" or "characters", for the live counter beside the box. */
export const limitUnit = (limit: PortalLimit): "words" | "characters" =>
  limit.kind === "words" ? "words" : "characters";

/** "About 500 words", "300 characters", "300 characters, not counting spaces". Null without one. */
export function limitLine(limit: PortalLimit | null): string | null {
  if (!limit) return null;
  if (limit.kind === "words") return `About ${limit.value} words`;
  const suffix = limit.kind === "chars_excl_spaces" ? ", not counting spaces" : "";
  return `${limit.value} characters${suffix}`;
}

/** The action that organises the recommender's notes, by mode. Never "write" or "draft". */
export const assistActionLabel = (mode: PortalMode): string =>
  mode === "coach" ? "Show me a structure" : "Organise my notes into an answer";

/** Why a school's answer is planned rather than organised (decision 20). */
export const coachPolicyNote = (schools: readonly string[]): string => {
  const names =
    schools.length <= 1
      ? (schools[0] ?? "This school")
      : `${schools.slice(0, -1).join(", ")} and ${schools.at(-1)}`;
  const verb = schools.length > 1 ? "ask" : "asks";
  return `${names} ${verb} that recommenders write without AI help, so this page only helps you plan. The words are yours.`;
};

export const OWN_CHOICE_NOTE =
  "You chose to plan rather than organise. The page gives you a structure; the words are yours.";

export const PORTAL_COPY = {
  notesHeading: "Your notes",
  notesLead:
    "Say or type what you remember. Nothing here is written for you, and nothing you write is shown to the applicant.",
  notesEmpty:
    "No notes yet. Talk about one moment you saw for yourself, or type a few lines. You can add more later.",
  typeNote: "Type a note",
  saveNote: "Save this note",
  recordNote: "Say a note",
  transcriptLabel: "Your note",
  letterHeading: "Your letter",
  letterLead:
    "One answer per question. The page only ever uses your own notes, in your words; nothing is added.",
  answerLabel: "Your answer",
  copyAnswer: "Copy for the school's form",
  copiedAnswer: "Answer copied",
  noNotesYet: "Add a note first, then this page can organise what you wrote.",
  missingHeading: "Still missing",
  outlineHeading: "A structure for your answer",
  outlineNotes: "Your notes for this part",
  outlineQuestions: "Worth answering",
  preferCoach: "I'd rather write it myself",
  preferCoachHint: "Keeps every answer as a structure, with no sentences organised for you.",
  submittedHeading: "When you've submitted",
  deleteEverything: "Delete everything I wrote",
  deleteTitle: "Delete your notes and letter",
  deleteBody:
    "Your notes, your answers and anything you marked submitted are deleted from this page. This can't be undone.",
  deleteConfirm: "Delete everything",
  briefHeading: "What the schools ask",
  briefPending:
    "The brief for these schools isn't ready yet. The questions are below, and your notes are saved whatever happens.",
  saveFailed: "That didn't save. Your words are still on this page; try again.",
  savedNote: "Note saved",
  deletedNote: "Note deleted",
  anchorsLabel: "On this page",
} as const;

/** The mark-as-submitted line for one school, in the recommender's words. */
export const submittedLabel = (school: string): string =>
  `I've submitted my recommendation to ${school}`;

/* Closed links --------------------------------------------------------------------------------- */

export interface ClosedCopy {
  title: string;
  body: string;
  /** Offer "Send me a fresh link": only where a fresh one can exist. */
  resend: boolean;
}

/**
 * What a link that no longer opens says (Phase 6 plan §8). The applicant's first name is used when
 * it is known; a closed link usually can't be traced to a person, so the wording works without it.
 */
export function closedCopy(view: PortalClosedView): ClosedCopy {
  const who = view.applicantFirstName;
  switch (view.reason) {
    case "expired":
      return {
        title: "This link has expired",
        body: who
          ? `${who} can send you a new one. You can also ask for a fresh link here.`
          : "Ask for a fresh link below and it will work again.",
        resend: true,
      };
    case "replaced":
      return {
        title: "This link was replaced by a newer one",
        body: "Use the latest email, or get a fresh link below.",
        resend: true,
      };
    default:
      return {
        title: "This link no longer works",
        body: who
          ? `${who} can send you a new invitation.`
          : "If you were asked for a recommendation, ask the applicant to send you a new invitation.",
        resend: false,
      };
  }
}

/** The one answer `/r` and the resend form ever give, so no address is ever confirmed. */
export const RESEND_ANSWER = "If that address has an invitation, a fresh link is on its way.";

export const RESEND_COPY = {
  heading: "Send me a fresh link",
  lead: "Type the address the invitation was sent to. We'll email a new link to that address only.",
  emailLabel: "Your email address",
  submit: "Send me a fresh link",
  sending: "Sending",
} as const;
