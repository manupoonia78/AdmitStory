"use client";

import { cx } from "../lib/cx";
import { usePlainKey } from "./shortcuts";

export interface YourWordsToggleProps {
  on: boolean;
  /** `via` says how: a pointer toggle may play the sweep, a key never does (SPEC §2.10). */
  onChange: (on: boolean, via: "pointer" | "key") => void;
  /** Also toggle with Y when focus is not in a text field (spec §6.12). Default true. */
  shortcut?: boolean;
  className?: string;
}

/**
 * The your-words switch (spec §5.8). Its own on state is --text like any control: --voice
 * belongs to the applicant's words, never to chrome. Y toggles it from anywhere outside a field.
 */
export function YourWordsToggle({
  on,
  onChange,
  shortcut = true,
  className,
}: YourWordsToggleProps) {
  usePlainKey("y", () => onChange(!on, "key"), shortcut);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-keyshortcuts={shortcut ? "Y" : undefined}
      // Enter or Space on the focused switch fires a click with detail 0: a keyboard action.
      onClick={(event) => onChange(!on, event.detail === 0 ? "key" : "pointer")}
      className={cx(
        "group inline-flex min-h-10 items-center gap-2.5 rounded-full px-3 text-ui text-text transition-colors duration-(--dur-hover) hover:bg-frost-hover [&[role=switch]]:shadow-none",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "relative h-5 w-8 shrink-0 rounded-full border transition-colors duration-150 ease-rise motion-reduce:transition-none",
          on ? "border-text bg-text" : "border-control bg-transparent",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-[translate,background-color] duration-150 ease-rise motion-reduce:transition-none",
            on ? "translate-x-3 bg-space" : "translate-x-0 bg-control",
          )}
        />
      </span>
      Your words
      {/* CSS-generated, so it stays out of the accessible name (WCAG 2.5.3); aria-keyshortcuts
          announces it instead. */}
      {shortcut ? (
        <kbd
          aria-hidden
          data-shortcut="Y"
          className="grid h-5 min-w-5 place-items-center rounded-[6px] border border-edge px-1 font-mono text-[11px] text-text-soft before:content-[attr(data-shortcut)]"
        />
      ) : null}
    </button>
  );
}

export interface YourWordsLegendProps {
  className?: string;
}

/** The small legend beside the switch: what lit and plain mean, and how to see a source. */
export function YourWordsLegend({ className }: YourWordsLegendProps) {
  return (
    <div className={cx("flex flex-col gap-1.5 text-sm text-text-soft", className)}>
      <p>
        Lit sentences are your own words:{" "}
        <span className="box-decoration-clone bg-voice-glow px-0.5 text-text underline decoration-voice decoration-[1.25px] underline-offset-[0.22em]">
          said word for word
        </span>{" "}
        or{" "}
        <span className="box-decoration-clone bg-[color-mix(in_srgb,var(--voice-glow)_60%,transparent)] px-0.5 text-text underline decoration-voice decoration-dotted decoration-[1.25px] underline-offset-[0.22em]">
          lightly adapted
        </span>
        . Plain sentences were written for you from your facts.
      </p>
      <p>Point at, tap or tab to a lit sentence to see the moment you said it.</p>
    </div>
  );
}
