"use client";

// faq_open with the question's id (never its text), from one capture-phase toggle listener on the
// list (toggle doesn't bubble). Renders nothing.

import { useEffect } from "react";
import { track } from "../_lib/track";

export function FaqTracking({ target }: { target: string }) {
  useEffect(() => {
    const list = document.getElementById(target);
    if (!list) return;
    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      const id = details.dataset.faq;
      if (id) track("faq_open", { id });
    };
    list.addEventListener("toggle", onToggle, true);
    return () => list.removeEventListener("toggle", onToggle, true);
  }, [target]);
  return null;
}
