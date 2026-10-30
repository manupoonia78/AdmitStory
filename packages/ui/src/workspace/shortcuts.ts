"use client";

// Single-letter shortcuts in the Workspace (spec §6.12): Y for the your-words view, A and R to
// accept or reject a change. A bare letter must never fire while someone is typing, so each
// press is checked against where focus is and which modifiers are held.

import { useEffect, useEffectEvent } from "react";

const TYPING_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);

/** True when a key press on `target` is text entry: inputs, text areas, editors and the like. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (element as HTMLInputElement).type;
    // Buttons, checkboxes and the like take no text.
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file"].includes(
      type,
    );
  }
  const role = element.getAttribute("role");
  return role !== null && TYPING_ROLES.has(role);
}

/**
 * True when `event` is the bare letter `key` (either case): no Ctrl, Meta or Alt, not held down,
 * not mid-composition (an IME), and not already handled. Shift is allowed so caps lock works.
 */
export function isPlainKey(event: KeyboardEvent, key: string): boolean {
  return (
    typeof event.key === "string" &&
    event.key.toLowerCase() === key.toLowerCase() &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !isTypingTarget(event.target)
  );
}

/** Calls `onPress` when the bare letter `key` is pressed anywhere outside a text field. */
export function usePlainKey(key: string, onPress: () => void, enabled = true) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (!isPlainKey(event, key)) return;
    event.preventDefault();
    onPress();
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}
