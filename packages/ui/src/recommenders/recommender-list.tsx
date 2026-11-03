"use client";

// Screen H's left plane (§6.10 H): the recommenders as a list, 248px wide, the same shape as the
// Workspace Files pane. Below 1024px it becomes one select at the top of the page, because a
// 360px screen cannot hold a side plane and the work beside it (§6.12).
//
// Quiet by design: the only motion is the selected row's hairline, which moves on the snap spring.

import type { RecommenderListItem } from "@admitstory/shared/kit";
import { useId, useRef } from "react";
import { StatusLabel } from "../components/status-label";
import { cx } from "../lib/cx";
import { usePlainKey } from "../workspace/shortcuts";
import { roleLine, STATUS_TONES, statusWord } from "./recommender-text";

export interface RecommenderListProps {
  items: readonly RecommenderListItem[];
  selectedId: string | null;
  /** Rows are links, so a recommender can be opened in a new tab. */
  hrefFor: (id: string) => string;
  onSelect: (id: string) => void;
  /** "Add a recommender", under the list. */
  action?: React.ReactNode;
  /** J and K move between recommenders outside text fields (§6.12). Default true. */
  shortcuts?: boolean;
  className?: string;
}

/** The id J (+1) or K (−1) moves to, stopping at the ends. */
export function stepRecommender(
  items: readonly { id: string }[],
  selectedId: string | null,
  by: 1 | -1,
): string | null {
  if (items.length === 0) return null;
  const index = items.findIndex((item) => item.id === selectedId);
  if (index === -1) return items[by === 1 ? 0 : items.length - 1]?.id ?? null;
  const next = Math.min(items.length - 1, Math.max(0, index + by));
  return items[next]?.id ?? null;
}

export function RecommenderList({
  items,
  selectedId,
  hrefFor,
  onSelect,
  action,
  shortcuts = true,
  className,
}: RecommenderListProps) {
  const headingId = useId();
  const selectId = useId();
  const rows = useRef(new Map<string, HTMLAnchorElement | null>());

  const move = (by: 1 | -1) => {
    const next = stepRecommender(items, selectedId, by);
    if (!next || next === selectedId) return;
    onSelect(next);
    rows.current.get(next)?.focus();
  };
  usePlainKey("j", () => move(1), shortcuts && items.length > 1);
  usePlainKey("k", () => move(-1), shortcuts && items.length > 1);

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {/* Phone and tablet: one select, then the work below it. */}
      <div className="flex flex-col gap-1 lg:hidden">
        <label htmlFor={selectId} className="text-sm text-text-soft">
          Recommender
        </label>
        <select
          id={selectId}
          value={selectedId ?? ""}
          onChange={(event) => onSelect(event.target.value)}
          className="min-h-11 w-full rounded-control border border-control bg-depth px-3 text-lg text-text sm:text-base"
        >
          {selectedId === null ? <option value="">Pick a recommender</option> : null}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {statusWord(item.status)}
            </option>
          ))}
        </select>
      </div>

      <nav aria-labelledby={headingId} className="hidden lg:flex lg:flex-col lg:gap-2">
        <h2 id={headingId} className="text-sm font-medium text-text-soft">
          Your recommenders
        </h2>
        <ul className="flex flex-col border-t border-edge">
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id} className="border-b border-edge">
                <a
                  ref={(element) => {
                    rows.current.set(item.id, element);
                  }}
                  href={hrefFor(item.id)}
                  aria-current={selected ? "page" : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                      return;
                    event.preventDefault();
                    onSelect(item.id);
                  }}
                  className={cx(
                    "flex min-h-11 flex-col gap-1 py-3 pl-3 pr-2",
                    "border-l-2 transition-colors duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                    selected
                      ? "border-l-signal bg-veil text-text"
                      : "border-l-transparent text-text hover:bg-veil",
                  )}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-text-soft">{roleLine(item)}</span>
                  <StatusLabel tone={STATUS_TONES[item.status]}>{item.statusLine}</StatusLabel>
                  <span className="text-sm tabular-nums text-text-soft">
                    {item.stories} {item.stories === 1 ? "story" : "stories"}
                    {item.schools.length > 0
                      ? ` · ${item.schools.map((school) => school.name).join(", ")}`
                      : ""}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        {action ? <div className="pt-1">{action}</div> : null}
      </nav>

      {action ? <div className="lg:hidden">{action}</div> : null}
    </div>
  );
}
