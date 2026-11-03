"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import { StatusLabel, type StatusTone } from "../components/status-label";
import { cx } from "../lib/cx";
import { overLimit, type LimitUnit } from "./limit-counter";
import { usePlainKey } from "./shortcuts";

/** The Files pane's groups, in order (spec §5.8). Phase 4 fills the first three. */
export const FILE_GROUPS = [
  { id: "essays", label: "Essays" },
  { id: "short_answers", label: "Short answers" },
  { id: "video", label: "Video essay" },
  { id: "form", label: "Application form" },
  { id: "resume", label: "Resume" },
  { id: "recommenders", label: "Recommenders" },
  { id: "interview", label: "Interview" },
] as const;

export type FileGroupId = (typeof FILE_GROUPS)[number]["id"];

/** A deliverable's state in the Files pane (spec §5.8): drafting, draft ready, needs you, final. */
export type FileStatus = "waiting" | "drafting" | "draft_ready" | "needs_you" | "final" | "failed";

export interface FileEntry {
  key: string;
  /** "Essay 1", "Goal statement". */
  title: string;
  group: FileGroupId;
  status: FileStatus;
  /** Open NEED questions and Verify items, shown with "Needs you". */
  openQuestions?: number;
  /** Limit progress, "187 / 200 words". Omit for deliverables without a limit. */
  progress?: { count: number; limit: number; unit: LimitUnit };
}

export interface FilesPaneProps {
  /** The kit's name, e.g. "Darden 2026–27". */
  heading: string;
  files: readonly FileEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Render entries as links (for routes); otherwise they are buttons. */
  hrefFor?: (key: string) => string;
  /** J and K move between deliverables outside text fields (spec §6.12). Default true. */
  shortcuts?: boolean;
  id?: string;
  className?: string;
}

const STATUS: Record<FileStatus, { tone: StatusTone; word: string }> = {
  waiting: { tone: "neutral", word: "Not drafted yet" },
  drafting: { tone: "neutral", word: "Drafting" },
  draft_ready: { tone: "verified", word: "Draft ready" },
  needs_you: { tone: "needs", word: "Needs you" },
  final: { tone: "verified", word: "Final" },
  failed: { tone: "risk", word: "Didn’t finish" },
};

/** The status in words, with the count of open questions for "Needs you". */
export function fileStatusWord(file: Pick<FileEntry, "status" | "openQuestions">): string {
  const { word } = STATUS[file.status];
  return file.status === "needs_you" && file.openQuestions
    ? `${word} (${file.openQuestions})`
    : word;
}

/** The key J (+1) or K (−1) moves to, in pane order, stopping at the ends. */
export function stepFile(
  files: readonly Pick<FileEntry, "key" | "group">[],
  selectedKey: string | null,
  step: 1 | -1,
): string | null {
  const ordered = FILE_GROUPS.flatMap((group) => files.filter((f) => f.group === group.id));
  if (ordered.length === 0) return null;
  const at = ordered.findIndex((f) => f.key === selectedKey);
  if (at < 0) return (step === 1 ? ordered[0] : ordered.at(-1))?.key ?? null;
  return ordered[Math.min(ordered.length - 1, Math.max(0, at + step))]?.key ?? null;
}

/**
 * The Files plane (spec §5.8, screen G): the school's deliverables grouped as Essays, Short
 * answers, Video essay and so on. A list, not cards: the title, the status in words with its icon,
 * and the limit count in tabular figures ("187 / 200 words"). J and K move to the next and previous
 * deliverable from anywhere outside a text field.
 */
export function FilesPane({
  heading,
  files,
  selectedKey,
  onSelect,
  hrefFor,
  shortcuts = true,
  id,
  className,
}: FilesPaneProps) {
  const headingId = useId();
  const listRef = useRef<HTMLElement>(null);
  const move = (step: 1 | -1) => {
    const next = stepFile(files, selectedKey, step);
    if (!next || next === selectedKey) return;
    onSelect(next);
    // Keep the selection in view, without moving focus away from where the reader is.
    listRef.current
      ?.querySelector<HTMLElement>(`[data-file="${CSS.escape(next)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };
  usePlainKey("j", () => move(1), shortcuts);
  usePlainKey("k", () => move(-1), shortcuts);

  return (
    <nav
      ref={listRef}
      id={id}
      aria-labelledby={headingId}
      className={cx("flex flex-col gap-5 p-5", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-semibold text-text">
          {heading}
        </h2>
        {shortcuts ? (
          <p className="text-sm text-text-soft">
            <kbd className="font-ui">J</kbd> and <kbd className="font-ui">K</kbd> move between
            files.
          </p>
        ) : null}
      </div>
      {FILE_GROUPS.map((group) => {
        const entries = files.filter((file) => file.group === group.id);
        if (entries.length === 0) return null;
        return (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-1">
            <h3 className="text-sm text-text-soft">{group.label}</h3>
            <ul className="flex flex-col">
              {entries.map((file) => (
                <li key={file.key}>
                  <FileRow
                    file={file}
                    current={file.key === selectedKey}
                    href={hrefFor?.(file.key)}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function FileRow({
  file,
  current,
  href,
  onSelect,
}: {
  file: FileEntry;
  current: boolean;
  href: string | undefined;
  onSelect: (key: string) => void;
}) {
  const status = STATUS[file.status];
  const word = fileStatusWord(file);
  const over = file.progress ? overLimit(file.progress.count, file.progress.limit) : 0;
  const className = cx(
    "flex min-h-11 w-full flex-col gap-0.5 rounded-control px-3 py-2 text-left",
    current ? "bg-veil text-text" : "text-text-soft hover:text-text",
  );
  const body = (
    <>
      <span className={cx("truncate", current ? "font-medium text-text" : null)}>{file.title}</span>
      <span className="flex flex-wrap items-center justify-between gap-x-2 text-sm tabular-nums">
        {/* Status colours never sit on --veil: the open file's status is neutral text. */}
        {current ? <span>{word}</span> : <StatusLabel tone={status.tone}>{word}</StatusLabel>}
        {file.progress ? (
          <span className={cx("ml-auto", over && !current ? "text-risk" : null)}>
            {over ? (
              <WarningIcon size={14} aria-hidden className="mr-1 inline align-[-2px]" />
            ) : null}
            {file.progress.count} / {file.progress.limit}
            <span className="sr-only">
              {" "}
              {file.progress.unit}
              {over ? `, ${over} over` : ""}
            </span>
          </span>
        ) : null}
      </span>
    </>
  );
  const shared = {
    "data-file": file.key,
    "aria-current": current ? ("page" as const) : undefined,
    className,
  };
  return href ? (
    <a
      {...shared}
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(file.key);
      }}
    >
      {body}
    </a>
  ) : (
    <button {...shared} type="button" onClick={() => onSelect(file.key)}>
      {body}
    </button>
  );
}
