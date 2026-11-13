"use client";

import { useEffect } from "react";

const SELECTOR = ".reveal:not([data-in])";

/**
 * The one shared IntersectionObserver behind the `reveal` utility (SPEC §2.10): each `.reveal`
 * element gets `data-in` the first time 15% of it is on screen, and is then left alone. Mount it
 * once in a layout; pass the pathname as `routeKey` so a client navigation picks up the new
 * page's elements.
 *
 * Safe by construction: elements are only ever hidden under `<html data-reveal="on">`, which
 * this component sets after it has marked everything already in view. If this script never
 * runs, nothing is hidden. It does nothing under reduced motion.
 */
export function RevealObserver({ routeKey }: { routeKey?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-motion") !== "on" || typeof IntersectionObserver !== "function") {
      return;
    }
    const elements = document.querySelectorAll<HTMLElement>(SELECTOR);
    const viewport = window.innerHeight;
    for (const element of elements) {
      const { top, bottom } = element.getBoundingClientRect();
      if (top < viewport && bottom > 0) element.setAttribute("data-in", "");
    }
    root.setAttribute("data-reveal", "on");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    for (const element of elements) {
      if (!element.hasAttribute("data-in")) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [routeKey]);
  return null;
}
