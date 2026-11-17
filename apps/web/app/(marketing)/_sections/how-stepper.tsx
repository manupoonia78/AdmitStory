"use client";

// The one script in "How it works" (SPEC §4, scene 3). It marks the scene live, which lets the CSS
// stack the four windows in one pinned place, and then keeps `data-on` on the step that is
// crossing a line 65% down the viewport. Stepped: each change is one short CSS transition, and
// nothing follows the scroll position. Without this script each step simply sits beside its own
// window. Renders nothing.

import { useEffect } from "react";

export function HowStepper({ target }: { target: string }) {
  useEffect(() => {
    const scene = document.getElementById(target);
    if (!scene || typeof IntersectionObserver === "undefined") return;
    const steps = [...scene.querySelectorAll<HTMLElement>("[data-how-step]")];
    const texts = steps.map((step) => step.querySelector<HTMLElement>("[data-how-text]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = texts.indexOf(entry.target as HTMLElement);
          steps.forEach((step, i) => step.toggleAttribute("data-on", i === index));
        }
      },
      { rootMargin: "-65% 0px -35% 0px" },
    );
    for (const text of texts) if (text) observer.observe(text);
    scene.setAttribute("data-live", "");
    return () => {
      observer.disconnect();
      scene.removeAttribute("data-live");
    };
  }, [target]);
  return null;
}
