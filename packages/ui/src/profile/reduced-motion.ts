"use client";

// prefers-reduced-motion without Motion. Components that animate with CSS transitions (the lens
// dial) only need the preference, and importing "motion/react" for it would pull Motion into the
// route's first load (docs/phase-2.md, JS budget).

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/** True when the user asks for reduced motion. False on the server and before hydration. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
