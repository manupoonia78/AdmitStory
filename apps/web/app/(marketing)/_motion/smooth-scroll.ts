// Lenis smooth scroll on desktop marketing pages (direction §3, plan §3.5 and §8.6). This module
// is the only place that imports `lenis`, and it does so with import(), so Lenis is never in a
// route's first load. One instance per page load:
//
//   startLenis()       SmoothScrollHost calls it on the first wheel event (desktop only)
//   getLenis()         the instance once started (or starting), else null
//   onLenisStart(cb)   runs cb with the instance as soon as it exists (at once if it already does)
//
// The pinned sequence (package B) never creates a second instance: it calls getLenis(), and if
// that is null, onLenisStart(), then `lenis.on("scroll", ScrollTrigger.update)`.

import type Lenis from "lenis";

let instance: Lenis | null = null;
let starting: Promise<Lenis | null> | null = null;
const waiting = new Set<(lenis: Lenis) => void>();

/** Starts Lenis once. Resolves to null if it can't load (the page keeps native scroll). */
export function startLenis(): Promise<Lenis | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  starting ??= import("lenis")
    .then(({ default: LenisClass }) => {
      instance = new LenisClass({ autoRaf: true, anchors: true });
      for (const callback of waiting) callback(instance);
      waiting.clear();
      return instance;
    })
    .catch(() => null);
  return starting;
}

/** The running instance (waiting for one that is starting), or null when smooth scroll is off. */
export function getLenis(): Promise<Lenis | null> {
  if (instance) return Promise.resolve(instance);
  return starting ?? Promise.resolve(null);
}

/** Calls `callback` with the instance when it starts, or at once if it already has. */
export function onLenisStart(callback: (lenis: Lenis) => void): () => void {
  if (instance) {
    callback(instance);
    return () => {};
  }
  waiting.add(callback);
  return () => {
    waiting.delete(callback);
  };
}

/** Stops smooth scroll and goes back to native scrolling (leaving the marketing pages). */
export function destroyLenis(): void {
  instance?.destroy();
  instance = null;
  starting = null;
}
