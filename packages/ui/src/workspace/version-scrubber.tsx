"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { REDUCED_FADE } from "../motion";
import { verifiedDate } from "./coach/source-line";
import { diffRuns, diffWords } from "./diff";

export interface DraftVersion {
  id: string;
  /** 1-based, "v4". */
  number: number;
  author: "ai" | "user";
  /** ISO timestamp. */
  createdAt: string;
  /** What made it: "First draft", "Cut to limit", "Your edits". */
  label?: string;
  /** The version as plain text (drafts.plain_text). */
  text: string;
}

export interface VersionScrubberProps {
  versions: readonly DraftVersion[];
  /** The version on the canvas. */
  currentId: string;
  onRestore: (id: string) => void;
  className?: string;
}

/** Spec §6.6: the scrubber crossfades between versions the same way diffs morph, 240 ms. */
const CROSSFADE = { duration: 0.24, ease: "linear" } as const;

function versionName(version: DraftVersion): string {
  const who = version.author === "user" ? "your edits" : "Admitstory";
  return `v${version.number}, ${version.label ?? who}, ${verifiedDate(version.createdAt)}`;
}

/**
 * The version timeline under the draft (spec §5.8): every AI generation and every save is a
 * version. Arrow keys or a click choose one to look at; it crossfades in below. "Compare" shows
 * it against the current draft as an inline diff, and "Restore" makes it current (as a new
 * version, so nothing is lost). Reduced motion: a 120 ms fade.
 */
export function VersionScrubber({
  versions,
  currentId,
  onRestore,
  className,
}: VersionScrubberProps) {
  const reduced = useReducedMotion();
  const labelId = useId();
  const [selectedId, setSelectedId] = useState(currentId);
  const [compare, setCompare] = useState(false);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const ordered = useMemo(() => [...versions].sort((a, b) => a.number - b.number), [versions]);
  const current = ordered.find((v) => v.id === currentId);
  const selected = ordered.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected?.id === currentId;

  const select = (index: number) => {
    const version = ordered[Math.max(0, Math.min(ordered.length - 1, index))];
    if (!version) return;
    setSelectedId(version.id);
    dots.current[ordered.indexOf(version)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = ordered.findIndex((v) => v.id === selected?.id);
    const keys: Record<string, number> = {
      ArrowLeft: at - 1,
      ArrowUp: at - 1,
      ArrowRight: at + 1,
      ArrowDown: at + 1,
      Home: 0,
      End: ordered.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  const runs = useMemo(
    () => (selected && current && compare ? diffRuns(diffWords(selected.text, current.text)) : []),
    [selected, current, compare],
  );

  if (!current || !selected) return null;
  return (
    <section
      aria-labelledby={labelId}
      className={cx("flex flex-col gap-4 border-t border-edge pt-4", className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={labelId} className="font-medium tabular-nums text-text">
          v{selected.number}
          <span className="sr-only"> of {ordered.length} versions</span>
        </h2>
        <div
          role="radiogroup"
          aria-label="Versions"
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-1 items-center"
        >
          {ordered.map((version, index) => {
            const active = version.id === selected.id;
            return (
              <div key={version.id} className="flex flex-1 items-center last:flex-none">
                <button
                  ref={(node) => {
                    dots.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${versionName(version)}${version.id === currentId ? ", current" : ""}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelectedId(version.id)}
                  className="group relative flex size-6 shrink-0 items-center justify-center rounded-full before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-1/2"
                >
                  <span
                    aria-hidden
                    className={cx(
                      "rounded-full border transition-[width,height,background-color] duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                      active
                        ? "size-3 border-signal bg-signal"
                        : "size-2 border-control bg-depth group-hover:bg-control",
                      version.id === currentId && !active ? "border-text bg-text" : null,
                    )}
                  />
                </button>
                {index < ordered.length - 1 ? (
                  <span aria-hidden className="h-px flex-1 bg-edge" />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="quiet"
            aria-pressed={compare}
            disabled={isCurrent}
            onClick={() => setCompare((on) => !on)}
          >
            Compare
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={ArrowCounterClockwiseIcon}
            disabled={isCurrent}
            onClick={() => onRestore(selected.id)}
          >
            Restore v{selected.number}
          </Button>
        </div>
      </div>

      <p className="text-sm text-text-soft" aria-live="polite">
        {isCurrent
          ? `${versionName(selected)}. This is the current draft.`
          : `${versionName(selected)}.`}
      </p>

      {isCurrent ? null : (
        <div className="grid">
          <AnimatePresence initial={false}>
            <motion.div
              key={`${selected.id}:${compare ? "diff" : "text"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduced ? REDUCED_FADE : CROSSFADE}
              className="col-start-1 row-start-1 whitespace-pre-line font-reading text-read text-text"
              data-version={selected.id}
            >
              {compare ? (
                <p>
                  {runs.map((run, index) => (
                    <span key={index}>
                      {index > 0 ? " " : null}
                      {run.kind === "same" ? (
                        run.text
                      ) : run.kind === "removed" ? (
                        <del className="text-text-soft decoration-1">
                          <span className="sr-only">[only in v{selected.number}: </span>
                          {run.text}
                          <span className="sr-only">]</span>
                        </del>
                      ) : (
                        <ins className="bg-veil underline decoration-text-soft decoration-1 underline-offset-4">
                          <span className="sr-only">[only in the current draft: </span>
                          {run.text}
                          <span className="sr-only">]</span>
                        </ins>
                      )}
                    </span>
                  ))}
                </p>
              ) : (
                selected.text
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
