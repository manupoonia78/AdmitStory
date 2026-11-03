// Small pieces of hero markup shared by the first-load stage and the lazy experience, so the
// record control looks the same before and after the experience loads (no shift, no swap).
// No hooks, no state: safe in either module.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

/** The actions box keeps one height whatever it holds (buttons, explainer, recording). */
export const ACTIONS_BOX = "grid min-h-[11rem] content-start sm:min-h-[8.75rem]";

/** A microphone (idle) or a square (stop), 24 px, inline so nothing is fetched. */
export function RecordGlyph({ recording }: { recording: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      {recording ? (
        <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
      ) : (
        <path
          fill="currentColor"
          d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Zm6-3.75a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0 .75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.95V19.5H9a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-2.25v-2.3A6 6 0 0 0 18 11.25Z"
        />
      )}
    </svg>
  );
}

/**
 * The record control (styled as RecordButton's idle state, spec §6.8): a 72 px --signal circle
 * with its label beside it on larger screens; on phones a full-width 56 px bar with the circle at
 * its left, in the thumb zone. `ring` draws inside the circle's box (the countdown).
 */
export function recordClasses(recording: boolean): { button: string; circle: string } {
  return {
    button: cx(
      "group flex min-h-14 w-full items-center gap-4 rounded-control px-2 text-left text-lg font-medium",
      "sm:w-auto sm:min-h-[72px] sm:rounded-full sm:px-0 sm:pr-4",
      recording
        ? "bg-record text-on-signal sm:bg-transparent sm:text-text"
        : "bg-signal text-on-signal sm:bg-transparent sm:text-text",
      "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
    ),
    circle: cx(
      "relative grid size-10 shrink-0 place-items-center rounded-full sm:size-[72px]",
      "transition-colors duration-(--spring-snap-duration) ease-snap",
      recording
        ? "sm:bg-record sm:text-on-signal"
        : "sm:bg-signal sm:text-on-signal sm:group-hover:bg-signal/90",
    ),
  };
}

export function Notice({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="status" className="mt-4 max-w-[34rem] text-sm text-text">
      {children}
    </p>
  );
}
