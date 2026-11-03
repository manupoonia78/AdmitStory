"use client";

import type { RatingQueueItem } from "@admitstory/shared";
import { Button, FieldError } from "@admitstory/ui";
import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../_components/request";

// One item at a time (§8.11): five 44 px score buttons, optional tags and a note. 1–5 scores and
// saves, J/K move, and nothing fires while typing in the note.

const TAGS = ["invented", "generic", "off voice", "off prompt", "too long", "great"];

export function ReviewQueue({ items }: { items: RatingQueueItem[] }) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((i) => !i.rated),
    ),
  );
  const [rated, setRated] = useState(() => new Set(items.filter((i) => i.rated).map((i) => i.id)));
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const item = items[index];

  const move = useCallback(
    (by: number) => {
      setIndex((i) => Math.min(items.length - 1, Math.max(0, i + by)));
      setTags([]);
      setNote("");
      setError(null);
      setStatus(null);
    },
    [items.length],
  );

  const score = useCallback(
    async (value: number) => {
      if (!item) return;
      setError(null);
      const result = await adminRequest("/api/admin/evals/ratings", {
        json: {
          kind: item.kind,
          id: item.id,
          score: value,
          tags,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRated((set) => new Set(set).add(item.id));
      setStatus(`Saved ${value} of 5`);
      if (index < items.length - 1) move(1);
    },
    [item, tags, note, index, items.length, move],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        void score(Number(event.key));
      } else if (event.key === "j") move(1);
      else if (event.key === "k") move(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [score, move]);

  if (!item) return null;
  return (
    <section aria-labelledby="item-label" className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-text-soft tabular-nums">
        {index + 1} of {items.length} · {rated.size} rated
      </p>
      <h2 id="item-label" className="text-lg font-semibold text-text">
        {item.label}{" "}
        {rated.has(item.id) ? (
          <span className="text-sm font-normal text-text-soft">(rated)</span>
        ) : null}
      </h2>
      <div className="max-h-[50vh] overflow-y-auto rounded-control border border-edge bg-depth p-4 text-base whitespace-pre-wrap text-text">
        {item.text}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-text">Tags (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <label
              key={tag}
              className="flex min-h-11 items-center gap-2 rounded-control border border-edge px-3 text-sm text-text"
            >
              <input
                type="checkbox"
                checked={tags.includes(tag)}
                onChange={(e) =>
                  setTags((t) => (e.target.checked ? [...t, tag] : t.filter((x) => x !== tag)))
                }
              />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm text-text">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          className="min-h-20 rounded-control border border-control bg-depth p-2 text-base text-text"
        />
      </label>
      <div role="group" aria-label="Score from 1 to 5" className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            type="button"
            variant="secondary"
            className="min-h-11 min-w-11"
            onClick={() => void score(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => move(-1)}
          disabled={index === 0}
        >
          Previous (K)
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => move(1)}
          disabled={index === items.length - 1}
        >
          Next (J)
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-text-soft">
        {status}
      </p>
      <div aria-live="assertive">{error ? <FieldError>{error}</FieldError> : null}</div>
    </section>
  );
}
