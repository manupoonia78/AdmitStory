// @vitest-environment jsdom
import "../../test/dom";
import { afterEach, describe, expect, it } from "vitest";
import { DARK_SCHEME_MEDIA, LIGHT_SCHEME_MEDIA, THEME_COLORS } from "../theme-preference";
import { applyThemeColor, setThemePreference } from "./theme-store";

// What apps/web's root layout renders from Viewport.themeColor.
function renderInitialTags() {
  document.head.innerHTML =
    `<meta name="theme-color" media="${LIGHT_SCHEME_MEDIA}" content="${THEME_COLORS.day}">` +
    `<meta name="theme-color" media="${DARK_SCHEME_MEDIA}" content="${THEME_COLORS.night}">`;
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
    setThemePreference("night");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.night,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.night,
    });

    setThemePreference("day");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.day,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.day,
    });
  });

  it("go back to the media-based pair for Match system", () => {
    renderInitialTags();
    setThemePreference("night");
    setThemePreference("system");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.day,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.night,
    });
  });

  it("adds the pair when the page has none", () => {
    applyThemeColor("night");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.night,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.night,
    });
  });

  it("sets a tag without media to the mode now showing", () => {
    document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.day}">`;
    applyThemeColor("night");
    expect(contents()).toEqual({ "": THEME_COLORS.night });
  });

  it("stay Night on a page with an immersive scope, unless Day was chosen", () => {
    renderInitialTags();
    document.body.innerHTML = '<div data-immersive data-theme="night"></div>';
    setThemePreference("system");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.night,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.night,
    });
    setThemePreference("day");
    expect(contents()).toEqual({
      [LIGHT_SCHEME_MEDIA]: THEME_COLORS.day,
      [DARK_SCHEME_MEDIA]: THEME_COLORS.day,
    });
    document.body.innerHTML = "";
  });
});
