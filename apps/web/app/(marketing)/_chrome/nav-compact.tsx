"use client";

// Marks the header once the landing hero has scrolled past (direction §4.1). The hero renders a
// sentinel, <div id="hero-end">, at its bottom edge. Pages without one are compact from the first
// paint through CSS alone (marketing.css), so this only ever runs where there is a hero.
//
// Over the hero, which is always Night, the plane also takes data-theme="night", so in the Day
// theme the nav still reads against the hero. (Before hydration a Day visitor sees the Day nav over
// the hero for a moment; the hero's own H1 is unaffected.)

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function NavCompact() {
  const pathname = usePathname();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = ref.current?.closest("header");
    const plane = header?.querySelector<HTMLElement>(".site-header-plane");
    const sentinel = document.getElementById("hero-end");
    if (!header || !plane) return;
    const set = (past: boolean) => {
      header.toggleAttribute("data-past-hero", past);
      if (past || !sentinel) plane.removeAttribute("data-theme");
      else plane.setAttribute("data-theme", "night");
    };
    set(false);
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      set(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pathname]);

  return <span ref={ref} hidden />;
}
