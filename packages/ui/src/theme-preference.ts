// Server-safe helpers shared by ThemeToggle and apps/web's root layout, which reads the
// cookie to render data-theme on first paint (no flash, no reload).

export const THEME_COOKIE = "theme";
export const THEME_PREFERENCES = ["system", "night", "day"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ThemeName = Exclude<ThemePreference, "system">;

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Match system",
  night: "Night",
  day: "Day",
};

/** Cookies written before the Night/Day themes (Phase 0) keep working. */
const LEGACY_PREFERENCES: Record<string, ThemePreference> = { light: "day", dark: "night" };

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (!value) return "system";
  return THEME_PREFERENCES.find((p) => p === value) ?? LEGACY_PREFERENCES[value] ?? "system";
}

/** Value for <html data-theme>; undefined means "follow prefers-color-scheme". */
export function themeAttribute(preference: ThemePreference): ThemeName | undefined {
  return preference === "system" ? undefined : preference;
}

/**
 * The theme an immersive screen (Story Studio, kit generation, live mocks) shows: Night unless
 * the user explicitly chose Day (spec §6.3).
 */
export function immersiveTheme(preference: ThemePreference): ThemeName {
  return preference === "day" ? "day" : "night";
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
 * The browser-chrome colour for each theme: `--space`, the app background. `contrast.test.ts`
 * keeps these equal to tokens.css.
 */
export const THEME_COLORS = { day: "#f4f5fb", night: "#070a1f" } as const;

export const LIGHT_SCHEME_MEDIA = "(prefers-color-scheme: light)";
export const DARK_SCHEME_MEDIA = "(prefers-color-scheme: dark)";

export interface ThemeColorTag {
  media: string;
  color: string;
}

/**
 * The `<meta name="theme-color">` pair for a preference, in the shape of Next's
 * `Viewport.themeColor`. "system" maps each media query to its own theme; a manual choice gives
 * both queries the chosen theme's colour, so the browser chrome matches the page whatever the OS
 * is set to. With `immersive`, the pair follows `immersiveTheme()` instead.
 */
export function themeColors(
  preference: ThemePreference,
  { immersive = false }: { immersive?: boolean } = {},
): ThemeColorTag[] {
  const theme = immersive ? immersiveTheme(preference) : themeAttribute(preference);
  return [
    { media: LIGHT_SCHEME_MEDIA, color: THEME_COLORS[theme ?? "day"] },
    { media: DARK_SCHEME_MEDIA, color: THEME_COLORS[theme ?? "night"] },
  ];
}
