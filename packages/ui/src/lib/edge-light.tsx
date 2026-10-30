"use client";

// Planes catch a soft edge light where the cursor is (spec §6.6). The pointer position is written
// to CSS custom properties on the plane, at most once per frame, and <EdgeLight /> paints a
// radial light masked to the plane's 1px border. No React state: moving the pointer never
// re-renders anything. Off with reduced motion and for touch, which has no hovering cursor.

import { useCallback, type CSSProperties, type RefCallback } from "react";
import { cx } from "./cx";

export interface EdgePoint {
  x: number;
  y: number;
}

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** The pointer's position inside the box, in px from its top-left corner, clamped to the box. */
export function edgeLightPoint(box: Box, clientX: number, clientY: number): EdgePoint {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return {
    x: Math.round(clamp(clientX - box.left, box.width)),
    y: Math.round(clamp(clientY - box.top, box.height)),
  };
}

export interface FrameThrottle<T> {
  /** Queue a value; only the latest one queued before the next frame is applied. */
  push(value: T): void;
  cancel(): void;
}

/** Applies the latest pushed value once per animation frame, so pointer events never pile up. */
export function frameThrottle<T>(
  apply: (value: T) => void,
  raf: (callback: FrameRequestCallback) => number = (cb) => window.requestAnimationFrame(cb),
  caf: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle),
): FrameThrottle<T> {
  let frame: number | null = null;
  let latest: T;
  return {
    push(value) {
      latest = value;
      if (frame !== null) return;
      frame = raf(() => {
        frame = null;
        apply(latest);
      });
    },
    cancel() {
      if (frame !== null) caf(frame);
      frame = null;
    },
  };
}

/** True when nothing should follow the cursor: reduced motion, or no matchMedia at all. */
export function prefersStillness(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const hasCursor = (event: PointerEvent) =>
  event.pointerType === "mouse" || event.pointerType === "pen";

/** Wires a plane up; returns the cleanup. Exported for tests and non-React callers. */
export function attachEdgeLight(node: HTMLElement): () => void {
  const throttle = frameThrottle<{ x: number; y: number }>(({ x, y }) => {
    const point = edgeLightPoint(node.getBoundingClientRect(), x, y);
    node.style.setProperty("--edge-x", `${point.x}px`);
    node.style.setProperty("--edge-y", `${point.y}px`);
    node.style.setProperty("--edge-on", "1");
  });

  function onMove(event: PointerEvent) {
    // Checked per event, so turning reduced motion on mid-session takes effect at once.
    if (!hasCursor(event) || prefersStillness()) return;
    throttle.push({ x: event.clientX, y: event.clientY });
  }

  function onLeave() {
    throttle.cancel();
    node.style.setProperty("--edge-on", "0");
  }

  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerleave", onLeave);
  return () => {
    throttle.cancel();
    node.removeEventListener("pointermove", onMove);
    node.removeEventListener("pointerleave", onLeave);
  };
}

/** Ref for a plane that should catch the edge light. Render <EdgeLight /> inside it. */
export function useEdgeLight<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((node: T | null) => (node ? attachEdgeLight(node) : undefined), []);
}

// A radial light at the pointer, masked to a 1px ring: the plane's own border brightens near the
// cursor. --text at low strength is a soft white light in Night and a graphite edge in Day; UI
// chrome never borrows --voice (spec §6.3).
const LIGHT_STYLE: CSSProperties = {
  opacity: "var(--edge-on, 0)",
  padding: 1,
  background:
    "radial-gradient(10rem circle at var(--edge-x, 50%) var(--edge-y, 0), " +
    "color-mix(in srgb, var(--text) 38%, transparent), transparent 70%)",
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
};

/**
 * The light itself. Place it as a child of a positioned plane (relative, fixed or absolute) that
 * uses useEdgeLight(); it follows the plane's radius and never takes pointer events.
 */
export function EdgeLight({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="edge-light"
      style={LIGHT_STYLE}
      className={cx(
        "pointer-events-none absolute -inset-px rounded-[inherit]",
        "transition-opacity duration-(--spring-snap-duration) ease-snap motion-reduce:hidden",
        className,
      )}
    />
  );
}
