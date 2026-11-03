// Text helpers for the consistency check (spec §5.10, canon FORM-01): folding, light stemming,
// sentence and clause bounds, number words, excerpts and a stable hash. Pure and dependency-free.

import type { ConsistencyDocKind } from "./types";

/** Lowercase with diacritics removed: "Electrodomésticos" → "electrodomesticos". */
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

const STOPWORDS = new Set(
  (
    "a an the and or but nor of to in on at for from by with as into onto over under about around " +
    "than then that this these those it its is are was were be been being am do does did done have " +
    "has had having i me my mine we us our ours you your yours he him his she her hers they them " +
    "their theirs who whom whose which what when where why how there here so such not no yes all " +
    "any each every both either neither some most more less few many much own same other another " +
    "very just also only even still yet up down out off again once while after before since until " +
    "during per via if because though although whether can could will would shall should may might " +
    "must across through within without nearly almost roughly approximately around now later " +
    "against instead"
  ).split(" "),
);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(fold(word));
}

/** A light stem, enough that "loads", "loaded" and "loading" meet: never a dictionary form. */
export function stem(word: string): string {
  let w = fold(word)
    .replace(/['’]s$/u, "")
    .replace(/['’.]+$/u, "");
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && /(?:ss|x|ch|sh)es$/u.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

export interface Token {
  text: string;
  index: number;
}

/** Word tokens with their offsets; hyphenated words stay whole. */
export function tokens(text: string): Token[] {
  return [
    ...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’.-]*[\p{L}\p{M}\p{N}]|[\p{L}\p{N}]/gu),
  ].map((m) => ({ text: m[0], index: m.index }));
}

/** Stemmed content words: no stopwords, no numbers, hyphenated words split. */
export function contentWords(text: string): string[] {
  return tokens(text)
    .flatMap((t) => t.text.split(/[-.]/u))
    .filter((w) => w.length > 1 && !/\d/u.test(w) && !isStopword(w))
    .map(stem);
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function sharedCount(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared;
}

export interface Span {
  start: number;
  end: number;
}

/** Sentence bounds: a full stop, question or exclamation mark followed by a capital or digit. */
export function sentences(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?]+["”’)]?\s+(?=[\p{Lu}\d"“(])|\n+/gu)) {
    const end = m.index + m[0].length;
    if (m.index > start) spans.push({ start, end: m.index + 1 });
    start = end;
  }
  if (start < text.length) spans.push({ start, end: text.length });
  return spans;
}

/** Replace spans with spaces, keeping every other offset where it was. */
export function mask(text: string, spans: readonly Span[]): string {
  let out = text;
  for (const { start, end } of spans)
    out = out.slice(0, start) + " ".repeat(Math.max(0, end - start)) + out.slice(end);
  return out;
}

const SMALL: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  dozen: 12,
};

const WORDS = Object.keys(SMALL)
  .sort((a, b) => b.length - a.length)
  .join("|");

/** A head count as written: "13", "1,400", "thirteen", "twenty-two". */
export const COUNT = `(?:\\d{1,3}(?:,\\d{3})+|\\d+|(?:${WORDS})(?:-(?:one|two|three|four|five|six|seven|eight|nine))?)(?![\\p{L}\\d])`;

/** The value of a COUNT match, or null. */
export function parseCount(raw: string): number | null {
  const lower = fold(raw.trim());
  if (/^[\d,]+$/u.test(lower)) {
    const n = Number(lower.replace(/,/gu, ""));
    return Number.isFinite(n) ? n : null;
  }
  const [tens, ones] = lower.split("-");
  const t = tens === undefined ? undefined : SMALL[tens];
  if (t === undefined) return null;
  if (ones === undefined) return t;
  const o = SMALL[ones];
  return o === undefined || t < 20 || o > 9 ? null : t + o;
}

/** 32-bit FNV-1a as eight hex digits: stable across runs and platforms. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** About `width` characters of `text` around a match, cut at word bounds. */
export function excerpt(text: string, index: number, length: number, width = 80): string {
  const flat = text.replace(/\s+/gu, " ");
  if (flat.length <= width) return flat.trim();
  const pad = Math.max(0, Math.floor((width - length) / 2));
  let start = Math.max(0, index - pad);
  let end = Math.min(flat.length, start + width);
  start = Math.max(0, end - width);
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < index) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > index + length) end = space;
  }
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/** "employer_current" → "Employer current"; GMAT and GPA stay capitals. */
export function humanizeKey(key: string): string {
  const words = key
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => (/^(?:gmat|gpa|gre|ea|ielts)$/iu.test(w) ? w.toUpperCase() : w.toLowerCase()));
  const first = words[0] ?? "";
  return [first.charAt(0).toUpperCase() + first.slice(1), ...words.slice(1)].join(" ");
}

/** Where a value lives, as the finding row and its explanation name it. */
export interface Place {
  docId: string;
  docKind: ConsistencyDocKind | "fact_sheet";
  docLabel: string;
  ref: string;
  text: string;
}

export const FACT_SHEET = "fact_sheet";

/** One occurrence of a compared value. `key` is its normalised form, for ids and grouping. */
export interface Hit {
  place: Place;
  said: string;
  index: number;
  key: string;
}
