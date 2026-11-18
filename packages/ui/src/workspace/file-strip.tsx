"use client";

import { useLayoutEffect, useRef } from "react";
import { cx } from "../lib/cx";
import { fileStatusWord, stepFile, type FileEntry, type FileStatus } from "./files-pane";
import { overLimit } from "./limit-counter";
import { usePlainKey } from "./shortcuts";

export interface FileStripProps {
  /** For the strip's accessible name: "Essays". */
  label: string;
  files: readonly FileEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Entries are links (routes); a plain click goes through `onSelect`. */
  hrefFor: (key: string) => string;
  /** J and K move between files outside text fields (spec §6.12). Default true. */
  shortcuts?: boolean;
  className?: string;
}

/** The status dot's colour; the word itself is in each chip's accessible name. */
const DOT: Record<FileStatus, string> = {
  waiting: "ring",
  drafting: "ring",
  coming_soon: "ring",
  draft_ready: "bg-verified",
  final: "bg-verified",
  needs_you: "bg-needs",
  failed: "bg-risk",
};

/**
 * The open tab's documents as a row of chips under the school's tabs (SPEC §6.6). It replaces the
 * left Files pane inside a school: the tabs choose the kind (Essays, Application), the strip the
 * document. Each chip: the title, a status dot and the limit progress. J and K move between them,
 * and the current chip is kept in view by scrolling the row itself, never the page.
 */
export function FileStrip({
  label,
  files,
  selectedKey,
  onSelect,
  hrefFor,
  shortcuts = true,
  className,
}: FileStripProps) {
  const row = useRef<HTMLUListElement>(null);
  const move = (step: 1 | -1) => {
    const next = stepFile(files, selectedKey, step);
    if (next && next !== selectedKey) onSelect(next);
  };
  usePlainKey("j", () => move(1), shortcuts);
  usePlainKey("k", () => move(-1), shortcuts);

  useLayoutEffect(() => {
    const list = row.current;
    const chip = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !chip) return;
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16 - list.clientWidth;
    if (list.scrollLeft > left) list.scrollLeft = left;
    else if (list.scrollLeft < right) list.scrollLeft = right;
  }, [selectedKey]);

  if (files.length === 0) return null;
  return (
    <nav aria-label={label} className={cx("min-w-0", className)} data-no-swipe>
      <ul ref={row} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
        {files.map((file) => {
          const current = file.key === selectedKey;
          const over = file.progress ? overLimit(file.progress.count, file.progress.limit) : 0;
          const dot = DOT[file.status];
          return (
            <li key={file.key} className="shrink-0">
              <a
                href={hrefFor(file.key)}
                aria-current={current ? "page" : undefined}
                data-file={file.key}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                    return;
                  event.preventDefault();
                  onSelect(file.key);
                }}
                className={cx(
                  "chip h-9 gap-2 pr-3.5 pl-4 transition-[background-color,color] duration-(--dur-hover) ease-rise",
                  current ? "border-text bg-text text-space" : "text-text hover:bg-frost-hover",
                )}
              >
                <span className="max-w-[16rem] truncate">{file.title}</span>
                <span
                  aria-hidden
                  className={cx(
                    "size-1.5 shrink-0 rounded-full",
                    dot === "ring"
                      ? cx("border", current ? "border-space/60" : "border-text-faint")
                      : cx(dot, current ? "ring-1 ring-space" : null),
                  )}
                />
                {file.progress ? (
                  <span
                    aria-hidden
                    className={cx(
                      "font-mono text-[11px] tabular-nums",
                      over && !current ? "text-risk" : current ? "opacity-70" : "text-text-soft",
                    )}
                  >
                    {file.progress.count} / {file.progress.limit}
                  </span>
                ) : null}
                <span className="sr-only">
                  {`, ${fileStatusWord(file)}`}
                  {file.progress
                    ? `, ${file.progress.count} of ${file.progress.limit} ${file.progress.unit}${over ? `, ${over} over` : ""}`
                    : ""}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
