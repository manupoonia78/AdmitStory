"use client";

import { cx } from "../lib/cx";
import { usePlainKey } from "./shortcuts";

export interface YourWordsToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  /** Also toggle with Y when focus is not in a text field (spec §6.12). Default true. */
  shortcut?: boolean;
  className?: string;
}

/**
 * The your-words switch (spec §5.8). Its own on state uses --signal like any control: --voice
 * belongs to the applicant's words, never to chrome. Y toggles it from anywhere outside a field.
 */
export function YourWordsToggle({
  on,
  onChange,
  shortcut = true,
  className,
}: YourWordsToggleProps) {
  usePlainKey("y", () => onChange(!on), shortcut);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-keyshortcuts={shortcut ? "Y" : undefined}
      onClick={() => onChange(!on)}
      className={cx(
        "group inline-flex min-h-11 items-center gap-3 rounded-control px-2 font-medium text-text hover:bg-veil",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
          on ? "border-signal bg-signal" : "border-control bg-depth",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full transition-[translate,background-color] duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
            on ? "translate-x-4 bg-on-signal" : "translate-x-0 bg-control",
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
          className="rounded-control border border-edge px-1.5 font-ui text-sm text-text-soft before:content-[attr(data-shortcut)]"
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
    <div className={cx("flex flex-col gap-1 text-sm text-text-soft", className)}>
      <p>
        <span className="bg-voice-glow px-1 text-text shadow-[0_0_0.6em_var(--voice-glow)] box-decoration-clone forced-colors:underline forced-colors:decoration-dotted">
          Lit sentences
        </span>{" "}
        are your own words, as you said them or lightly adapted. Plain sentences were written for
        you from your facts.
      </p>
      <p>Point at, tap or tab to a lit sentence to see the moment you said it.</p>
    </div>
  );
}
