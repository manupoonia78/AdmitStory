import { describe, expect, it } from "vitest";
import {
  THEME_COLORS,
  immersiveTheme,
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
    expect(readThemeCookie("session=abc; theme=day")).toBe("day");
    expect(readThemeCookie("theme=night")).toBe("night");
  });

  it("reads Phase 0 light and dark cookies as Day and Night", () => {
    expect(parseThemePreference("light")).toBe("day");
    expect(parseThemePreference("dark")).toBe("night");
    expect(readThemeCookie("theme=dark; session=abc")).toBe("night");
  });

  it("maps system to no data-theme attribute", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("night")).toBe("night");
    expect(themeAttribute("day")).toBe("day");
  });

  it("shows immersive screens in Night unless Day was chosen", () => {
    expect(immersiveTheme("system")).toBe("night");
    expect(immersiveTheme("night")).toBe("night");
    expect(immersiveTheme("day")).toBe("day");
  });

  it("writes a one-year, site-wide, Lax cookie", () => {
    expect(serializeThemeCookie("night", true)).toBe(
      "theme=night; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(serializeThemeCookie("day", false)).not.toContain("Secure");
  });

  it("gives the theme-color pair for each preference", () => {
    expect(themeColors("system")).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.day },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.night },
    ]);
    expect(themeColors("night").map((t) => t.color)).toEqual([
      THEME_COLORS.night,
      THEME_COLORS.night,
    ]);
    expect(themeColors("day").map((t) => t.color)).toEqual([THEME_COLORS.day, THEME_COLORS.day]);
  });

  it("gives immersive screens Night chrome unless Day was chosen", () => {
    expect(themeColors("system", { immersive: true }).map((t) => t.color)).toEqual([
      THEME_COLORS.night,
      THEME_COLORS.night,
    ]);
    expect(themeColors("day", { immersive: true }).map((t) => t.color)).toEqual([
      THEME_COLORS.day,
      THEME_COLORS.day,
    ]);
  });
});
