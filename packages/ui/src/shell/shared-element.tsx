"use client";

// Shared elements across routes (spec §6.6): the same element travels from one page to the next,
// a story card from the shelf into its detail page and back. With the View Transitions API, React
// pairs the two <ViewTransition>s that share a name and the browser flies one into the other on
// the drift spring (view-transition-styles.tsx). Without it, the element that arrives plays a
// FLIP flight from where its twin left, with Motion loaded only then.

import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { prefersStillness } from "../lib/edge-light";
import { viewTransitionsSupported } from "./route-transition";

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

export interface Flip {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/** The transform (origin top-left) that puts an element laid out at `to` back where `from` was. */
export function flipFrom(from: Box, to: Box): Flip {
  return {
    x: from.left - to.left,
    y: from.top - to.top,
    scaleX: to.width > 0 ? from.width / to.width : 1,
    scaleY: to.height > 0 ? from.height / to.height : 1,
  };
}

interface Departure {
  box: Box;
  node: HTMLElement;
  at: number;
}

/** Where each named element was when it left the page, for the fallback flight. */
const departures = new Map<string, Departure>();
/** A twin that left longer ago than this belongs to an earlier navigation: no flight. */
const FLIGHT_WINDOW_MS = 1000;

function fly(node: HTMLElement, from: Box): () => void {
  const still = prefersStillness();
  const flip = flipFrom(from, node.getBoundingClientRect());
  let controls: { stop(): void } | null = null;
  let cancelled = false;

  // Set synchronously, before paint, so the first frame already shows the element at its origin.
  if (still) {
    node.style.opacity = "0";
  } else {
    node.style.transformOrigin = "0 0";
    node.style.transform = `translate(${flip.x}px, ${flip.y}px) scale(${flip.scaleX}, ${flip.scaleY})`;
  }

  void Promise.all([import("motion/react"), import("../motion")]).then(
    ([{ animate }, { REDUCED_FADE, spring }]) => {
      if (cancelled) return;
      controls = still
        ? animate(node, { opacity: [0, 1] }, REDUCED_FADE)
        : animate(
            node,
            {
              x: [flip.x, 0],
              y: [flip.y, 0],
              scaleX: [flip.scaleX, 1],
              scaleY: [flip.scaleY, 1],
            },
            spring("drift"),
          );
    },
    () => reset(),
  );

  function reset() {
    node.style.opacity = "";
    node.style.transform = "";
    node.style.transformOrigin = "";
  }

  return () => {
    cancelled = true;
    controls?.stop();
    reset();
  };
}

export interface SharedElementProps {
  /** Identity across pages: both ends of a flight use the same name, unique on each page. */
  name: string;
  /** Optional: a surface is often just a styled box with nothing inside. */
  children?: ReactNode;
  className?: string;
  /**
   * A plain plane (a card's background): its snapshot stretches to the box mid-flight. Leave it
   * off for anything with text, which should fly as its own SharedElement.
   */
  surface?: boolean;
}

export function SharedElement({ name, children, className, surface = false }: SharedElementProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || viewTransitionsSupported()) return;
    const departure = departures.get(name);
    departures.delete(name);
    // A departure from this very node is React re-running effects (Strict Mode), not a flight.
    const arriving =
      departure && departure.node !== node && performance.now() - departure.at < FLIGHT_WINDOW_MS;
    const stop = arriving ? fly(node, departure.box) : () => {};
    return () => {
      stop();
      departures.set(name, { box: node.getBoundingClientRect(), node, at: performance.now() });
    };
  }, [name]);

  return (
    <ViewTransition name={name} share={surface ? "flight surface" : "flight"} default="none">
      <div ref={ref} data-shared-element={name} className={className}>
        {children}
      </div>
    </ViewTransition>
  );
}
