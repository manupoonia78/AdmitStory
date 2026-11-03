"use client";

// The Night / Day switch in the footer (direction §9): a 40 px segmented control built on native
// radio buttons (so arrow keys, focus and the group's name come from the platform), with a 2 px
// --signal indicator that slides on snap. It writes the theme cookie through setThemePreference
// and also re-themes the marketing wrapper, which follows marketingTheme() (Day unless Night).

import {
  setThemePreference,
  useThemePreference,
  type ThemeName,
  type ThemePreference,
} from "@admitstory/ui";
import { useId } from "react";
import { THEME_SWITCH } from "../_copy/chrome";
import { marketingTheme } from "./marketing-theme";

const OPTIONS: readonly { value: ThemeName; label: string }[] = [
  { value: "night", label: THEME_SWITCH.night },
  { value: "day", label: THEME_SWITCH.day },
];

export function ThemeSwitch({ initial }: { initial: ThemePreference }) {
  const preference = useThemePreference(initial);
  const current = marketingTheme(preference);
  const name = useId();
  const noteId = `${name}-note`;

  const choose = (theme: ThemeName) => {
    setThemePreference(theme);
    for (const scope of document.querySelectorAll("[data-marketing-theme]")) {
      scope.setAttribute("data-theme", theme);
    }
  };

  return (
    <fieldset aria-describedby={noteId}>
      <legend className="mb-3 text-sm text-text-soft">{THEME_SWITCH.label}</legend>
      <div className="theme-switch relative inline-grid h-10 grid-cols-2 rounded-control border border-control">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="relative flex min-w-20 cursor-pointer items-center justify-center px-4 text-base text-text-soft has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal"
            // The control is 40 px; the label's own box reaches 44 px (spec §6.12).
            style={{ minHeight: 44, marginBlock: -2 }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
        <span aria-hidden="true" className="theme-switch-indicator" data-on={current} />
      </div>
      <p id={noteId} className="mt-3 text-sm text-text-soft">
        {THEME_SWITCH.note}
      </p>
    </fieldset>
  );
}
