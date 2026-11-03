import type { ThemeName, ThemePreference } from "@admitstory/ui";

/** The marketing site is paper unless the visitor chose Night (paper redesign 2026-11-03). */
export function marketingTheme(preference: ThemePreference): ThemeName {
  return preference === "night" ? "night" : "day";
}
