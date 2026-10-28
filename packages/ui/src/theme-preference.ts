// Server-safe helpers shared by ThemeToggle and apps/web's root layout, which reads the
// cookie to render data-theme on first paint (no flash, no reload).

export const THEME_COOKIE = "theme";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return THEME_PREFERENCES.find((p) => p === value) ?? "system";
}

/** Value for <html data-theme>; undefined means "follow prefers-color-scheme". */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | undefined {
  return preference === "system" ? undefined : preference;
}

export function serializeThemeCookie(preference: ThemePreference, secure: boolean): string {
  const parts = [
    `${THEME_COOKIE}=${preference}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Reads the preference from a Cookie header or document.cookie string. */
export function readThemeCookie(cookieHeader: string): ThemePreference {
  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === THEME_COOKIE) return parseThemePreference(rest.join("="));
  }
  return "system";
}

/**
 * The browser-chrome colour for each mode: `--mist`, the background of the shell's rail and top
 * bar. `contrast.test.ts` keeps these equal to tokens.css.
 */
export const THEME_COLORS = { light: "#f2f4f8", dark: "#0e1322" } as const;

export const LIGHT_SCHEME_MEDIA = "(prefers-color-scheme: light)";
export const DARK_SCHEME_MEDIA = "(prefers-color-scheme: dark)";

export interface ThemeColorTag {
  media: string;
  color: string;
}

/**
 * The `<meta name="theme-color">` pair for a preference, in the shape of Next's
 * `Viewport.themeColor`. "system" maps each media query to its own mode; a manual choice gives
 * both queries the chosen mode's colour, so the browser chrome matches the page whatever the OS
 * is set to.
 */
export function themeColors(preference: ThemePreference): ThemeColorTag[] {
  const mode = themeAttribute(preference);
  return [
    { media: LIGHT_SCHEME_MEDIA, color: THEME_COLORS[mode ?? "light"] },
    { media: DARK_SCHEME_MEDIA, color: THEME_COLORS[mode ?? "dark"] },
  ];
}
