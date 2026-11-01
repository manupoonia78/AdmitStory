"use client";

// Evidence links and the drawer they open (spec §5.4 AC: every claim cites stories and facts by
// link; §6.10 screen D: evidence links open the story in a side drawer). One drawer serves the
// whole page: each EvidenceLink hands its refs to the page, which opens EvidenceDrawer with them.
// EvidenceLink lives in evidence-link.tsx. The drawer is the existing Sheet, which glides in from the right and fades under reduced motion.

import { Sheet, SheetContent } from "../components/sheet";
import type { EvidenceItem } from "./types";

export interface EvidenceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly EvidenceItem[];
  /** Defaults to the story's title for one item, "What this is based on" for several. */
  title?: string;
  /** The claim the evidence supports, shown under the title. */
  description?: string;
}

export function EvidenceDrawer({
  open,
  onOpenChange,
  items,
  title,
  description,
}: EvidenceDrawerProps) {
  const heading =
    title ?? (items.length === 1 ? (items[0] as EvidenceItem).title : "What this is based on");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={heading} description={description}>
        {items.length === 0 ? (
          <p className="text-text-soft">Nothing is cited here.</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {items.map((item) => (
              <li key={item.id} data-evidence={item.id} className="flex flex-col gap-2">
                <p className="text-sm text-text-soft">
                  {item.kind === "story" ? "Story" : "Fact"}
                  {item.context ? `, ${item.context}` : null}
                </p>
                {items.length > 1 ? (
                  <h3 className="text-base font-medium text-text">{item.title}</h3>
                ) : null}
                {item.excerpt ? (
                  <blockquote className="font-reading text-read text-text">
                    {item.excerpt}
                  </blockquote>
                ) : null}
                {item.href ? (
                  <a
                    href={item.href}
                    className="self-start rounded-control text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
                  >
                    Open in Dossier
                    <span className="sr-only">: {item.title}</span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
