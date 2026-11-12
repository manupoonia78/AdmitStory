// Small pieces of hero markup shared by the first-load stage and the lazy experience. No hooks,
// no state: safe in either module.

import { cx } from "@admitstory/ui";

/** The actions box keeps one height whatever it holds (buttons, the sample, the field). */
export const ACTIONS_BOX = "grid min-h-[11rem] content-start sm:min-h-[8.75rem]";

/** A play triangle, 24 px, inline so nothing is fetched. */
export function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.8-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7Z"
      />
    </svg>
  );
}

/**
 * The hero's main control (styled as RecordButton's idle state, spec §6.8): a 72 px --signal
 * circle with its label beside it on larger screens; on phones a full-width 56 px bar with the
 * circle at its left, in the thumb zone.
 */
export const PLAY_CLASSES = {
  button: cx(
    "group flex min-h-14 w-full items-center gap-4 rounded-control px-2 text-left text-lg font-medium",
    "sm:w-auto sm:min-h-[72px] sm:rounded-full sm:px-0 sm:pr-4",
    "bg-signal text-on-signal sm:bg-transparent sm:text-text",
  ),
  circle: cx(
    "relative grid size-10 shrink-0 place-items-center rounded-full sm:size-[72px]",
    "transition-colors duration-(--spring-snap-duration) ease-snap",
    "sm:bg-signal sm:text-on-signal sm:group-hover:bg-signal/90",
  ),
} as const;
