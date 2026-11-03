"use client";

// The nine Story Studio chapters (spec §5.2) as tabs over the one interview panel. Every tab
// controls the same panel, which keeps the Voiceprint and transcript mounted while the chapter
// changes. Activation is manual: arrow keys move focus and Enter or Space opens the chapter, so
// browsing the list never starts a question being read aloud. Space here opens a tab rather than
// recording, because Space to talk steps aside on tabs (space-to-talk.ts).

import { useRef, type KeyboardEvent } from "react";
import { cx } from "../lib/cx";

export interface ChapterTab<Id extends string = string> {
  id: Id;
  label: string;
}

export interface ChapterTabsProps<Id extends string> {
  chapters: readonly ChapterTab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** The id of the panel every tab controls. */
  panelId: string;
  label?: string;
  className?: string;
}

/** The tab a navigation key moves focus to, wrapping at both ends; null for any other key. */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function chapterTabId(panelId: string, id: string): string {
  return `${panelId}-tab-${id}`;
}

export function ChapterTabs<Id extends string>({
  chapters,
  value,
  onChange,
  panelId,
  label = "Chapters",
  className,
}: ChapterTabsProps<Id>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]") ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next = nextTabIndex(event.key, current < 0 ? 0 : current, tabs.length);
    if (next === null) return;
    event.preventDefault();
    tabs[next]?.focus();
  };

  return (
    // Scrolls sideways on phones instead of wrapping into three rows; the page itself never does.
    <div
      className={cx("-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0", className)}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex w-max gap-1 sm:w-auto sm:flex-wrap"
      >
        {chapters.map((chapter) => {
          const selected = chapter.id === value;
          return (
            <button
              key={chapter.id}
              type="button"
              role="tab"
              id={chapterTabId(panelId, chapter.id)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(chapter.id)}
              className={cx(
                "min-h-11 shrink-0 rounded-control px-3 text-base whitespace-nowrap",
                "transition-colors duration-(--spring-snap-duration) ease-snap",
                selected
                  ? "bg-veil font-medium text-text"
                  : "text-text-soft hover:bg-veil hover:text-text",
              )}
            >
              {chapter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
