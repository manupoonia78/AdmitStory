import { ViewTransitionStyles } from "@admitstory/ui";
import type { ReactNode } from "react";

// Both pages share this layout, so it persists while the story cards fly between them. It carries
// the view transition rules (the app shell carries its own copy for signed-in routes).
export default function TransitionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ViewTransitionStyles />
      {children}
    </>
  );
}
