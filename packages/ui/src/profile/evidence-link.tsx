"use client";

// Evidence links (spec §5.4 AC: every claim cites stories and facts by link). Its own module, apart
// from the drawer, so a page that shows links doesn't load the drawer (a Radix sheet with Motion)
// until one is opened (§6.11).

import { cx } from "../lib/cx";
import type { EvidenceKind, EvidenceRef } from "./types";

const KIND_WORDS: Record<EvidenceKind, [string, string]> = {
  story: ["story", "stories"],
  fact: ["fact", "facts"],
};

/** "The night-shift fix" for one ref; "2 stories and 1 fact" for several. */
export function evidenceLabel(refs: readonly EvidenceRef[]): string {
  if (refs.length === 1) return (refs[0] as EvidenceRef).title;
  const parts = (["story", "fact"] as const).flatMap((kind) => {
    const count = refs.filter((ref) => ref.kind === kind).length;
    if (count === 0) return [];
    return [`${count} ${KIND_WORDS[kind][count === 1 ? 0 : 1]}`];
  });
  return parts.join(" and ");
}

export interface EvidenceLinkProps {
  refs: readonly EvidenceRef[];
  onOpen: (refs: readonly EvidenceRef[]) => void;
  className?: string;
}

/**
 * An inline link at the end of a finding. It names the evidence ("The night-shift fix", "2
 * stories and 1 fact"), and its accessible name lists every title, so a screen reader hears what
 * the claim rests on without opening the drawer.
 */
export function EvidenceLink({ refs, onOpen, className }: EvidenceLinkProps) {
  if (refs.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(refs)}
      aria-label={`Evidence: ${refs.map((ref) => ref.title).join(", ")}`}
      className={cx(
        "relative inline rounded-control text-sm text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2",
        // 24px minimum target (WCAG 2.2 2.5.8) without changing the line's height.
        "before:absolute before:-inset-x-1 before:top-1/2 before:h-6 before:-translate-y-1/2",
        className,
      )}
    >
      {evidenceLabel(refs)}
    </button>
  );
}
