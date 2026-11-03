// Metrics for the consistency check (spec §5.10): the same metric stated with different values
// ("cut onboarding time by 30%" and "by 35%", "$1.2M" and "$1.4M", "40+ hospitals" and "45
// hospitals"). A number is keyed by its family (money, percent, count), the word it counts and
// the content words around it; years belong to the date check and head counts to the team check.

import { extractQuantities } from "../quantities";
import { APPROX_SHARE } from "./team";
import {
  contentWords,
  isStopword,
  jaccard,
  parseCount,
  sentences,
  sharedCount,
  stem,
  tokens,
} from "./text";

export type NumberFamily = "money" | "percent" | "count";
export type NumberBound = "exact" | "approx" | "atLeast" | "atMost" | "range";

export interface NumberMention {
  family: NumberFamily;
  value: number;
  high: number | null;
  bound: NumberBound;
  timeUnit: boolean;
  /** The counted word ("hospital" in "40+ hospitals"); null for money, percent and bare counts. */
  head: string | null;
  /** Written with a scale word ("11 million", "70 crore"): never the same count as a bare "6". */
  scaled: boolean;
  /** Stemmed content words within six words either side, in the same sentence. */
  context: Set<string>;
  /** The same across the whole sentence, for matching a document against a fact's few words. */
  wide: Set<string>;
  /** The same within three words: which of two numbers in one sentence is which. */
  local: Set<string>;
  /** Position among this sentence's numbers of the same family. */
  ordinal: number;
  /** The other end of "from 58% to 81%", which identifies a change even when the words differ. */
  partner: { value: number; high: number | null; bound: NumberBound } | null;
  role: "from" | "to" | null;
  said: string;
  index: number;
}

const WINDOW = 6;
const LOCAL = 3;
const APPROX = /\b(?:about|around|roughly|nearly|almost|approximately|some|close\s+to|~)\s*$/iu;
const AT_MOST = /\b(?:under|below|less\s+than|fewer\s+than|just\s+under|up\s+to)\s*$/iu;

/** The stemmed content words nearest a span: `size` on each side, stopwords and numbers skipped. */
const SCALE_WORD = /^(?:k|thousand|m|mm|mn|million|bn|b|billion|lakhs?|crores?)$/iu;

function window(text: string, start: number, end: number, size: number): Set<string> {
  const words = tokens(text)
    .filter((t) => !SCALE_WORD.test(t.text))
    .flatMap((t) =>
      contentWords(t.text).map((w) => ({ w, index: t.index, end: t.index + t.text.length })),
    );
  const left = words.filter((t) => t.end <= start).slice(-size);
  const right = words.filter((t) => t.index >= end).slice(0, size);
  return new Set([...left, ...right].map((t) => t.w));
}

/** The clause around a span: commas, semicolons, colons and brackets bound it ("1,400" does not). */
function clauseAround(
  sentence: string,
  start: number,
  end: number,
): { text: string; start: number } {
  const breaks = [...sentence.matchAll(/[;:]\s|,\s|[()]|\s[—–]\s/gu)].map((m) => ({
    s: m.index,
    e: m.index + m[0].length,
  }));
  const from = Math.max(0, ...breaks.filter((b) => b.e <= start).map((b) => b.e));
  const to = Math.min(sentence.length, ...breaks.filter((b) => b.s >= end).map((b) => b.s));
  return { text: sentence.slice(from, to), start: from };
}

const INSTEAD =
  /^\s*(?:[\p{L}]+\s+)?(?:instead\s+of|against|down\s+from|up\s+from|compared\s+with|versus|vs\.?)\s+(?:about\s+|around\s+|roughly\s+|nearly\s+|almost\s+|over\s+|under\s+)?$/iu;
const FROM = /\bfrom\s+(?:about\s+|around\s+|roughly\s+|nearly\s+|almost\s+|over\s+|under\s+)?$/iu;
const TO =
  /^\s*(?:[\p{L}]+\s+)?(?:down\s+|up\s+)?to\s+(?:about\s+|around\s+|roughly\s+|nearly\s+|almost\s+|over\s+|under\s+|just\s+under\s+)?$/iu;

/** The canonical value of the first number in a text: "thirteen-person" → 13, "$1.2M" → 1200000. */
export function readNumber(text: string): { family: NumberFamily; value: number } | null {
  const q = extractQuantities(text).find((x) => x.kind !== "year");
  if (!q) return null;
  return { family: familyOf(q.kind), value: q.value };
}

function familyOf(kind: string): NumberFamily {
  return kind === "money" ? "money" : kind === "percent" ? "percent" : "count";
}

/**
 * The metrics in a text (with dates and team sizes already masked out). `extra` adds context
 * words to every number, e.g. a fact's key ("gmat_total" → "gmat").
 */
/** A quantity as read, before it becomes a mention. */
interface Raw {
  kind: string;
  value: number;
  high: number | null;
  timeUnit: boolean;
  text: string;
  index: number;
  role: "from" | "to" | null;
}

const BARE_WORD =
  /(?<![\p{L}\d-])(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?(?=\s+[\p{L}])/giu;
const TIME_AFTER = /^[\s-]*(?:years?|yrs?|months?|weeks?|days?|hours?|hrs?|minutes?|mins?)\b/iu;

/**
 * Quantities in a sentence: extractQuantities' reading, with "from 700 to 730" taken as two
 * numbers (a change, not a range) and a number word before a noun ("twelve students") added.
 */
function quantities(sentence: string): Raw[] {
  const out: Raw[] = [];
  for (const q of extractQuantities(sentence)) {
    if (q.kind === "year") continue;
    const pair = /^(.+?)\s*(?:-|–|—|to)\s*(.+)$/u.exec(q.text);
    if (q.kind === "range" && pair && /\bfrom\s+$/iu.test(sentence.slice(0, q.index))) {
      const [, a = "", b = ""] = pair;
      const bAt = q.index + q.text.lastIndexOf(b);
      out.push({
        kind: "number",
        value: q.value,
        high: null,
        timeUnit: q.timeUnit,
        text: a,
        index: q.index,
        role: "from",
      });
      out.push({
        kind: "number",
        value: q.high ?? q.value,
        high: null,
        timeUnit: q.timeUnit,
        text: b,
        index: bAt,
        role: "to",
      });
      continue;
    }
    out.push({
      kind: q.kind,
      value: q.value,
      high: q.high ?? null,
      timeUnit: q.timeUnit,
      text: q.text,
      index: q.index,
      role: null,
    });
  }
  for (const m of sentence.matchAll(BARE_WORD)) {
    const end = m.index + m[0].length;
    if (out.some((q) => m.index < q.index + q.text.length && end > q.index)) continue;
    const next = /^\s+([\p{L}][\p{L}'’-]*)/u.exec(sentence.slice(end))?.[1] ?? "";
    const value = parseCount(m[0]);
    if (value === null || isStopword(next)) continue;
    out.push({
      kind: "number",
      value,
      high: null,
      timeUnit: TIME_AFTER.test(sentence.slice(end)),
      text: m[0],
      index: m.index,
      role: null,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function findNumbers(text: string, extra: readonly string[] = []): NumberMention[] {
  const out: NumberMention[] = [];
  for (const s of sentences(text)) {
    const sentence = text.slice(s.start, s.end);
    const counts = new Map<NumberFamily, number>();
    const here: { m: NumberMention; start: number; end: number; role: Raw["role"] }[] = [];
    for (const q of quantities(sentence)) {
      const family = familyOf(q.kind);
      const start = q.index;
      const end = q.index + q.text.length;
      const before = sentence.slice(Math.max(0, start - 24), start);
      const bound: NumberBound =
        q.kind === "atLeast"
          ? "atLeast"
          : q.kind === "range"
            ? "range"
            : APPROX.test(before)
              ? "approx"
              : AT_MOST.test(before)
                ? "atMost"
                : "exact";
      const next = /^[\s-]*([\p{L}][\p{L}'’]*)/u.exec(sentence.slice(end))?.[1];
      const head =
        family === "count" && next && !isStopword(next) && !/^(?:percent|per)$/iu.test(next)
          ? stem(next)
          : null;
      const ordinal = counts.get(family) ?? 0;
      counts.set(family, ordinal + 1);
      const clause = clauseAround(sentence, start, end);
      const context = window(clause.text, start - clause.start, end - clause.start, WINDOW);
      const wide = window(sentence, start, end, WINDOW);
      for (const w of extra) {
        context.add(w);
        wide.add(w);
      }
      const m: NumberMention = {
        family,
        value: q.value,
        high: q.high,
        bound,
        timeUnit: q.timeUnit,
        head,
        scaled: /\d\s?(?:k|thousand|mm|mn|m|million|bn|b|billion|lakhs?|crores?)\b/iu.test(q.text),
        context,
        wide,
        local: window(clause.text, start - clause.start, end - clause.start, LOCAL),
        ordinal,
        partner: null,
        role: null,
        said: q.text,
        index: s.start + start,
      };
      here.push({ m, start, end, role: q.role });
    }
    // "from 58% to 81%": each end knows the other.
    for (let i = 0; i + 1 < here.length; i += 1) {
      const a = here[i];
      const b = here[i + 1];
      if (!a || !b || a.m.family !== b.m.family) continue;
      const paired =
        (a.role === "from" && b.role === "to") ||
        (FROM.test(sentence.slice(0, a.start)) && TO.test(sentence.slice(a.end, b.start)));
      // "25 minutes instead of about 40", "9% against 31%": the new figure comes first.
      const reversed = !paired && INSTEAD.test(sentence.slice(a.end, b.start));
      if (!paired && !reversed) continue;
      const [from, to] = paired ? [a, b] : [b, a];
      from.m.partner = { value: to.m.value, high: to.m.high, bound: to.m.bound };
      from.m.role = "from";
      to.m.partner = { value: from.m.value, high: from.m.high, bound: from.m.bound };
      to.m.role = "to";
    }
    out.push(...here.map((h) => h.m));
  }
  return out;
}

type Amount = Pick<NumberMention, "value" | "high" | "bound">;

export function sameNumber(a: Amount, b: Amount): boolean {
  const eq = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  if (a.bound === "range" || b.bound === "range") {
    const [r, o] = a.bound === "range" ? [a, b] : [b, a];
    const hi = r.high ?? r.value;
    if (o.bound === "range") return eq(r.value, o.value) && eq(hi, o.high ?? o.value);
    return o.value >= r.value && o.value <= hi;
  }
  if (a.bound === "approx" || b.bound === "approx")
    return (
      Math.abs(a.value - b.value) <= APPROX_SHARE * Math.max(Math.abs(a.value), Math.abs(b.value))
    );
  if (a.bound === b.bound) return eq(a.value, b.value);
  if (a.bound === "exact" || b.bound === "exact") {
    const [x, o] = a.bound === "exact" ? [b, a] : [a, b];
    const slack = Math.max(1, Math.abs(x.value) * 0.1);
    if (x.bound === "atLeast") return o.value >= x.value && o.value < x.value + slack;
    return o.value <= x.value && o.value > x.value - slack;
  }
  return eq(a.value, b.value);
}

/**
 * Whether two numbers are the same metric: same family and unit, and the words around them agree
 * (Jaccard ≥ 0.5, or two shared words beyond the unit). Against a fact, most of the fact's few
 * words must appear around the document's number.
 */
export function sameMetric(a: NumberMention, b: NumberMention, bIsFact: boolean): boolean {
  if (a.family !== b.family || a.timeUnit !== b.timeUnit) return false;
  const j = jaccard(a.context, b.context);
  // The same change from the same starting point: "from 58% to 81%" and "from 58% to 84%".
  if (a.partner && b.partner && a.role === b.role && sameNumber(a.partner, b.partner))
    return sharedCount(a.context, b.context) >= 1;
  if (a.family === "count") {
    if (a.scaled !== b.scaled) return false;
    if (a.head !== null && b.head !== null && a.head !== b.head) return false;
    if ((a.head === null) !== (b.head === null) && j < 0.6) return false;
  }
  const shared = sharedCount(a.context, b.context);
  const beyondHead =
    shared - (a.head !== null && a.head === b.head && a.context.has(a.head) ? 1 : 0);
  if (a.timeUnit) return j >= 0.6;
  if (bIsFact) {
    const size = b.context.size;
    const inWide = sharedCount(b.context, a.wide);
    if (size === 0) return false;
    if (size <= 2) return inWide === size;
    return inWide >= 2 && inWide / size >= 0.5;
  }
  return j >= 0.5 || (beyondHead >= 2 && j >= 0.3);
}

/** How alike two numbers' immediate surroundings are, for choosing which one a number restates. */
export function closeness(a: NumberMention, b: NumberMention): number {
  return (
    jaccard(a.local, b.local) +
    (a.ordinal === b.ordinal ? 0.25 : 0) +
    jaccard(a.context, b.context) * 0.5
  );
}
