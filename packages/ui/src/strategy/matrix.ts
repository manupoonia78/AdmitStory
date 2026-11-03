// The comparison table's rules as pure functions (spec §5.5): how a figure is typeset, what a
// median standing says in words, and how citations become numbered footnotes. Server-safe.

import { citationKey, isCitation } from "./citation";
import type { Citation, MatrixCell, MatrixGroup, MedianStanding, NumberCell } from "./types";

/** The standing in words, never colour alone (spec §5.5: no admission odds). */
export const MEDIAN_WORDS: Record<MedianStanding, string> = {
  above: "Above median",
  near: "Near median",
  below: "Below median",
  unknown: "No comparison yet",
};

/** "715", "3.52", "18%", "$165,000". The unit, if any, is drawn beside it, not inside. */
export function formatFigure(
  cell: Pick<NumberCell, "value" | "style" | "currency" | "digits">,
  locale = "en-US",
): string {
  const digits = cell.digits ?? 0;
  if (cell.style === "percent") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(cell.value / 100);
  }
  if (cell.style === "currency" && cell.currency) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cell.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(cell.value);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cell.value);
}

/** The citation a cell carries, if it is a usable one. */
export function cellCitation(cell: MatrixCell | undefined): Citation | null {
  if (!cell || cell.kind === "empty") return null;
  const citation = (cell as { citation?: unknown }).citation;
  return isCitation(citation) ? citation : null;
}

/**
 * A number or a median with no usable citation. The types forbid it, but pack data can arrive
 * untyped, and a school figure without its source is not shown (spec §0, §5.5 AC).
 */
export function isUncitedFigure(cell: MatrixCell | undefined): boolean {
  if (!cell || (cell.kind !== "number" && cell.kind !== "median")) return false;
  return cellCitation(cell) === null;
}

export interface Footnotes {
  /** Sources in the order they first appear, reading row by row. */
  list: Citation[];
  /** The 1-based footnote number of a citation. */
  numberOf: (citation: Citation) => number;
}

/** Numbers every distinct citation in the table once, in reading order (row by row). */
export function collectFootnotes(
  groups: readonly MatrixGroup[],
  columnIds: readonly string[],
): Footnotes {
  const order = new Map<string, number>();
  const list: Citation[] = [];
  for (const group of groups) {
    for (const row of group.rows) {
      for (const id of columnIds) {
        const cell = row.cells[id];
        const citation = isUncitedFigure(cell) ? null : cellCitation(cell);
        if (!citation) continue;
        const key = citationKey(citation);
        if (order.has(key)) continue;
        list.push(citation);
        order.set(key, list.length);
      }
    }
  }
  return { list, numberOf: (citation) => order.get(citationKey(citation)) ?? 0 };
}
