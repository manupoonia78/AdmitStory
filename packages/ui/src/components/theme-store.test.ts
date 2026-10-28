// @vitest-environment jsdom
import "../../test/dom";
import { afterEach, describe, expect, it } from "vitest";
import { DARK_SCHEME_MEDIA, LIGHT_SCHEME_MEDIA, THEME_COLORS } from "../theme-preference";
import { applyThemeColor, setThemePreference } from "./theme-store";

// What apps/web's root layout renders from Viewport.themeColor.
function renderInitialTags() {
  document.head.innerHTML =
    `<meta name="theme-color" media="${LIGHT_SCHEME_MEDIA}" content="${THEME_COLORS.light}">` +
    `<meta name="theme-color" media="${DARK_SCHEME_MEDIA}" content="${THEME_COLORS.dark}">`;
}

function contents(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const meta of document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    out[meta.getAttribute("media") ?? ""] = meta.content;
  }
  return out;
}

afterEach(() => {
  document.head.innerHTML = "";
});

describe("theme-color meta tags", () => {
  it("follow a manual choice whatever the system is set to", () => {
    renderInitialTags();
    setThemePreference("dark");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.dark,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.dark,
    });

    setThemePreference("light");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.light,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.light,
    });
  });

  it("go back to the media-based pair for Match system", () => {
    renderInitialTags();
    setThemePreference("dark");
    setThemePreference("system");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.light,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.dark,
    });
  });

  it("adds the pair when the page has none", () => {
    applyThemeColor("dark");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.dark,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.dark,
    });
  });

  it("sets a tag without media to the mode now showing", () => {
    document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.light}">`;
    applyThemeColor("dark");
    expect(contents()).toEqual({ "": THEME_COLORS.dark });
  });
});
