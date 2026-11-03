// Citations as text (spec §5.5 AC: all numbers shown carry source + year). Pure and server-safe.

import { formatDate } from "./time-scale";
import type { Citation } from "./types";

/**
 * True when the value is a usable citation: a source and a year. The prop types already demand
 * one; this guards data that arrives untyped (JSON from the pack), so a figure without a source is
 * never shown as if it had one.
 */
export function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== "object") return false;
  const { source, year } = value as Partial<Citation>;
  const hasYear =
    (typeof year === "number" && Number.isFinite(year)) ||
    (typeof year === "string" && year.trim() !== "");
  return typeof source === "string" && source.trim() !== "" && hasYear;
}

/** "12 Sep 2026" from "2026-09-12". A calendar date, so it is formatted in UTC and never shifts. */
export function formatVerifiedOn(isoDate: string, locale = "en-GB"): string {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return formatDate(date, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Verified 12 Sep 2026" (spec §5.5: pack freshness). */
export function verifiedText(citation: Citation, locale = "en-GB"): string | null {
  return citation.verifiedOn ? `Verified ${formatVerifiedOn(citation.verifiedOn, locale)}` : null;
}

/** "Class profile, 2026. Verified 12 Sep 2026." */
export function citationText(citation: Citation, locale = "en-GB"): string {
  const verified = verifiedText(citation, locale);
  return `${citation.source}, ${citation.year}.${verified ? ` ${verified}.` : ""}`;
}

/** Same source, year, page and date: one footnote. */
export function citationKey(citation: Citation): string {
  return [citation.source, citation.year, citation.url ?? "", citation.verifiedOn ?? ""].join("|");
}
