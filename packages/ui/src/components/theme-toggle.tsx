"use client";

// A three-option segmented control. Radix's RadioGroup brings roving focus, direction and
// presence with it (~10 KB gz) for what is a fixed list of three buttons, and it landed in the
// first load of every route that renders the toggle on the server (spec §6.11 budget), so the
// WAI-ARIA radio-group pattern is written out here instead: roving tabindex, arrow keys that move
// and select, Home/End, and `data-state` for the styles.

import { MonitorIcon, MoonIcon, SunIcon, type Icon } from "@phosphor-icons/react";
import { useRef, type KeyboardEvent } from "react";
import { cx } from "../lib/cx";
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "../theme-preference";
import { setThemePreference, useThemePreference } from "./theme-store";

export { setThemePreference, useThemePreference };

const ICONS: Record<ThemePreference, Icon> = {
  system: MonitorIcon,
  night: MoonIcon,
  day: SunIcon,
};

/** Arrow keys wrap around the group; both axes work, as the radio-group pattern asks. */
const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export interface ThemeToggleProps {
  serverValue?: ThemePreference;
  /** Icons only below 640px, for slim headers; the labels stay as each option's name. */
  compact?: boolean;
  className?: string;
}

/** Three-way choice (spec §6.12: follows the system by default, with a manual override). */
export function ThemeToggle({ serverValue, compact = false, className }: ThemeToggleProps) {
  const preference = useThemePreference(serverValue);
  const group = useRef<HTMLDivElement>(null);

  // Moving focus inside a radio group also chooses, so the theme follows the arrow key.
  function moveTo(index: number) {
    const option = THEME_PREFERENCES[(index + THEME_PREFERENCES.length) % THEME_PREFERENCES.length];
    if (!option) return;
    group.current?.querySelector<HTMLButtonElement>(`[data-option="${option}"]`)?.focus();
    setThemePreference(option);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = STEP[event.key];
    if (step !== undefined) moveTo(index + step);
    else if (event.key === "Home") moveTo(0);
    else if (event.key === "End") moveTo(THEME_PREFERENCES.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Theme"
      aria-orientation="horizontal"
      className={cx(
        "inline-flex gap-1 rounded-control border border-control bg-depth p-1",
        className,
      )}
    >
      {THEME_PREFERENCES.map((option, index) => {
        const OptionIcon = ICONS[option];
        const checked = option === preference;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            data-option={option}
            data-state={checked ? "checked" : "unchecked"}
            // Roving tabindex: one stop for the whole group, at the chosen option.
            tabIndex={checked ? 0 : -1}
            onClick={() => setThemePreference(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium text-text-soft hover:text-text",
              "transition-colors duration-(--spring-snap-duration) ease-snap",
              "data-[state=checked]:bg-veil data-[state=checked]:font-semibold data-[state=checked]:text-signal",
            )}
          >
            <OptionIcon size={20} aria-hidden />
            <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
              {THEME_LABELS[option]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
