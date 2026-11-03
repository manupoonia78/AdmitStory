"use client";

// The one delegated click listener for marketing analytics (plan §3.6): any element with
// data-track="<event>" (and data-track-* props) sends its event. Links stay plain server markup.

import { useEffect } from "react";
import { trackFromElement } from "../_lib/track";

export function TrackClicks() {
  useEffect(() => {
    if (!process.env.POSTHOG_KEY) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("[data-track]") : null;
      if (target) trackFromElement(target);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
