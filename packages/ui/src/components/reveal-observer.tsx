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
    // What is already on screen is marked before the hidden state exists; the rest is watched.
    const arm = () => {
      const viewport = window.innerHeight;
      for (const element of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        const { top, bottom } = element.getBoundingClientRect();
        if (top < viewport && bottom > 0) element.setAttribute("data-in", "");
        else observer.observe(element);
      }
      root.setAttribute("data-reveal", "on");
    };
    arm();
    // Markup that streams in after hydration is picked up once the page has loaded.
    if (document.readyState !== "complete") window.addEventListener("load", arm, { once: true });
    return () => {
      window.removeEventListener("load", arm);
      observer.disconnect();
    };
  }, [routeKey]);
  return null;
}
