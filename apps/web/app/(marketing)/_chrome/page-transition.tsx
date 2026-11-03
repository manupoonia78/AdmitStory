"use client";

// Navigations between marketing pages cross-fade the page body on glide (direction §9); the header
// stays still (view-transition-name: site-header, marketing.css). The "route" class is defined by
// ViewTransitionStyles in @admitstory/ui. Browsers without the View Transitions API swap in place.

import { ViewTransition, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition update="route" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
