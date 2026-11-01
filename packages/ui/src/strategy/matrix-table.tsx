// The comparison table (spec §5.5 list review, §6.8 MatrixTable, §6.10 screen E): schools as
// columns, criteria as rows in named groups. Not cards (§5.5).
//
// The rules it keeps: numbers are right-aligned in tabular figures with their unit beside them;
// every school figure has a numbered source mark, and the numbered sources are listed under the
// table (the Apple compare pattern, docs/design/phase-3-4-direction.md); "above / near / below
// median" is a word, never a coloured cell; a figure that arrives without a source is not shown.
// The first column stays put while the table scrolls sideways inside its own focusable region.
//
// Server-safe: CitationMark is the only client leaf. The Tracker and Admin reuse it; Admin's
// internal numbers are text cells with `align: "end"`, since they are not school facts.

import { cx } from "../lib/cx";
import { citationText } from "./citation";
import { CitationMark } from "./citation-mark";
import {
  MEDIAN_WORDS,
  cellCitation,
  collectFootnotes,
  formatFigure,
  isUncitedFigure,
  type Footnotes,
} from "./matrix";
import type { MatrixCell, MatrixColumn, MatrixGroup } from "./types";

export interface MatrixTableProps {
  /** Names the table: "Your schools side by side". */
  caption: string;
  /** Keep the caption for screen readers only, when a visible heading already says it. */
  captionHidden?: boolean;
  columns: readonly MatrixColumn[];
  groups: readonly MatrixGroup[];
  /** The first column's heading. Default "Criterion". */
  rowHeader?: string;
  /** Prefix for the caption and footnote ids. Defaults to one made from the caption. */
  id?: string;
  /** Number and date formatting. Default "en-US" for figures, "en-GB" for dates. */
  locale?: string;
  className?: string;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "matrix"
  );
}

export function MatrixTable({
  caption,
  captionHidden = false,
  columns,
  groups,
  rowHeader = "Criterion",
  id,
  locale,
  className,
}: MatrixTableProps) {
  const prefix = id ?? slug(caption);
  const captionId = `${prefix}-caption`;
  const footnoteId = (n: number) => `${prefix}-source-${n}`;
  const columnIds = columns.map((column) => column.id);
  const footnotes = collectFootnotes(groups, columnIds);
  const span = columns.length + 1;

  return (
    <figure className={cx("flex min-w-0 flex-col gap-4", className)}>
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="min-w-0 overflow-x-auto rounded-control"
      >
        <table className="w-full min-w-max border-collapse text-left">
          <caption
            id={captionId}
            className={cx(captionHidden ? "sr-only" : "pb-3 text-left text-lg font-semibold")}
          >
            {caption}
          </caption>
          <thead>
            <tr className="border-b border-edge">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-depth py-3 pr-6 align-bottom text-sm font-medium text-text-soft"
              >
                {rowHeader}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  data-column={column.id}
                  className="min-w-36 px-4 py-3 align-bottom font-semibold text-text"
                >
                  <span className="block">{column.label}</span>{" "}
                  {column.meta ? (
                    <span className="block text-sm font-normal text-text-soft">{column.meta}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id} data-group={group.id}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={span}
                  className="pb-2 pt-6 text-left text-base font-semibold text-text"
                >
                  {/* Sticky so the group's name stays in view while the columns scroll. */}
                  <span className="sticky left-0">{group.label}</span>
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-edge">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-depth py-3 pr-6 align-top font-normal text-text"
                  >
                    <span className="block">{row.label}</span>{" "}
                    {row.hint ? (
                      <span className="block text-sm tabular-nums text-text-soft">{row.hint}</span>
                    ) : null}
                  </th>
                  {columns.map((column) => (
                    <Cell
                      key={column.id}
                      cell={row.cells[column.id]}
                      footnotes={footnotes}
                      footnoteId={footnoteId}
                      locale={locale}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {footnotes.list.length > 0 ? (
        <figcaption>
          <h3 className="sr-only">Sources</h3>
          <ol className="flex flex-col gap-1 text-sm text-text-soft">
            {footnotes.list.map((citation, index) => (
              <li key={footnoteId(index + 1)} id={footnoteId(index + 1)} className="flex gap-2">
                <span className="w-5 shrink-0 text-right tabular-nums">{index + 1}</span>
                <span>
                  {citationText(citation, locale)}
                  {citation.url ? (
                    <>
                      {" "}
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-control text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
                      >
                        Official page
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Alias: the spec's list review calls it the comparison table (§5.5). */
export const ComparisonTable = MatrixTable;
export type ComparisonTableProps = MatrixTableProps;

interface CellProps {
  cell: MatrixCell | undefined;
  footnotes: Footnotes;
  footnoteId: (n: number) => string;
  locale?: string;
}

function Cell({ cell, footnotes, footnoteId, locale }: CellProps) {
  const base = "px-4 py-3 align-top";
  if (!cell || cell.kind === "empty") {
    return (
      <td data-kind="empty" className={cx(base, "text-sm text-text-soft")}>
        {cell?.reason ?? "Not published"}
      </td>
    );
  }
  if (isUncitedFigure(cell)) {
    return (
      <td data-kind="uncited" className={cx(base, "text-right text-sm text-text-soft")}>
        Not shown: no source
      </td>
    );
  }
  const citation = cellCitation(cell);
  const mark = citation ? (
    <CitationMark
      citation={citation}
      index={footnotes.numberOf(citation)}
      footnoteId={footnoteId(footnotes.numberOf(citation))}
      locale={locale}
    />
  ) : null;

  switch (cell.kind) {
    case "number":
      return (
        <td data-kind="number" className={cx(base, "whitespace-nowrap text-right")}>
          <span className="tabular-nums text-text">{formatFigure(cell, locale)}</span>
          {cell.unit ? <span className="text-sm text-text-soft"> {cell.unit}</span> : null}
          {mark}
        </td>
      );
    case "median":
      return (
        <td data-kind="median" data-standing={cell.standing} className={base}>
          <span className="block text-text">
            {MEDIAN_WORDS[cell.standing]}
            {cell.median === undefined ? mark : null}
          </span>
          {cell.median !== undefined ? (
            <span className="block whitespace-nowrap text-sm tabular-nums text-text-soft">
              Median {formatFigure({ value: cell.median, digits: cell.digits }, locale)}
              {mark}
            </span>
          ) : null}
        </td>
      );
    case "text":
      return (
        <td
          data-kind="text"
          className={cx(base, cell.align === "end" ? "text-right tabular-nums" : "text-text")}
        >
          {cell.text}
          {mark}
        </td>
      );
  }
}
