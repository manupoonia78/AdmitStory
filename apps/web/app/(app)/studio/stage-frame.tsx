import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";
import type { InputMode } from "./voice-flow";

// The Studio's centre stage (spec §6.2, §6.7, screen B): the Voiceprint full size in the middle,
// the question under it, then the live transcript and the record button while talking. The voice
// stage loads after first paint (§6.11); until then the same frame holds a still Voiceprint and
// the question in plain text, so nothing moves when the stage takes over.

const VOICEPRINT_SIZE: Record<InputMode, string> = {
  talk: "size-44 sm:size-56 lg:size-64",
  write: "size-28 sm:size-36",
};

/** SpokenQuestion's own type, so the plain question the frame shows first is identical to it. */
export const QUESTION_CLASS =
  "max-w-[30ch] font-reading text-[length:clamp(1.75rem,1rem+2.6vw,3.5rem)] leading-[1.12] font-normal tracking-[-0.012em] text-balance text-text";

export function StageFrame({
  mode,
  voiceprint,
  question,
  transcript,
  notice,
  controls,
}: {
  mode: InputMode;
  voiceprint: ReactNode;
  question: ReactNode;
  transcript?: ReactNode;
  notice?: ReactNode;
  controls?: ReactNode;
}) {
  const talk = mode === "talk";
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div className={cx("shrink-0", VOICEPRINT_SIZE[mode])}>{voiceprint}</div>
      {question}
      {talk ? <div className="h-28 w-full max-w-2xl text-start sm:h-32">{transcript}</div> : null}
      {notice}
      {talk ? (
        <div className="flex min-h-28 w-full max-w-2xl justify-center">{controls}</div>
      ) : null}
    </div>
  );
}

/** The question while the stage loads: the same words in the same type, without timings. */
export function PlainQuestion({ text, waiting }: { text: string | null; waiting: string }) {
  return text ? (
    <h2 className={QUESTION_CLASS}>{text}</h2>
  ) : (
    <p className="font-reading text-reading-lg text-text-soft">{waiting}</p>
  );
}
