// Team sizes for the consistency check (spec §5.10): "a team of 13", "a 13-person team", "led 13
// engineers", "a team of thirteen", "4 engineers I coordinate", "6 supervisors reporting to me".
// In a document a number counts only when the applicant leads those people; on the Fact Sheet every
// head count in a team fact counts, except where it was ("up from 6") or a part ("including 3").

import { COUNT, parseCount, stem } from "./text";

export const TEAM_KEY = /team|reports|headcount|people/iu;

export interface TeamClaim {
  value: number;
  bound: "exact" | "approx" | "atLeast";
  /** The number as written: "13", "thirteen". */
  said: string;
  index: number;
  /** The whole matched phrase, masked out before other numbers are read. */
  start: number;
  end: number;
  /** Stemmed noun ("engineer"), or null for "a team of 13". */
  noun: string | null;
  generic: boolean;
  /** "6 supervisors reporting to me", "6 direct reports". */
  report: boolean;
}

const NOUN =
  "(people|persons?|staff(?:ers)?|employees?|engineers?|developers?|analysts?|consultants?|associates?|reports|supervisors?|managers?|officers?|soldiers?|nurses?|teachers?|mentors?|volunteers?|members?|workers?|operators?|technicians?|riders?|founders?|apprentices?|personnel|agents?|specialists?|designers?|coordinators?|planners?|buyers?|drivers?|tutors?|sailors?|troops?)";
const ADJ = "(?:(?!(?:of|the|and|in|at|on|to|for|with|from|who|that)\\b)[\\p{L}-]+\\s+){0,2}?";
const APPROX =
  "(?:(about|around|roughly|nearly|almost|approximately|some|over|more\\s+than|at\\s+least)\\s+)?";
const N = `(${COUNT})(\\+)?`;
const LEAD =
  "(?:lead|leads|leading|led|manage|manages|managed|managing|run|runs|ran|running|coordinate|coordinates|coordinated|coordinating|oversee|oversees|oversaw|overseeing|supervise|supervises|supervised|supervising|command|commands|commanded|commanding|head|heads|headed|heading|direct|directs|directed|directing|built|grew|hired)";
const GENERIC = new Set([
  "person",
  "people",
  "staff",
  "staffer",
  "employee",
  "member",
  "personnel",
  "worker",
]);

interface Pattern {
  re: RegExp;
  /** Group numbers: approx word, count, plus sign, noun. */
  groups: { approx: number | null; count: number; plus: number; noun: number | null };
  kind: "stated" | "container" | "count";
}

const PATTERNS: Pattern[] = [
  {
    // "the team was 15 people", "we were 11 people at the peak": the size stated outright.
    re: new RegExp(
      `\\b(?:(?:my|our|the)\\s+team\\s+(?:was|is|numbered|had\\s+grown\\s+to|grew\\s+to)|we\\s+were)\\s+${APPROX}${N}(?:\\s+${ADJ}${NOUN}\\b)?`,
      "giu",
    ),
    groups: { approx: 1, count: 2, plus: 3, noun: 4 },
    kind: "stated",
  },
  {
    re: new RegExp(
      `\\bteam\\s+(?:of|was|is|numbered|grew\\s+to)\\s+${APPROX}${N}(?:\\s+${ADJ}${NOUN}\\b)?`,
      "giu",
    ),
    groups: { approx: 1, count: 2, plus: 3, noun: 4 },
    kind: "container",
  },
  {
    re: new RegExp(
      `(?<![\\p{L}\\d])${N}[\\s-]+(?:person|people|member|strong|man|woman)\\s+(?:[\\p{L}-]+\\s+)?(?:team|crew|unit|department|squad|shift|group|company)\\b`,
      "giu",
    ),
    groups: { approx: null, count: 1, plus: 2, noun: null },
    kind: "container",
  },
  {
    re: new RegExp(
      `\\b(?:shift|crew|company|platoon|unit|department|squad|division)\\s+of\\s+${APPROX}${N}(?:\\s+${ADJ}${NOUN}\\b)?`,
      "giu",
    ),
    groups: { approx: 1, count: 2, plus: 3, noun: 4 },
    kind: "container",
  },
  {
    re: new RegExp(`(?<![\\p{L}\\d$€£₹.,])${APPROX}${N}\\s+${ADJ}${NOUN}\\b`, "giu"),
    groups: { approx: 1, count: 2, plus: 3, noun: 4 },
    kind: "count",
  },
];

const HISTORY = /\b(?:up\s+from|from|including|previously|originally|of\s+whom|out\s+of)\s+$/iu;
const MEMBERSHIP = /\b(?:on|in|onto|joined|part\s+of|member\s+of)\s+(?:a|an|the)\s+$/iu;
const LEAD_BEFORE = new RegExp(`\\b${LEAD}\\b`, "iu");
const LEAD_NEAR = new RegExp(`\\b${LEAD}\\b(?:\\s+[^\\s,;.]+){0,9}\\s+$`, "iu");
const REPORTING = new RegExp(
  `^\\s*(?:who\\s+|that\\s+)?(?:report(?:s|ing|ed)?\\s+(?:directly\\s+)?to\\s+(?:me|him|her)\\b|(?:that\\s+|whom\\s+)?(?:I|he|she)\\s+${LEAD}\\b)`,
  "iu",
);

function bound(word: string | undefined, plus: string | undefined): TeamClaim["bound"] {
  if (plus) return "atLeast";
  if (!word) return "exact";
  return /over|more|least/iu.test(word) ? "atLeast" : "approx";
}

/**
 * Team-size claims in a text. `fact` reads a Fact Sheet value: no leadership verb is needed, and a
 * bare number opening the value ("11 at the peak") is the team's size.
 */
export function findTeamClaims(text: string, fact = false): TeamClaim[] {
  const found: TeamClaim[] = [];
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => taken.every(([a, b]) => e <= a || s >= b);
  for (const { re, groups, kind } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!free(start, end)) continue;
      const raw = m[groups.count] ?? "";
      const value = parseCount(raw);
      if (value === null || value === 0) continue;
      const index = start + m[0].indexOf(raw);
      const before = text.slice(0, index);
      if (HISTORY.test(before)) continue;
      const nounRaw = groups.noun === null ? undefined : m[groups.noun];
      const noun = nounRaw ? stem(nounRaw) : null;
      const after = text.slice(end);
      const report = noun === "report" || /^\s*(?:who\s+|that\s+)?report/iu.test(after);
      if (!fact) {
        const sentence = before.slice(Math.max(0, before.search(/[^.!?]*$/u)));
        if (kind === "stated") {
          if (!/\b(?:I|me|my|we|our)\b/iu.test(sentence + m[0])) continue;
        } else if (kind === "container") {
          const own =
            LEAD_BEFORE.test(sentence) ||
            /\bmy\s+(?:[\p{L}-]+\s+){0,2}$/iu.test(text.slice(0, start));
          if (!own || MEMBERSHIP.test(text.slice(0, start))) continue;
        } else {
          const near = LEAD_NEAR.test(text.slice(0, start));
          const direct = noun === "report" && /\bdirect\s+reports\b/iu.test(m[0]);
          if (!near && !REPORTING.test(after) && !direct) continue;
        }
      }
      taken.push([start, end]);
      found.push({
        value,
        bound: bound(groups.approx === null ? undefined : m[groups.approx], m[groups.plus]),
        said: raw,
        index,
        start,
        end,
        noun,
        generic: noun === null || GENERIC.has(noun),
        report,
      });
    }
  }
  if (fact) {
    const lead = new RegExp(`^\\s*${APPROX}${N}`, "iu").exec(text);
    const raw = lead?.[2];
    const value = raw ? parseCount(raw) : null;
    if (lead && raw && value !== null && free(0, lead[0].length)) {
      const index = text.indexOf(raw);
      found.push({
        value,
        bound: bound(lead[1], lead[3]),
        said: raw,
        index,
        start: index,
        end: index + raw.length,
        noun: null,
        generic: true,
        report: false,
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

/** How far "about N" may be from the exact figure and still say the same thing. */
export const APPROX_SHARE = 0.05;

/** Whether two head counts agree: "50+" covers 50–54, "about 180" covers 171–189. */
export function sameCount(
  a: Pick<TeamClaim, "value" | "bound">,
  b: Pick<TeamClaim, "value" | "bound">,
): boolean {
  if (a.bound === "exact" && b.bound === "exact") return a.value === b.value;
  if (a.bound === "approx" || b.bound === "approx")
    return Math.abs(a.value - b.value) <= APPROX_SHARE * Math.max(a.value, b.value);
  const [lo, other] = a.bound === "atLeast" ? [a, b] : [b, a];
  if (other.bound === "atLeast") return lo.value === other.value;
  return other.value >= lo.value && other.value < lo.value + Math.max(1, lo.value * 0.1);
}
