"use client";

// Route transitions (spec §6.6, §6.11). Next 16 runs every navigation inside a React transition,
// so React's <ViewTransition> animates route changes through the browser's View Transitions API
// with no configuration. Where the API is missing, a Motion animation stands in; Motion is
// imported only then, so it never weighs on a route's first load.

import { usePathname } from "next/navigation";
import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { prefersStillness } from "../lib/edge-light";

/**
 * The transition type dock links and the palette add to their navigations. Only these animate
 * the content: a refresh, a server action or the browser's back button swap it in place.
 */
export const ROUTE_TRANSITION_TYPE = "route";

export function viewTransitionsSupported(doc: Document | undefined = globalThis.document): boolean {
  return typeof doc?.startViewTransition === "function";
}

interface Stoppable {
  stop(): void;
}

/** Fallback entrance: the new view rises 8px on glide while it fades in (opacity only when
 *  reduced). Returns a stop function; a newer navigation stops it mid-flight. */
function playFallbackEntrance(node: HTMLElement): () => void {
  const still = prefersStillness();
  let controls: Stoppable | null = null;
  let cancelled = false;
  node.style.opacity = "0";
  void Promise.all([import("motion/react"), import("../motion")]).then(
    ([{ animate }, { REDUCED_FADE, spring }]) => {
      if (cancelled) return;
      controls = still
        ? animate(node, { opacity: [0, 1] }, REDUCED_FADE)
        : animate(
            node,
            { opacity: [0, 1], y: [8, 0] },
            { ...spring("glide"), opacity: REDUCED_FADE },
          );
    },
    () => {
      node.style.opacity = "";
    },
  );
  return () => {
    cancelled = true;
    controls?.stop();
    node.style.opacity = "";
    node.style.transform = "";
  };
}

export interface RouteTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Wraps the routed content of a layout so dock and palette navigations animate it. */
export function RouteTransition({ children, className }: RouteTransitionProps) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef(pathname);

  useLayoutEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    const node = ref.current;
    if (!node || viewTransitionsSupported()) return;
    return playFallbackEntrance(node);
  }, [pathname]);

  return (
    <ViewTransition update={{ [ROUTE_TRANSITION_TYPE]: "route", default: "none" }} default="none">
      <div ref={ref} data-slot="route-content" className={className}>
        {children}
      </div>
    </ViewTransition>
  );
}
