"use client";

import type { PrivacyInventory } from "@admitstory/shared";
import { useEffect, useRef, useState } from "react";
import { springEase } from "../motion-curves";

// "What we keep" (Settings › Privacy, Phase 9b plan §8): one plain inventory. On first view the
// counts settle from 0 to their value on the `settle` spring, 30 ms apart, in tabular figures so
// nothing shifts; then it is still. Reduced motion (or no JS): the values are there from the first
// frame, which is also what the server renders. A <dl>, no live region.

const ITEMS: { key: keyof PrivacyInventory; one: string; many: string }[] = [
  { key: "stories", one: "story", many: "stories" },
  { key: "facts", one: "fact", many: "facts" },
  { key: "goldenLines", one: "golden line", many: "golden lines" },
  { key: "studioMinutes", one: "minute in Story Studio", many: "minutes in Story Studio" },
  { key: "drafts", one: "draft", many: "drafts" },
  { key: "schools", one: "school", many: "schools" },
  { key: "recommenders", one: "recommender", many: "recommenders" },
  { key: "uploads", one: "upload", many: "uploads" },
  { key: "audioRecordings", one: "audio recording", many: "audio recordings" },
];

const DURATION_MS = 1_120;
const STAGGER_MS = 30;

export function PrivacyInventoryList({ inventory }: { inventory: PrivacyInventory }) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...inventory }));
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ease = springEase("settle");
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      let done = true;
      const next: Record<string, number> = {};
      ITEMS.forEach(({ key }, i) => {
        const t = Math.min(1, Math.max(0, (now - start - i * STAGGER_MS) / DURATION_MS));
        if (t < 1) done = false;
        next[key] = Math.round(inventory[key] * Math.min(1, ease(t)));
      });
      setShown(next);
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inventory]);

  return (
    <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
      {ITEMS.map(({ key, one, many }) => (
        // dt before dd in the source (a valid group); the row is reversed so the number reads first.
        <div
          key={key}
          className="flex flex-row-reverse items-baseline justify-end gap-3 border-b border-edge pb-2"
        >
          <dt className="text-text-soft">
            {inventory[key] === 1 ? one : many}
            {key === "audioRecordings" ? (
              <span className="block text-xs">We don&apos;t keep audio.</span>
            ) : null}
          </dt>
          <dd className="min-w-[4ch] text-right text-2xl font-semibold tabular-nums text-text">
            {shown[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
