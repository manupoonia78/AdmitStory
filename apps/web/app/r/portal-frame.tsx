import { SkipLink, Wordmark } from "@admitstory/ui";
import type { ReactNode } from "react";

// The recommender portal's frame (SPEC §6.14): outside the signed-in shell, so no casing, no dock,
// no command palette and no analytics. Always paper, whatever the visitor's own theme: the people
// reading it are not our customers, and a letter is written on paper. From 640 px the page is one
// sheet on the desk; on a phone the paper is the whole screen. The greeting's entrance is CSS
// (portal.css), only under <html data-motion="on">.

export function PortalFrame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="day" className="portal">
      <SkipLink targetId="main" />
      <div className="portal-sheet">
        <header className="flex items-center border-b border-edge pb-6">
          <Wordmark size={23} />
        </header>
        <main id="main" tabIndex={-1} className="flex flex-col gap-14 pt-10 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
