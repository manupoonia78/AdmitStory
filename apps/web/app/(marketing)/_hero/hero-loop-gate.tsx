"use client";

// The hero's only first-load code (SPEC §3.5): it decides when the loop may load, and nothing
// else. After `load`, on idle, and only once the hero is on screen. Never under reduced motion or
// Save-Data: the poster the server sent is the whole hero then, and ./hero-loop is not requested.

import { useEffect } from "react";

export function HeroLoopGate() {
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;

    let cancelled = false;
    let stop: (() => void) | undefined;
    const undo: (() => void)[] = [];

    const whenSeen = () => {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void import("./hero-loop")
          .then((loop) => {
            if (!cancelled) stop = loop.startHeroLoop(hero);
          })
          .catch(() => {});
      });
      observer.observe(hero);
      undo.push(() => observer.disconnect());
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(whenSeen, { timeout: 3000 });
        undo.push(() => window.cancelIdleCallback(id));
      } else {
        const id = window.setTimeout(whenSeen, 1200);
        undo.push(() => window.clearTimeout(id));
      }
    };
    if (document.readyState === "complete") whenIdle();
    else {
      window.addEventListener("load", whenIdle, { once: true });
      undo.push(() => window.removeEventListener("load", whenIdle));
    }

    return () => {
      cancelled = true;
      undo.forEach((fn) => fn());
      stop?.();
    };
  }, []);

  return null;
}
