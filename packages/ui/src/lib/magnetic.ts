"use client";

// Magnetic pull on primary actions (spec §6.6): on a fine pointer, the control leans towards the
// cursor by at most 6px and snaps back on the snap spring when the cursor leaves. The offset is
// the CSS `translate` property, transitioned with --spring-snap, so every new pointer position
// retargets the motion mid-flight. Off with reduced motion and on coarse (touch) pointers.

import { useCallback, type Ref, type RefCallback } from "react";
import { frameThrottle, prefersStillness } from "./edge-light";

export const MAGNETIC_MAX_PX = 6;

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

/**
 * How far to pull the element towards the pointer: 0 at its centre, growing linearly to `max` at
 * its edges, never more than `max` on either axis.
 */
export function magneticOffset(
  box: Box,
  clientX: number,
  clientY: number,
  max = MAGNETIC_MAX_PX,
): { x: number; y: number } {
  const axis = (pointer: number, start: number, size: number) => {
    if (size <= 0) return 0;
    const fromCentre = (pointer - (start + size / 2)) / (size / 2);
    const value = Math.max(-1, Math.min(1, fromCentre)) * max;
    return Math.round(value * 10) / 10 || 0;
  };
  return { x: axis(clientX, box.left, box.width), y: axis(clientY, box.top, box.height) };
}

function canPull(node: HTMLElement): boolean {
  if (prefersStillness()) return false;
  if (!window.matchMedia("(pointer: fine)").matches) return false;
  return !(node as HTMLButtonElement).disabled && node.getAttribute("aria-disabled") !== "true";
}

/** Wires an element up; returns the cleanup. Exported for tests and non-React callers. */
export function attachMagnetic(node: HTMLElement, max = MAGNETIC_MAX_PX): () => void {
  let current = { x: 0, y: 0 };

  const set = (offset: { x: number; y: number }) => {
    current = offset;
    node.style.translate = offset.x || offset.y ? `${offset.x}px ${offset.y}px` : "";
  };

  const throttle = frameThrottle<{ x: number; y: number }>(({ x, y }) => {
    // The measured box includes the current pull; take it out so the pull never feeds itself.
    const box = node.getBoundingClientRect();
    const rest = {
      left: box.left - current.x,
      top: box.top - current.y,
      width: box.width,
      height: box.height,
    };
    set(magneticOffset(rest, x, y, max));
  });

  function onMove(event: PointerEvent) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (!canPull(node)) {
      if (current.x || current.y) set({ x: 0, y: 0 });
      return;
    }
    throttle.push({ x: event.clientX, y: event.clientY });
  }

  function onLeave() {
    throttle.cancel();
    set({ x: 0, y: 0 });
  }

  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerleave", onLeave);
  return () => {
    throttle.cancel();
    node.removeEventListener("pointermove", onMove);
    node.removeEventListener("pointerleave", onLeave);
    node.style.translate = "";
  };
}

/** Ref for a primary action. `enabled: false` returns a ref that does nothing. */
export function useMagnetic<T extends HTMLElement>(enabled = true): RefCallback<T> {
  return useCallback(
    (node: T | null) => (enabled && node ? attachMagnetic(node) : undefined),
    [enabled],
  );
}

/** One ref callback that feeds several refs, keeping React 19 ref cleanups. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
      return undefined;
    });
    return () => {
      cleanups.forEach((cleanup, index) => {
        const ref = refs[index];
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      });
    };
  };
}
