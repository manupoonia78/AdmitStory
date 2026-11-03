// Browser bindings for the pure gates in ../_lib/gates.ts. Every function is safe to call during
// server rendering (it answers "no") and never throws in an old browser.

import {
  DESKTOP_MOTION_QUERY,
  PHONE_QUERY,
  REDUCED_MOTION_QUERY,
  desktopMotionAllowed,
} from "../_lib/gates";

function matches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** The visitor's "Save-Data" / Lite mode hint, where the browser exposes it. */
export function saveDataOn(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Desktop, fine pointer, motion welcome, no Save-Data: where GSAP and Lenis may run. */
export function desktopMotion(): boolean {
  return desktopMotionAllowed({ matches: matches(DESKTOP_MOTION_QUERY), saveData: saveDataOn() });
}

export function isPhone(): boolean {
  return matches(PHONE_QUERY);
}

export function reducedMotion(): boolean {
  return matches(REDUCED_MOTION_QUERY);
}

/** Resolves on the first idle period (with a timeout fallback where requestIdleCallback is missing). */
export function whenIdle(timeout = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve(), { timeout });
    } else {
      setTimeout(resolve, Math.min(timeout, 1200));
    }
  });
}

/** Resolves once the window `load` event has fired (at once if it already has). */
export function whenLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", () => resolve(), { once: true });
  });
}
