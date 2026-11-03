"use client";

import { Button, FieldError, StatusLabel, cx } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { wordDiff, type DiffPart } from "./diff";
import { adminRequest } from "./request";

// Screen M, pack review (spec §6.10 M, §9.3; direction doc, M). The source on the left, scrolling
// on its own, with the passage behind the focused field highlighted; the proposed fields on the
// right as a table: field, proposed value against the current one as a diff, the source passage,
// and accept, edit or reject. A/R decide, E edits, J/K move. Conflicts show every value with its
// trust; the official value wins by default, and a field nobody official decides stays unchanged
// until the admin chooses.

export interface ReviewCandidate {
  label: string;
  value: string;
  trust: number | null;
  sourceType: string | null;
}

export interface ReviewRow {
  id: string;
  fieldPath: string;
  proposed: string;
  current: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "edited";
  edited: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceType: string | null;
  trust: number | null;
  span: { start: number; end: number } | null;
  quote: string | null;
  /** Refresh-checker items: a summary to acknowledge, nothing to apply. */
  refresh: { summary: string; url: string } | null;
  conflict: {
    blocking: boolean;
    candidates: ReviewCandidate[];
    defaultLabel: string | null;
  } | null;
}

export interface ReviewSource {
  id: string;
  title: string;
  type: string;
  trust: number;
  text: string;
}

function Diff({ parts }: { parts: DiffPart[] }) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        part.kind === "same" ? (
          <span key={index}>{part.text}</span>
        ) : part.kind === "added" ? (
          <ins
            key={index}
            className="bg-veil text-text underline decoration-signal underline-offset-2"
          >
            <span className="sr-only">added: </span>
            {part.text}
          </ins>
        ) : (
          <del key={index} className="text-text-soft line-through">
            <span className="sr-only">removed: </span>
            {part.text}
          </del>
        ),
      )}
    </span>
  );
}

function SourcePane({ source, span }: { source: ReviewSource | null; span: ReviewRow["span"] }) {
  const markRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [source?.id, span?.start, span?.end]);
  if (!source)
    return <p className="p-3 text-sm text-text-soft">This field has no source passage to show.</p>;
  const text = source.text;
  const start = span ? Math.min(span.start, text.length) : -1;
  const end = span ? Math.min(span.end, text.length) : -1;
  return (
    <div className="flex h-full flex-col">
      <p className="border-b border-edge px-3 py-2 text-sm text-text-soft">
        {source.title} · {source.type.replaceAll("_", " ")} · trust {source.trust}
      </p>
      <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-reading text-read text-text">
        {start >= 0 && end > start ? (
          <>
            {text.slice(0, start)}
            <mark
              ref={markRef}
              className="rounded-sm bg-veil text-text outline outline-1 outline-signal"
            >
              {text.slice(start, end)}
            </mark>
            {text.slice(end)}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

export function ReviewBoard({
  rows,
  sources,
  initialSourceId,
}: {
  rows: ReviewRow[];
  sources: ReviewSource[];
  initialSourceId?: string;
}) {
  const router = useRouter();
  const firstIndex = Math.max(
    0,
    rows.findIndex(
      (r) => r.status === "pending" && (!initialSourceId || r.sourceId === initialSourceId),
    ),
  );
  const [focus, setFocus] = useState(firstIndex);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<{ id: string; message: string; outranked: boolean } | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const focused = rows[focus] ?? null;
  const source = sources.find((s) => s.id === focused?.sourceId) ?? null;

  useEffect(() => {
    rowRefs.current[focus]?.focus({ preventScroll: false });
  }, [focus]);

  async function decide(
    row: ReviewRow,
    decision: "accepted" | "rejected" | "edited",
    extra: { edited?: unknown; override?: boolean } = {},
  ) {
    if (row.status !== "pending" || busy) return;
    setBusy(true);
    setError(null);
    const result = await adminRequest(`/api/admin/kb/proposals/${row.id}`, {
      json: { decision, ...extra },
    });
    setBusy(false);
    if (!result.ok) {
      setError({
        id: row.id,
        message: result.error ?? "That decision wasn't saved.",
        outranked: result.code === "outranked_by_current",
      });
      return;
    }
    setEditing(null);
    setStatus(
      `${row.fieldPath} ${decision === "rejected" ? "rejected" : decision === "edited" ? "edited and accepted" : "accepted"}`,
    );
    const next = rows.findIndex((r, i) => i > focus && r.status === "pending");
    if (next >= 0) setFocus(next);
    router.refresh();
  }

  function saveEdit(row: ReviewRow) {
    let value: unknown;
    try {
      value = JSON.parse(draft);
    } catch {
      value = draft;
    }
    void decide(row, "edited", { edited: value });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("textarea, input, select, [role=dialog]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "j" || key === "arrowdown") {
      event.preventDefault();
      setFocus((i) => Math.min(rows.length - 1, i + 1));
    } else if (key === "k" || key === "arrowup") {
      event.preventDefault();
      setFocus((i) => Math.max(0, i - 1));
    } else if (focused && key === "a") {
      event.preventDefault();
      void decide(focused, "accepted");
    } else if (focused && key === "r") {
      event.preventDefault();
      void decide(focused, "rejected");
    } else if (focused && key === "e" && !focused.refresh && focused.status === "pending") {
      event.preventDefault();
      setEditing(focused.id);
      setDraft(focused.proposed);
    }
  }

  if (rows.length === 0)
    return (
      <p className="text-sm text-text-soft">
        No proposals yet for this cycle. Add a source and its proposals appear here.
      </p>
    );

  return (
    <div
      onKeyDown={onKeyDown}
      className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4"
    >
      <div className="sticky top-2 h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-plane border border-edge bg-depth">
        <SourcePane source={source} span={focused?.span ?? null} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm text-text-soft">
          <kbd className="font-mono">J</kbd>/<kbd className="font-mono">K</kbd> move ·{" "}
          <kbd className="font-mono">A</kbd> accept · <kbd className="font-mono">E</kbd> edit ·{" "}
          <kbd className="font-mono">R</kbd> reject
        </p>
        <p aria-live="polite" className="text-sm text-text-soft">
          {status}
        </p>
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="sr-only">Proposed pack fields, pending first</caption>
          <thead>
            <tr className="text-left text-text-soft">
              <th scope="col" className="border-b border-edge px-2 py-1 font-medium">
                Field
              </th>
              <th scope="col" className="border-b border-edge px-2 py-1 font-medium">
                Current → proposed
              </th>
              <th scope="col" className="border-b border-edge px-2 py-1 text-right font-medium">
                Confidence
              </th>
              <th scope="col" className="border-b border-edge px-2 py-1 font-medium">
                Decision
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isFocused = index === focus;
              const decided = row.status !== "pending";
              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={isFocused ? 0 : -1}
                  aria-selected={isFocused}
                  onFocus={() => setFocus(index)}
                  onClick={() => setFocus(index)}
                  className={cx(
                    "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal",
                    isFocused && "bg-veil",
                    decided && "text-text-soft",
                  )}
                >
                  <th
                    scope="row"
                    className="border-b border-edge px-2 py-2 text-left align-top font-mono text-sm font-normal"
                  >
                    {row.fieldPath}
                    {row.sourceTitle ? (
                      <span className="mt-1 block font-ui text-text-soft">
                        {row.sourceTitle} · trust {row.trust}
                      </span>
                    ) : null}
                  </th>
                  <td className="border-b border-edge px-2 py-2 align-top">
                    {row.refresh ? (
                      <div className="flex flex-col gap-1">
                        <StatusLabel tone="needs">Refresh check: the page changed</StatusLabel>
                        <p>{row.refresh.summary}</p>
                        <a
                          href={row.refresh.url}
                          className="text-signal underline"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {row.refresh.url}
                        </a>
                      </div>
                    ) : editing === row.id ? (
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-sm text-text-soft">
                            Your value (JSON, or plain text)
                          </span>
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={6}
                            autoFocus
                            className="rounded-control border border-control bg-depth p-2 font-mono text-sm text-text"
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(row)}
                            disabled={busy}
                          >
                            Accept my edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="quiet"
                            onClick={() => setEditing(null)}
                          >
                            Cancel the edit
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Diff
                        parts={wordDiff(
                          row.current,
                          row.status === "edited" && row.edited !== null
                            ? row.edited
                            : row.proposed,
                        )}
                      />
                    )}
                    {row.conflict ? (
                      <div className="mt-2 flex flex-col gap-1 border-l-2 border-needs pl-2">
                        <StatusLabel tone={row.conflict.blocking ? "risk" : "needs"}>
                          Conflict: {row.conflict.candidates.length} sources disagree
                        </StatusLabel>
                        <ul className="flex flex-col gap-0.5">
                          {row.conflict.candidates.map((candidate, i) => (
                            <li key={i}>
                              <span className="text-text-soft">
                                {candidate.label}
                                {candidate.sourceType
                                  ? `, ${candidate.sourceType.replaceAll("_", " ")}`
                                  : ""}
                                {candidate.trust ? `, trust ${candidate.trust}` : ", trust unknown"}
                                :
                              </span>{" "}
                              <span className="whitespace-pre-wrap">
                                {candidate.value || "empty"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-text-soft">
                          {row.conflict.blocking
                            ? "No official source decides it. The field stays unchanged until you choose."
                            : `Official wins by default: ${row.conflict.defaultLabel ?? "the official value"}.`}
                        </p>
                      </div>
                    ) : null}
                    {row.quote ? (
                      <p className="mt-1 text-text-soft">
                        Source passage:{" "}
                        <q>{row.quote.length > 240 ? `${row.quote.slice(0, 240)}…` : row.quote}</q>
                      </p>
                    ) : null}
                    {error?.id === row.id ? (
                      <div aria-live="assertive" className="mt-2 flex flex-col gap-1">
                        <FieldError>{error.message}</FieldError>
                        {error.outranked ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => decide(row, "accepted", { override: true })}
                          >
                            Use this value anyway
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-edge px-2 py-2 text-right align-top">
                    {Math.round(row.confidence * 100)}%
                  </td>
                  <td className="border-b border-edge px-2 py-2 align-top">
                    {decided ? (
                      <StatusLabel tone={row.status === "rejected" ? "neutral" : "verified"}>
                        {row.status === "rejected"
                          ? "Rejected"
                          : row.status === "edited"
                            ? "Edited"
                            : "Accepted"}
                      </StatusLabel>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          aria-label={`${row.refresh ? "Mark reviewed" : "Accept"} ${row.fieldPath}`}
                          onClick={() => decide(row, "accepted")}
                        >
                          {row.refresh ? "Mark reviewed" : "Accept"}
                        </Button>
                        {row.refresh ? null : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setFocus(index);
                              setEditing(row.id);
                              setDraft(row.proposed);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          aria-label={`${row.refresh ? "Dismiss" : "Reject"} ${row.fieldPath}`}
                          onClick={() => decide(row, "rejected")}
                        >
                          {row.refresh ? "Dismiss" : "Reject"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
