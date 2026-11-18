"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../components/button";
import { Peak } from "../components/peak";
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
  const who = version.author === "user" ? "your edits" : "AdmitStories";
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
  /** Arrow keys move the peak at once; a click glides it (keyboard actions don't animate). */
  const [instant, setInstant] = useState(false);
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
  const at = ordered.length > 1 ? ordered.indexOf(selected) / (ordered.length - 1) : 0;
  return (
    <section aria-labelledby={labelId} className={cx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={labelId} className="label">
          Versions
          <span className="sr-only">
            , v{selected.number} of {ordered.length}
          </span>
        </h2>
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

      {/* The timeline (SPEC §6.9): a hairline, a tick per version, the peak on the one chosen. */}
      <div
        role="radiogroup"
        aria-label="Versions"
        onKeyDown={(event) => {
          setInstant(true);
          onKeyDown(event);
        }}
        className="relative mx-3 h-12"
      >
        <span aria-hidden className="absolute inset-x-0 top-[22px] h-[1.25px] bg-edge-strong" />
        {/* The peak rides a full-width box moved by its own width; the outer box clips it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 top-[6px] h-[17px] overflow-hidden"
        >
          <span
            className="absolute inset-y-0 right-2 left-2 motion-reduce:transition-none"
            style={{
              transform: `translateX(${at * 100}%)`,
              transition: instant ? "none" : "transform 200ms var(--ease-rise)",
            }}
          >
            <Peak className="absolute -left-1.5 h-[17px] w-3 text-text" strokeWidth={1.25} />
          </span>
        </span>
        {ordered.map((version, index) => {
          const active = version.id === selected.id;
          const left = ordered.length > 1 ? (index / (ordered.length - 1)) * 100 : 0;
          return (
            <button
              key={version.id}
              ref={(node) => {
                dots.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${versionName(version)}${version.id === currentId ? ", current" : ""}`}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                setInstant(false);
                setSelectedId(version.id);
              }}
              style={{ left: `${left}%` }}
              className="group absolute top-0 flex h-12 w-11 -translate-x-1/2 flex-col items-center rounded-full shadow-none [&[aria-checked=true]]:shadow-none"
            >
              <span
                aria-hidden
                className={cx(
                  "mt-[20px] h-[7px] w-[1.25px] transition-colors duration-(--dur-hover)",
                  version.id === currentId ? "bg-text" : "bg-text-faint group-hover:bg-text-soft",
                )}
              />
              <span
                aria-hidden
                className={cx(
                  "mt-1.5 font-mono text-[11px] leading-none tabular-nums transition-colors duration-(--dur-hover)",
                  active ? "text-text" : "text-text-label",
                )}
              >
                v{version.number}
              </span>
            </button>
          );
        })}
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
