"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

// The sheet's right margin (SPEC §6.9): the reasoning, each note level with the paragraph it
// explains. Notes come from "Why this draft" (the story it is built on, which paragraphs answer
// which part of the prompt), so the margin says nothing the panel doesn't. Positions are measured
// from the paragraphs after layout and kept from overlapping; one ResizeObserver keeps them true
// while the text reflows or the editor arrives.

export interface MarginNote {
  /** 0-based paragraph the note sits beside. */
  paragraph: number;
  text: string;
}

/** Gap kept between one note and the next when two paragraphs are short. */
const GAP_PX = 8;

export function MarginNotes({
  notes,
  textRef,
}: {
  notes: readonly MarginNote[];
  textRef: RefObject<HTMLElement | null>;
}) {
  const column = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<number[] | null>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    const box = column.current;
    if (!text || !box) return;
    const measure = () => {
      const paragraphs = text.querySelectorAll<HTMLElement>("[data-paragraph], .ProseMirror > p");
      const origin = box.getBoundingClientRect().top;
      const items = box.querySelectorAll<HTMLElement>("[data-note]");
      let floor = 0;
      const next = notes.map((note, i) => {
        const p = paragraphs[note.paragraph];
        const top = Math.max(floor, p ? p.getBoundingClientRect().top - origin + 4 : floor);
        floor = top + (items[i]?.offsetHeight ?? 0) + GAP_PX;
        return Math.round(top);
      });
      setTops((current) =>
        current && current.length === next.length && current.every((t, i) => t === next[i])
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    // The editor replaces the stand-in after first paint; watch for it.
    const mutations = new MutationObserver(measure);
    mutations.observe(text, { childList: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [notes, textRef]);

  if (notes.length === 0) return null;
  return (
    <div ref={column} className="relative h-full" aria-label="Reasoning" role="note">
      {notes.map((note, i) => (
        <p
          key={`${note.paragraph}:${note.text}`}
          data-note
          className="note absolute inset-x-0 text-accent transition-opacity duration-(--dur-swap)"
          style={{ top: tops?.[i] ?? 0, opacity: tops ? 1 : 0 }}
        >
          {note.text}
        </p>
      ))}
    </div>
  );
}

/** The notes for a draft, from its "why": where each part of the prompt is answered. */
export function notesFromWhy(why: {
  promptParts: readonly { part: string; paragraphs: readonly number[] }[];
}): MarginNote[] {
  const notes = new Map<number, string>();
  for (const { part, paragraphs } of why.promptParts) {
    if (paragraphs.length === 0) continue;
    const first = Math.min(...paragraphs);
    const last = Math.max(...paragraphs);
    const where = first === last ? `¶${first}` : `¶${first}–${last}`;
    const text = `${where} answers “${part}”`;
    const at = first - 1;
    notes.set(at, notes.has(at) ? `${notes.get(at)}. ${text}` : text);
  }
  return [...notes.entries()]
    .sort(([a], [b]) => a - b)
    .map(([paragraph, text]) => ({ paragraph, text }));
}
