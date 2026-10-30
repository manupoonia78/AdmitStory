"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STORY_CLOSE } from "./stories";

/**
 * Escape returns from a story to the shelf (keyboard-first, spec §6.12), flying the card back like
 * the "All stories" link does. An Escape something else already handled (a menu, a dialog) or one
 * typed into a field is left alone.
 */
export function BackOnEscape({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      router.push(href, { transitionTypes: [STORY_CLOSE] });
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [href, router]);
  return null;
}
