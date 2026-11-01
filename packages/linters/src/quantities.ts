// Fact-like quantities in prose, for factMismatch (§8.7 "Fact consistency"). Extracts numbers in
// the forms drafts actually use and reduces each to a canonical value, so "$1.2M", "$1,200,000"
// and "1.2 million dollars" compare equal, "50+" equals "more than 50", and "13-person" is 13.

export type QuantityKind = "money" | "percent" | "range" | "atLeast" | "year" | "number";

export interface Quantity {
  kind: QuantityKind;
  /** Canonical value; for a range, the low end. */
  value: number;
  /** High end of a range. */
  high?: number;
  /** A time unit right after the number ("9 years"), which never compares with a head count. */
  timeUnit: boolean;
  text: string;
  index: number;
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

const SCALE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  mn: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  lakh: 1e5,
  lakhs: 1e5,
  crore: 1e7,
  crores: 1e7,
};

const NUM = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?";
// Longest first, and never followed by a letter, so "seventeen" is 17 and "sixty" is 60, not 7 and 6.
const WORD_NUM = Object.keys(SMALL)
  .sort((a, b) => b.length - a.length)
  .join("|");
const N = `(?:${NUM}|(?:${WORD_NUM})(?![\\p{L}]))`;
const SCALE_WORDS = "k|thousand|mm|mn|m|million|bn|b|billion|lakhs?|crores?";
const TIME_UNIT = /^[\s-]*(?:years?|yrs?|months?|weeks?|days?|hours?|hrs?|minutes?|mins?)\b/i;

// Order matters: earlier patterns claim their span first.
const PATTERNS: { kind: QuantityKind; re: RegExp }[] = [
  {
    kind: "money",
    re: new RegExp(`[$€£₹¥]\\s?(${NUM})(?:\\s?(${SCALE_WORDS}))?(?![\\p{L}])`, "giu"),
  },
  {
    kind: "money",
    re: new RegExp(
      `(?<![\\p{L}\\d])(${NUM})\\s?(${SCALE_WORDS})?\\s+(?:dollars|euros|pounds|rupees|usd|eur|gbp|inr)\\b`,
      "giu",
    ),
  },
  {
    kind: "percent",
    re: new RegExp(`(?<![\\p{L}\\d])(${N})\\s?(?:%|percent\\b|per\\s+cent\\b)`, "giu"),
  },
  {
    kind: "range",
    re: new RegExp(`(?<![\\p{L}])between\\s+(${N})\\s+and\\s+(${N})(?![\\d])`, "giu"),
  },
  {
    kind: "range",
    re: new RegExp(`(?<![\\p{L}\\d])(${N})\\s?(?:-|–|—|to)\\s?(${N})(?![\\d]|-[\\p{L}])`, "giu"),
  },
  {
    kind: "atLeast",
    re: new RegExp(
      `(?<![\\p{L}\\d])(${N})\\s?\\+|(?:more\\s+than|over|at\\s+least)\\s+(${N})(?![\\d])|(?<![\\p{L}\\d])(${N})\\s+or\\s+more\\b`,
      "giu",
    ),
  },
  { kind: "year", re: /(?<![\p{L}\d,.$])((?:19|20)\d{2})(?!\d|,\d{3}|\.\d)/gu },
  {
    // Digits anywhere; a number word only in a compound ("thirteen-person"), because bare words
    // ("one of my engineers", "two weeks later") are connective prose far more often than facts.
    kind: "number",
    re: new RegExp(
      `(?<![\\p{L}\\d])(?:(${NUM})(?:\\s?(${SCALE_WORDS}))?(?![\\p{L}\\d])|(${WORD_NUM})(?=-\\p{L}))`,
      "giu",
    ),
  },
];

function parseNumber(raw: string): number {
  const lower = raw.toLowerCase();
  if (lower in SMALL) return SMALL[lower] ?? NaN;
  return Number(raw.replace(/,/g, ""));
}

function scaled(raw: string, scale: string | undefined): number {
  const n = parseNumber(raw);
  return scale ? n * (SCALE[scale.toLowerCase()] ?? 1) : n;
}

export function extractQuantities(text: string): Quantity[] {
  const found: Quantity[] = [];
  const taken: [number, number][] = [];
  const free = (start: number, end: number) => taken.every(([s, e]) => end <= s || start >= e);
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!free(start, end)) continue;
      const groups = m.slice(1).filter((g): g is string => g !== undefined);
      let q: Omit<Quantity, "timeUnit" | "text" | "index"> | null = null;
      if (kind === "money") q = { kind, value: scaled(groups[0] ?? "", groups[1]) };
      else if (kind === "range") {
        const low = parseNumber(groups[0] ?? "");
        const high = parseNumber(groups[1] ?? "");
        // "one to one meetings" and "5-3" are not ranges.
        if (!(high > low)) continue;
        q = { kind, value: low, high };
      } else if (kind === "number") q = { kind, value: scaled(groups[0] ?? "", groups[1]) };
      else q = { kind, value: parseNumber(groups[0] ?? "") };
      if (!Number.isFinite(q.value)) continue;
      taken.push([start, end]);
      found.push({
        ...q,
        timeUnit: TIME_UNIT.test(text.slice(end)),
        text: m[0].trim(),
        index: start,
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Whether a draft quantity says the same thing as a fact quantity. */
export function sameQuantity(draft: Quantity, fact: Quantity): boolean {
  if (draft.kind !== fact.kind) {
    // A year may be extracted as a plain number on one side, and "over 50" says the same as "50"
    // closely enough that flagging it would be noise.
    const loose = (k: QuantityKind) => k === "number" || k === "year" || k === "atLeast";
    if (!(loose(draft.kind) && loose(fact.kind))) return false;
  }
  if (draft.kind === "range") return draft.value === fact.value && draft.high === fact.high;
  return Math.abs(draft.value - fact.value) < 1e-9;
}

/** Whether two quantities talk about the same sort of thing, so a difference is a conflict. */
export function comparable(draft: Quantity, fact: Quantity): boolean {
  if (draft.timeUnit !== fact.timeUnit) return false;
  const family = (k: QuantityKind) =>
    k === "money" ? "money" : k === "percent" ? "percent" : k === "year" ? "year" : "count";
  // A plain number in the fact ("2019" stored as a number) may be a year in the draft.
  if (draft.kind === "year" || fact.kind === "year") {
    const yearish = (q: Quantity) =>
      q.kind === "year" || (q.kind === "number" && q.value >= 1900 && q.value <= 2099);
    return yearish(draft) && yearish(fact);
  }
  return family(draft.kind) === family(fact.kind);
}
