import { describe, expect, it } from "vitest";
import {
  THEME_COLORS,
  parseThemePreference,
  readThemeCookie,
  serializeThemeCookie,
  themeAttribute,
  themeColors,
} from "./theme-preference";

describe("theme preference", () => {
  it("falls back to the system for missing or unknown values", () => {
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("sepia")).toBe("system");
    expect(readThemeCookie("session=abc; other=1")).toBe("system");
  });

  it("reads the theme from a Cookie header", () => {
    expect(readThemeCookie("session=abc; theme=light")).toBe("light");
  });

  it("maps system to no data-theme attribute", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("dark")).toBe("dark");
  });

  it("writes a one-year, site-wide, Lax cookie", () => {
    expect(serializeThemeCookie("dark", true)).toBe(
      "theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(serializeThemeCookie("light", false)).not.toContain("Secure");
  });

  it("gives the theme-color pair for each preference", () => {
    expect(themeColors("system")).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ]);
    expect(themeColors("dark").map((t) => t.color)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);
    expect(themeColors("light").map((t) => t.color)).toEqual([
      THEME_COLORS.light,
      THEME_COLORS.light,
    ]);
  });
});
