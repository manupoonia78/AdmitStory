"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in step with the viewport. The server and the first client
 * render assume it does not match, so markup must already look right at every width through CSS;
 * this only decides behaviour (e.g. whether the Coach is a modal sheet).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}
