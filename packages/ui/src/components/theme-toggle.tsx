"use client";

import { MonitorIcon, MoonIcon, SunIcon, type Icon } from "@phosphor-icons/react";
import { RadioGroup } from "radix-ui";
import { cx } from "../lib/cx";
import {
  THEME_LABELS,
  THEME_PREFERENCES,
  parseThemePreference,
  type ThemePreference,
} from "../theme-preference";
import { setThemePreference, useThemePreference } from "./theme-store";

export { setThemePreference, useThemePreference };

const ICONS: Record<ThemePreference, Icon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export interface ThemeToggleProps {
  serverValue?: ThemePreference;
  className?: string;
}

/** Three-way choice (spec §6.9: follows the system by default, with a manual override). */
export function ThemeToggle({ serverValue, className }: ThemeToggleProps) {
  const preference = useThemePreference(serverValue);
  return (
    <RadioGroup.Root
      aria-label="Theme"
      value={preference}
      onValueChange={(value) => setThemePreference(parseThemePreference(value))}
      orientation="horizontal"
      className={cx(
        "inline-flex gap-1 rounded-control border border-slate bg-paper p-1",
        className,
      )}
    >
      {THEME_PREFERENCES.map((option) => {
        const OptionIcon = ICONS[option];
        return (
          <RadioGroup.Item
            key={option}
            value={option}
            className={cx(
              "inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-slate hover:text-graphite",
              "data-[state=checked]:bg-ink-soft data-[state=checked]:font-bold data-[state=checked]:text-ink",
            )}
          >
            <OptionIcon size={20} aria-hidden />
            {THEME_LABELS[option]}
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
