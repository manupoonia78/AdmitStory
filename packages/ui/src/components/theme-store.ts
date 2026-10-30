"use client";

// The theme preference store, without any UI. Kept apart from theme-toggle.tsx so the account
// menu can read and write the preference without pulling the toggle's markup and icons into
// every signed-in route (spec §6.11 budget).

import { useSyncExternalStore } from "react";
import {
  DARK_SCHEME_MEDIA,
  THEME_COLORS,
  immersiveTheme,
  readThemeCookie,
  serializeThemeCookie,
  themeAttribute,
  themeColors,
  type ThemeName,
  type ThemePreference,
} from "../theme-preference";

/** Marks an <ImmersiveScope>; while one is on the page, the browser chrome follows it. */
export const IMMERSIVE_ATTRIBUTE = "data-immersive";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Points the `<meta name="theme-color">` tags at the chosen theme, so the browser chrome (the
 * mobile address bar, the installed-app title bar) matches the page. apps/web renders the initial
 * pair with `themeColors()`; this keeps them in step after a manual change. A media-qualified tag
 * gets that query's colour from `themeColors()`, which is the media-based pair again for "system".
 * A tag without `media` gets the colour of the theme now showing. With no tags it adds the pair.
 * On a page with an immersive scope the pair is Night unless Day was chosen.
 */
export function applyThemeColor(preference: ThemePreference) {
  const immersive = document.querySelector(`[${IMMERSIVE_ATTRIBUTE}]`) !== null;
  const tags = themeColors(preference, { immersive });
  const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    for (const { media, color } of tags) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("media", media);
      meta.setAttribute("content", color);
      document.head.append(meta);
    }
    return;
  }
  for (const meta of metas) {
    const media = meta.getAttribute("media");
    const tag = media ? tags.find((t) => t.media === media) : undefined;
    if (tag) meta.setAttribute("content", tag.color);
    else if (!media) {
      const theme = immersive ? immersiveTheme(preference) : resolvedTheme(preference);
      meta.setAttribute("content", THEME_COLORS[theme]);
    }
  }
}

function resolvedTheme(preference: ThemePreference): ThemeName {
  const attribute = themeAttribute(preference);
  if (attribute) return attribute;
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_SCHEME_MEDIA).matches
    ? "night"
    : "day";
}

/**
 * Persists the choice and applies it at once, so no reload is needed: `data-theme` on <html> and
 * the theme-color meta tags.
 */
export function setThemePreference(preference: ThemePreference) {
  document.cookie = serializeThemeCookie(preference, window.location.protocol === "https:");
  const attribute = themeAttribute(preference);
  if (attribute) document.documentElement.setAttribute("data-theme", attribute);
  else document.documentElement.removeAttribute("data-theme");
  applyThemeColor(preference);
  for (const listener of listeners) listener();
}

/**
 * Current preference from the cookie. `serverValue` is what the server rendered
 * (from the same cookie), used during hydration.
 */
export function useThemePreference(serverValue: ThemePreference = "system"): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => readThemeCookie(document.cookie),
    () => serverValue,
  );
}
