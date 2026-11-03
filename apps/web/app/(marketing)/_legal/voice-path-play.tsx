"use client";

// Starts the voice-path diagram's one run (direction §7) when it is 40% in view. A few hundred
// bytes: it only calls beginElement() on the SVG's start trigger. Reduced motion: never starts.

import { useEffect } from "react";

export function VoicePathPlay({ target }: { target: string }) {
  useEffect(() => {
    const root = document.getElementById(target);
    if (!root || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.4) continue;
          observer.unobserve(entry.target);
          entry.target.querySelector<SVGAnimationElement>("[data-voice-start]")?.beginElement();
        }
      },
      { threshold: 0.4 },
    );
    for (const svg of root.querySelectorAll("svg")) observer.observe(svg);
    return () => observer.disconnect();
  }, [target]);
  return null;
}
