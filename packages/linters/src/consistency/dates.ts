// Dates in résumé fields and prose, for the consistency check (spec §5.10): "Apr 2024 – Present",
// "since April 2024", "July 2020 to March 2024", "2021–2024", "in 2023". Month names and
// abbreviations, "Present/now/current", en and em dashes and "to" all normalise to one shape.

import { fold } from "./text";

export interface YearMonth {
  y: number;
  /** 1–12, or null when only the year is given. */
  m: number | null;
}

export type DateValue = YearMonth | "present";

export interface DatePart {
  value: DateValue;
  /** As written: "Apr 2024", "Present". */
  text: string;
  index: number;
}

export interface DateExpr {
  /** A range has both ends; "since" an open start; a point is a bare date ("in 2023"). */
  kind: "range" | "since" | "point";
  from: DatePart & { value: YearMonth };
  to: DatePart | null;
  index: number;
  end: number;
  text: string;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** "Apr", "April", "apr." and "Sept" → 4, 4, 4, 9; anything else → null. */
export function normaliseMonth(word: string): number | null {
  return MONTHS[fold(word.trim()).replace(/\.$/u, "")] ?? null;
}

const MONTH = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const YEAR = "(?:19[5-9]\\d|20[0-4]\\d)";
const LEFT = "(?<![\\p{L}\\d$€£₹.,/-])";
const RIGHT = "(?![\\p{L}\\d]|,\\d|\\.\\d|\\s?%)";
const DATE = `(?:(?:${MONTH})\\.?,?\\s+(?:of\\s+)?${YEAR}|(?:0?[1-9]|1[0-2])\\/${YEAR}|${YEAR})${RIGHT}`;
const PRESENT = "(?:the\\s+)?(?:present|now|today|current|date)\\b";

const PATTERNS: { kind: DateExpr["kind"]; re: RegExp }[] = [
  { kind: "range", re: new RegExp(`\\bbetween\\s+(${DATE})\\s+and\\s+(${DATE})`, "giu") },
  {
    kind: "range",
    re: new RegExp(
      `(?:\\bfrom\\s+)?${LEFT}(${DATE})\\s*(?:–|—|-|\\bto\\b|\\buntil\\b|\\btill\\b|\\bthrough\\b)\\s*(${DATE}|${PRESENT})`,
      "giu",
    ),
  },
  {
    kind: "since",
    re: new RegExp(`\\b(?:since|starting(?:\\s+in)?|from)\\s+(${DATE})`, "giu"),
  },
  { kind: "point", re: new RegExp(`${LEFT}(${DATE})`, "giu") },
];

function parseDate(raw: string): YearMonth | null {
  const named = /^([\p{L}]+)\.?,?\s+(?:of\s+)?(\d{4})$/u.exec(raw.trim());
  if (named) {
    const m = normaliseMonth(named[1] ?? "");
    return m === null ? null : { y: Number(named[2]), m };
  }
  const numeric = /^(\d{1,2})\/(\d{4})$/u.exec(raw.trim());
  if (numeric) return { y: Number(numeric[2]), m: Number(numeric[1]) };
  return /^\d{4}$/u.test(raw.trim()) ? { y: Number(raw.trim()), m: null } : null;
}

function part(raw: string, index: number): DatePart | null {
  const text = raw.trim();
  if (/^(?:the\s+)?(?:present|now|today|current|date)$/iu.test(text))
    return { value: "present", text, index };
  const value = parseDate(text);
  return value ? { value, text, index } : null;
}

/** Every date expression in the text, earliest first; a range claims its span before its ends do. */
export function findDates(text: string): DateExpr[] {
  const found: DateExpr[] = [];
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => taken.every(([a, b]) => e <= a || s >= b);
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!free(start, end)) continue;
      const first = m[1] ?? "";
      const second = m[2];
      const fromAt = start + m[0].indexOf(first);
      const from = part(first, fromAt);
      if (!from || from.value === "present") continue;
      const to =
        second === undefined ? null : part(second, start + m[0].lastIndexOf(second.trim()));
      if (second !== undefined && !to) continue;
      taken.push([start, end]);
      found.push({
        kind,
        from: { ...from, value: from.value },
        to,
        index: start,
        end,
        text: m[0],
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** The same date at the precision both sides give: "Apr 2024" equals "2024" and "April 2024". */
export function sameDate(a: DateValue, b: DateValue): boolean {
  if (a === "present" || b === "present") return a === b;
  if (a.y !== b.y) return false;
  return a.m === null || b.m === null || a.m === b.m;
}

/** Whether a point in time falls inside [start, end] at the precision given. */
export function within(point: YearMonth, start: YearMonth | null, end: DateValue | null): boolean {
  const before = (a: YearMonth, b: YearMonth) =>
    a.y < b.y || (a.y === b.y && a.m !== null && b.m !== null && a.m < b.m);
  if (start && before(point, start)) return false;
  if (end && end !== "present" && before(end, point)) return false;
  return true;
}

/** A normalised key: "2024-04", "2024" or "present". */
export function dateKey(value: DateValue): string {
  if (value === "present") return "present";
  return value.m === null ? String(value.y) : `${value.y}-${String(value.m).padStart(2, "0")}`;
}
