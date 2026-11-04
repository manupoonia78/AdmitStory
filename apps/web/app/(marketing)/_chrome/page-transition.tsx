"use client";

// Navigations between marketing pages cross-fade the page body on glide (direction §9); the header
// stays still (view-transition-name: site-header, marketing.css). The "route-in"/"route-out"
// classes are defined by ViewTransitionStyles in @admitstory/ui. Browsers without the View
// Transitions API swap in place.
//
// Keyed by pathname and animated on enter/exit only, never on update: an `update` animation also
// fired whenever a lazy island inside the page resolved (the hero's live Voiceprint, the pinned
// sequence), which cross-faded the whole landing page twice while it loaded.

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="route-in" exit="route-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
