import type { ReactNode } from "react";
import type { InputMode } from "./voice-flow";

// The Studio's stage (SPEC §6.4): the chapter and the question, the answer under it, then the
// horizon across the room with the record button on it and the voice controls under that. The
// server paints this frame whole (a flat line, a placeholder button); the voice stage loads after
// first paint (dictation, read aloud, the canvas line) and fills the same boxes, so nothing moves.

/** The question's type, shared by the plain question and the streaming reply. */
export const QUESTION_CLASS = "studio-question text-display-2 text-balance text-text";

export function StageFrame({
  mode,
  chapter,
  question,
  answer,
  notice,
  line,
  button,
  controls,
}: {
  mode: InputMode;
  /** The open chapter's name, above the question. */
  chapter: string;
  question: ReactNode;
  /** The live transcript in Talk, the composer in Write. */
  answer?: ReactNode;
  notice?: ReactNode;
  /** The canvas Voiceline; absent until the voice stage loads (the flat line stands in). */
  line?: ReactNode;
  /** The record button, centred on the horizon (Talk only). */
  button?: ReactNode;
  /** Done, read aloud, hands-free (Talk only). */
  controls?: ReactNode;
}) {
  const talk = mode === "talk";
  return (
    <div className="studio-frame" data-mode={mode}>
      <div className="studio-ask">
        <p className="label text-text-label">{chapter}</p>
        {question}
        <div className="studio-answer">{answer}</div>
        {notice}
      </div>
      <div className="studio-horizon">
        <span aria-hidden className="studio-flat" />
        {line ? <div className="studio-line">{line}</div> : null}
        {talk && button ? <div className="studio-well">{button}</div> : null}
      </div>
      {talk ? <div className="studio-controls">{controls}</div> : null}
    </div>
  );
}

/** The question while the stage loads: the same words in the same type, without timings. */
export function PlainQuestion({ text, waiting }: { text: string | null; waiting: string }) {
  return text ? (
    <h2 className={QUESTION_CLASS}>{text}</h2>
  ) : (
    <p className="text-display-3 text-text-soft">{waiting}</p>
  );
}

/** The record button before the voice stage arrives: the same circle and status, inert. */
export function PlainRecordButton() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-4">
      <span className="grid size-[88px] place-items-center rounded-full border border-edge bg-frost text-text">
        <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
          <path d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48ZM96 64a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V232a8 8 0 0 1-16 0v-24.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0 64 64 0 0 0 128 0 8 8 0 0 1 16 0 80.11 80.11 0 0 1-72 79.6Z" />
        </svg>
      </span>
      <p className="label min-h-[1lh] text-center text-text-label">Tap to talk, or hold Space</p>
    </div>
  );
}
