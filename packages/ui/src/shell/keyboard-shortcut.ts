"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

/**
 * Exported for tests. `key` is checked before use: Chrome dispatches a keydown with no `key` when
 * it autofills a field, and calling toLowerCase() on that would throw on every autofill.
 */
export function isCommandK(event: KeyboardEvent): boolean {
  return (
    typeof event.key === "string" &&
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

/** ⌘K on Apple platforms, Ctrl K elsewhere. Either works everywhere. */
export function useCommandK(onPress: () => void) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (!isCommandK(event)) return;
    event.preventDefault();
    onPress();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}

const noSubscription = () => () => {};

function detectApple(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Visible hint for the shortcut; the server renders "Ctrl K" and the client corrects it. */
export function useShortcutHint(): { label: string; ariaKeyShortcuts: string } {
  const apple = useSyncExternalStore(noSubscription, detectApple, () => false);
  return { label: apple ? "⌘K" : "Ctrl K", ariaKeyShortcuts: "Meta+K Control+K" };
}
