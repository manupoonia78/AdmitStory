"use client";

// The theme preference store, without any UI. Kept apart from theme-toggle.tsx so the account
// menu can use it without pulling Radix RadioGroup into every signed-in route (spec §6.9 budget).

import { useSyncExternalStore } from "react";
import {
  DARK_SCHEME_MEDIA,
  THEME_COLORS,
  readThemeCookie,
  serializeThemeCookie,
  themeAttribute,
  themeColors,
  type ThemePreference,
} from "../theme-preference";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Points the `<meta name="theme-color">` tags at the chosen mode, so the browser chrome (the
 * mobile address bar, the installed-app title bar) matches the page. apps/web renders the initial
 * pair with `themeColors()`; this keeps them in step after a manual change. A media-qualified tag
 * gets that query's colour from `themeColors()`, which is the media-based pair again for "system".
 * A tag without `media` gets the colour of the mode now showing. With no tags it adds the pair.
 */
export function applyThemeColor(preference: ThemePreference) {
  const tags = themeColors(preference);
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
    else if (!media) meta.setAttribute("content", THEME_COLORS[resolvedMode(preference)]);
  }
}

function resolvedMode(preference: ThemePreference): "light" | "dark" {
  const attribute = themeAttribute(preference);
  if (attribute) return attribute;
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_SCHEME_MEDIA).matches
    ? "dark"
    : "light";
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
