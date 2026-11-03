// Job titles for the consistency check (spec §5.10): the Fact Sheet's titles, the résumé's role
// titles, and the titles a document gives the applicant ("as a Senior Software Engineer", "I was
// promoted to Lead Engineer", "Senior Software Engineer, Meridian Health Systems"). Titles of other
// people ("my manager", "her director, a Senior Director") never count; neither do goals ("I want
// to become a product manager") or a bare profession ("as an engineer").

import type { FactRef } from "../types";
import { findEmployers, type Employer } from "./employers";
import { fold } from "./text";

/** Fact keys that hold a title (as truth.ts reads them). */
export const TITLE_KEY = /(?:^|_)(?:title|role|position|designation|job)(?:_|$)/iu;

const TITLE_WORDS = [
  "manager",
  "director",
  "lead",
  "head",
  "analyst",
  "associate",
  "engineer",
  "officer",
  "consultant",
  "founder",
  "co-founder",
  "cofounder",
  "vp",
  "president",
  "partner",
  "principal",
  "specialist",
  "coordinator",
  "supervisor",
  "captain",
  "lieutenant",
  "major",
  "colonel",
  "sergeant",
  "commander",
  "nurse",
  "teacher",
  "intern",
  "executive",
  "chief",
  "trainee",
  "technician",
  "tutor",
  "superintendent",
  "ceo",
  "coo",
  "cfo",
  "cto",
  "developer",
  "scientist",
  "designer",
  "administrator",
  "accountant",
  "controller",
  "auditor",
  "professor",
  "professora",
  "coordenadora",
  "leader",
];
const TITLE_WORD = new RegExp(`\\b(?:${TITLE_WORDS.join("|")}|vice\\s+president)\\b`, "iu");

/** Words that make a lowercase phrase a title rather than a profession: "a senior engineer". */
const SENIORITY = new Set([
  "senior",
  "sr",
  "junior",
  "jr",
  "lead",
  "staff",
  "principal",
  "chief",
  "head",
  "associate",
  "assistant",
  "deputy",
  "vice",
  "executive",
  "managing",
  "general",
  "charge",
  "acting",
]);

/** Leading words that describe the person, not the title: "the youngest Floor Superintendent". */
const SKIP = new Set(["youngest", "first", "only", "new", "former", "sole", "then", "permanent"]);

const STOP = new Set(
  (
    "in on at for with to from by since during when where who whom which that or but while after " +
    "before until i me my we our he she they it his her their its is was were are be been had has " +
    "have the a an this than then so because across over under through into within without every " +
    "each also as on"
  ).split(" "),
);
const CONNECTORS = new Set(["of", "de", "da", "do", "dos", "das", "and", "&"]);

/** Other people's titles, blanked before reading ("my manager", "the team's lead", "her director, a Senior Director"). */
const OTHERS_TITLE = new RegExp(
  `\\b(?:my|our|his|her|their|your|the\\s+[\\p{L}-]+['’]s|[\\p{L}-]+['’]s)\\s+(?:[\\p{L}-]+\\s+)?${TITLE_WORD.source.replace(/^\\b|\\b$/gu, "")}\\b(?:,\\s*(?:a|an|the)\\s+(?:[\\p{L}-]+\\s+){0,3}?${TITLE_WORD.source.replace(/^\\b|\\b$/gu, "")}\\b)?`,
  "giu",
);

const TRIGGER =
  /\b(?:(promoted\s+(?:me\s+)?to|promotion\s+to|became|become|becoming|was\s+named|named|was\s+appointed|appointed|was\s+made|title\s+(?:is|was|of)|moved\s+up\s+to)|(as|I\s+am|I['’]m|I\s+was|I['’]ve\s+been|I\s+have\s+been|I\s+had\s+been))\s+(?:(?:a|an|the)\s+)?/giu;
/** Briefs speak of the applicant by name or pronoun: "Arjun was promoted…", "she has been…". */
const BRIEF_TRIGGER =
  /\b(?:he|she|they|[\p{Lu}][\p{L}\p{M}]+)\s+(?:is|was|has\s+been|had\s+been|served\s+as|worked\s+as)\s+(?:(?:a|an|the|our|your)\s+)?/gu;
const FUTURE =
  /\b(?:want|wants|wanted|hope|hoping|plan|planning|aim|aiming|goal|goals|will|would|aspire|intend|next|post-MBA|after\s+(?:my|the|an)\s+MBA)\b/iu;
const PRONOUN =
  /\b(?:I|[Mm]e|[Mm]y|[Ww]e|[Oo]ur|[Hh]e|[Ss]he|[Tt]hey|[Hh]is|[Hh]er|[Hh]im|[Tt]heir|[Tt]hem)\b/gu;
const THIRD = /^(?:he|she|they|his|her|him|their|them)$/iu;
const NAME_SUBJECT =
  /(?:^|[\s,;])(?!I\s)([\p{Lu}][\p{L}\p{M}]+)\s+(?:was\s+|is\s+|got\s+|had\s+been\s+|has\s+been\s+)?$/u;
const ADVERBS = new Set(
  "since then later soon eventually finally and so in by after before when once today now last this that within".split(
    " ",
  ),
);

export interface KnownTitle {
  id: string;
  /** What the finding shows and the one-click fix writes. */
  display: string;
  /** Every form that counts as this title, tails included ("Staff Nurse" for "ICU Staff Nurse"). */
  forms: Set<string>;
  /** The full and core forms only, which win over another title's tail. */
  primary: Set<string>;
  words: string[];
  heads: Set<string>;
  /** True when the core is one word ("Captain"), so a bare capitalised rank compares. */
  single: boolean;
  /** True when the Fact Sheet form carries a qualifier after a comma ("Director, Operations"). */
  commaForm: boolean;
  fact: FactRef | null;
  roleRef: string | null;
  current: boolean;
  employer: Employer | null;
}

/** Folded, punctuation-light form for comparison: "Director, Operations" → "director, operations". */
export function normTitle(text: string): string {
  return fold(text)
    .replace(/[.()]/gu, "")
    .replace(/\s*,\s*/gu, ", ")
    .replace(/\s+/gu, " ")
    .replace(/^(?:the|a|an)\s+/u, "")
    .trim();
}

function words(text: string): string[] {
  return normTitle(text)
    .split(/[\s,]+/u)
    .filter((w) => w !== "" && !CONNECTORS.has(w));
}

function headsOf(core: string): Set<string> {
  const ws = words(core);
  const heads = ws.filter((w) => TITLE_WORDS.includes(w));
  if (heads.length > 0) return new Set(heads);
  const fallback = ws.length <= 3 ? ws[ws.length - 1] : ws[0];
  return new Set(fallback ? [fallback] : []);
}

function makeTitle(
  id: string,
  text: string,
  fact: FactRef | null,
  roleRef: string | null,
  current: boolean,
  employer: Employer | null,
): KnownTitle | null {
  const full = (text.split(/\s+at\s+|\s+with\s+(?=[\p{Lu}])/u)[0] ?? text).trim();
  const core = (full.split(",")[0] ?? full).trim();
  if (!core) return null;
  const forms = new Set([normTitle(full), normTitle(core)]);
  for (const f of [...forms]) {
    const roman = f.replace(/\s+(?:i|ii|iii|iv)$/u, "");
    if (roman !== f) forms.add(roman);
  }
  const primary = new Set(forms);
  const coreWords = normTitle(core).split(" ");
  for (let k = 1; k + 2 <= coreWords.length; k += 1) {
    const first = coreWords[k] ?? "";
    if (!CONNECTORS.has(first)) forms.add(coreWords.slice(k).join(" "));
  }
  const fullWords = full.split(/\s+/u).length;
  return {
    id,
    display: fullWords <= 6 ? full : core,
    forms,
    primary,
    words: words(core),
    heads: headsOf(core),
    single: coreWords.length === 1,
    commaForm: full !== core,
    fact,
    roleRef,
    current,
    employer,
  };
}

/** The employer fact that goes with a title fact: title_current ↔ employer_current. */
function employerFor(fact: FactRef, employers: readonly Employer[]): Employer | null {
  const facts = employers.filter((e) => e.fact);
  const paired = fact.key.toLowerCase().replace(/title|role|position|designation|job/u, "");
  const match = facts.find(
    (e) =>
      e.fact &&
      e.fact.key.toLowerCase().replace(/employer|company|organi[sz]ation|firm/u, "") === paired,
  );
  if (match) return match;
  return facts.length === 1 ? (facts[0] ?? null) : null;
}

/** Titles from the Fact Sheet ("Operations Analyst, then Team Lead" is two). */
export function factTitles(
  facts: readonly FactRef[],
  employers: readonly Employer[],
): KnownTitle[] {
  const out: KnownTitle[] = [];
  for (const f of facts) {
    if (!TITLE_KEY.test(f.key)) continue;
    const text = f.approvedPhrasing ?? f.value;
    const parts = text.split(/,?\s+then\s+|;\s*/u).filter((p) => p.trim() !== "");
    parts.forEach((p, i) => {
      const t = makeTitle(
        `fact:${f.code}#${i}`,
        p,
        f,
        null,
        /current/iu.test(f.key) && i === parts.length - 1,
        employerFor(f, employers),
      );
      if (t) out.push(t);
    });
  }
  return out;
}

export function roleTitle(
  ref: string,
  title: string,
  current: boolean,
  employer: Employer | null,
): KnownTitle | null {
  return makeTitle(`role:${ref}`, title, null, ref, current, employer);
}

/** The known title a text is exactly (one of its forms), longest form first. */
export function matchTitle(text: string, titles: readonly KnownTitle[]): KnownTitle | null {
  const n = normTitle(text);
  return titles.find((t) => t.primary.has(n)) ?? titles.find((t) => t.forms.has(n)) ?? null;
}

/**
 * The known title a differing one most likely means: one with the same head word, else one that
 * shares a distinctive word ("Project Manager" for "Project Leader"), else (when asked) the current
 * title. Ties go to the current title.
 */
export function closestTitle(
  text: string,
  titles: readonly KnownTitle[],
  fallbackToCurrent: boolean,
): KnownTitle | null {
  const ws = new Set(words(text));
  const heads = headsOf(text);
  const score = (t: KnownTitle) => {
    const shared = t.words.filter((w) => ws.has(w)).length;
    return shared / (ws.size + t.words.length - shared || 1);
  };
  const sameHead = titles.filter((t) => [...t.heads].some((h) => heads.has(h)));
  const sameWord = titles.filter((t) =>
    t.words.some((w) => ws.has(w) && !SENIORITY.has(w) && !TITLE_WORDS.includes(w)),
  );
  const pool = sameHead.length > 0 ? sameHead : sameWord;
  if (pool.length === 0)
    return fallbackToCurrent ? (titles.find((t) => t.current) ?? titles[0] ?? null) : null;
  let best: KnownTitle | null = null;
  for (const t of pool) {
    if (!best) best = t;
    else {
      const d = score(t) - score(best);
      if (d > 1e-9 || (Math.abs(d) <= 1e-9 && t.current && !best.current)) best = t;
    }
  }
  return best;
}

export interface TitleMention {
  said: string;
  index: number;
  end: number;
  title: KnownTitle;
  /** True when it is one of the title's forms. */
  same: boolean;
  /** Said with "promoted to", "became" and the like: the title it means is clear even when it differs. */
  strong: boolean;
}

/** Lowercased per character, so offsets stay put (folding may change lengths). */
function lowerKeep(text: string): string {
  return [...text].map((c) => (fold(c).length === c.length ? fold(c) : c.toLowerCase())).join("");
}

function blankOthers(text: string): string {
  return text.replace(OTHERS_TITLE, (m) => " ".repeat(m.length));
}

const isCap = (w: string) => /^[\p{Lu}]/u.test(w);
const TOKEN = /\s*(,|&|[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’-]*\.?)/uy;

interface Tok {
  text: string;
  index: number;
  end: number;
  lower: string;
}

function readTokens(text: string, from: number, limit: number): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = from;
  for (let m = TOKEN.exec(text); m && out.length < 14; m = TOKEN.exec(text)) {
    const raw = m[1] ?? "";
    const start = m.index + m[0].length - raw.length;
    if (start >= limit) break;
    const word = raw.endsWith(".") && raw.length > 1 ? raw.slice(0, -1) : raw;
    out.push({ text: word, index: start, end: start + word.length, lower: fold(word) });
    if (word !== raw) break;
  }
  return out;
}

/** The title phrase starting at a token list: modifiers, the head word, then "of Operations" etc. */
function phrase(toks: readonly Tok[]): Tok[] {
  const out: Tok[] = [];
  let seenHead = false;
  let capital = false;
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (!t) break;
    const next = toks[i + 1];
    const nextCap = !!next && isCap(next.text) && next.text !== "I";
    if (t.text === ",") {
      if (seenHead && capital && nextCap) {
        out.push(t);
        continue;
      }
      break;
    }
    if (CONNECTORS.has(t.lower)) {
      if (seenHead && capital && nextCap) {
        out.push(t);
        continue;
      }
      break;
    }
    if (t.text === "I") {
      const prev = out[out.length - 1];
      const roman = seenHead && !!prev && isCap(prev.text) && (!next || next.text === ",");
      if (roman) out.push(t);
      break;
    }
    if (STOP.has(t.lower)) break;
    const head = TITLE_WORDS.includes(t.lower);
    if (seenHead) {
      if (head || (capital && isCap(t.text))) out.push(t);
      else break;
    } else {
      if (out.length === 0 && SKIP.has(t.lower)) continue;
      if (out.length >= 4 && !head) return [];
      if (isCap(t.text) && out.length > 0 && !out.some((o) => isCap(o.text))) out.length = 0;
      out.push(t);
      capital = isCap(t.text) || capital;
    }
    if (head) seenHead = true;
  }
  if (!seenHead) return [];
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last && (last.text === "," || CONNECTORS.has(last.lower))) out.pop();
    else break;
  }
  return out;
}

export interface TitleContext {
  titles: readonly KnownTitle[];
  employers: readonly Employer[];
  /** Recommender briefs talk about the applicant in the third person. */
  thirdPersonIsApplicant: boolean;
}

/** Text from a token list, as written. */
const slice = (text: string, toks: readonly Tok[]) => {
  const first = toks[0];
  const last = toks[toks.length - 1];
  return first && last ? text.slice(first.index, last.end) : "";
};

/** Resolve one candidate phrase against the known titles. */
function resolve(
  text: string,
  toks: readonly Tok[],
  strong: boolean,
  ctx: TitleContext,
): Omit<TitleMention, "strong"> | null {
  if (toks.length === 0) return null;
  const at = (from: number, to: number) => ({
    said: slice(text, toks.slice(from, to + 1)),
    index: toks[from]?.index ?? 0,
    end: toks[to]?.end ?? 0,
  });
  // Candidate phrases end on a word, never on "of" or a comma; the longest known one wins.
  const ends = toks.flatMap((t, i) => (t.text !== "," && !CONNECTORS.has(t.lower) ? [i] : []));
  const last = ends[ends.length - 1] ?? 0;
  const commaAt = toks.findIndex((t) => t.text === ",");
  for (const e of [...ends].reverse()) {
    const title = matchTitle(slice(text, toks.slice(0, e + 1)), ctx.titles);
    if (!title) continue;
    // "Director of Production" for "Director, Operations", or "…, Central Region" for "…,
    // Midwest": the core matched but the qualifier after it differs (and is not the employer).
    const qualifier = toks[e + 1]?.text === ",";
    if (e < last && title.commaForm && (title.single || qualifier)) {
      const longest = normTitle(slice(text, toks.slice(0, last + 1)));
      const prefix = [...title.forms].some((f) => f.startsWith(longest));
      const ext = slice(text, toks.slice(e + 1));
      if (!prefix && findEmployers(ext, ctx.employers).length === 0)
        return { ...at(0, last), title, same: false };
    }
    return { ...at(0, e), title, same: true };
  }
  // No known form: the phrase up to any comma is what the text calls the applicant.
  const before = commaAt === -1 ? toks : toks.slice(0, commaAt);
  const ws = before.filter((t) => !CONNECTORS.has(t.lower));
  if (ws.length === 0) return null;
  const capital = isCap(ws[0]?.text ?? "");
  const bare = ws.length === 1;
  const valid = bare
    ? capital && ctx.titles.some((t) => t.single)
    : capital || ws.some((t) => SENIORITY.has(t.lower));
  if (!valid) return null;
  const mention = at(0, before.length - 1);
  const title = closestTitle(mention.said, ctx.titles, strong || bare);
  return title ? { ...mention, title, same: false } : null;
}

const ORG_AFTER = /^\s+(?:at|with|for)\s+((?:[\p{Lu}][\p{L}\p{M}'’.&-]*\s*){1,5})/u;
const ORG_BEFORE = /\b(?:at|with|for|joined)\s+((?:[\p{Lu}][\p{L}\p{M}'’.&-]*\s*){1,5})[^,;.]*$/u;

/**
 * "as Senior Engineer at Northwind", "I interned at Northwind as a Software Engineering Intern":
 * another job, at an organisation we don't know.
 */
function otherOrganisation(text: string, from: number, end: number, ctx: TitleContext): boolean {
  const unknown = (run: string | undefined) => {
    const r = run?.trim().replace(/\s+I$/u, "");
    return !!r && r !== "I" && findEmployers(r, ctx.employers).length === 0;
  };
  return (
    unknown(ORG_AFTER.exec(text.slice(end))?.[1]) ||
    unknown(ORG_BEFORE.exec(text.slice(from, end))?.[1])
  );
}

/**
 * The titles a text gives the applicant: after a trigger ("as", "promoted to", "became", "I was"),
 * or at the start of a sentence right before a known employer ("Senior Analyst, Halverstead & Co.").
 * Matching mentions are returned too (same: true), so dates can anchor to them.
 */
export function findTitles(text: string, ctx: TitleContext): TitleMention[] {
  if (ctx.titles.length === 0) return [];
  const blanked = blankOthers(text);
  const found: TitleMention[] = [];
  const taken = (i: number) => found.some((f) => i >= f.index && i < f.end);
  const triggers = [
    ...[...blanked.matchAll(TRIGGER)].map((m) => ({ m, strong: m[1] !== undefined })),
    ...(ctx.thirdPersonIsApplicant
      ? [...blanked.matchAll(BRIEF_TRIGGER)].map((m) => ({ m, strong: false }))
      : []),
  ].sort((a, b) => a.m.index - b.m.index);
  for (const { m, strong } of triggers) {
    const start = m.index + m[0].length;
    if (taken(start)) continue;
    const sentenceStart = Math.max(
      blanked.lastIndexOf(". ", m.index) + 1,
      blanked.lastIndexOf("\n", m.index) + 1,
      0,
    );
    const before = blanked.slice(sentenceStart, m.index);
    if (FUTURE.test(before.slice(-60))) continue;
    if (!ctx.thirdPersonIsApplicant) {
      const pronouns = [...text.slice(sentenceStart, m.index).matchAll(PRONOUN)];
      const last = pronouns[pronouns.length - 1]?.[0];
      if (last && THIRD.test(last)) continue;
      // "Ravi was promoted to Engineering Manager": someone else's promotion.
      const subject = NAME_SUBJECT.exec(before)?.[1];
      if (strong && !/\bme\b/iu.test(m[0]) && subject && !ADVERBS.has(subject.toLowerCase()))
        continue;
    }
    const sentenceEnd = (() => {
      const e = blanked.slice(start).search(/[.!?;](?:\s|$)|\n/u);
      return e === -1 ? blanked.length : start + e;
    })();
    const toks = phrase(readTokens(blanked, start, sentenceEnd));
    const mention = resolve(blanked, toks, strong, ctx);
    if (!mention) continue;
    if (!mention.same && otherOrganisation(blanked, sentenceStart, mention.end, ctx)) continue;
    found.push({ ...mention, strong, said: text.slice(mention.index, mention.end) });
  }
  // "Senior Software Engineer, Meridian Health Systems": a title heading an entry.
  for (const e of findEmployers(blanked, ctx.employers)) {
    const stop = blanked.lastIndexOf(". ", e.runIndex);
    const lineStart = Math.max(
      stop === -1 ? 0 : stop + 2,
      blanked.lastIndexOf("\n", e.runIndex) + 1,
    );
    const head = blanked.slice(lineStart, e.runIndex);
    const m =
      /^\s*((?:[\p{Lu}][\p{L}\p{M}'’-]*\s+(?:(?:of|de|da|do|and|&)\s+)?){0,5}[\p{Lu}][\p{L}\p{M}'’-]*)\s*(?:,|\bat\b|—|–|\|)\s*$/u.exec(
        head,
      );
    const raw = m?.[1];
    if (!raw || !TITLE_WORD.test(raw)) continue;
    const index = lineStart + head.indexOf(raw);
    if (taken(index)) continue;
    const toks = phrase(readTokens(blanked, index, index + raw.length));
    const mention = resolve(blanked, toks, false, ctx);
    if (mention)
      found.push({ ...mention, strong: false, said: text.slice(mention.index, mention.end) });
  }
  // Known titles named anywhere (two words or more), for anchoring dates; always the same.
  const lower = lowerKeep(blanked);
  const forms = ctx.titles
    .flatMap((t) => [...t.forms].map((f) => ({ f, t })))
    .filter(
      ({ f, t }) =>
        f.includes(" ") && (t.primary.has(f) || !ctx.titles.some((o) => o.primary.has(f))),
    )
    .sort((a, b) => b.f.length - a.f.length);
  for (const { f, t } of forms) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${f.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{N}])`,
      "gu",
    );
    for (const m of lower.matchAll(re)) {
      const end = m.index + m[0].length;
      if (found.some((x) => m.index < x.end && end > x.index)) continue;
      found.push({
        said: text.slice(m.index, end),
        index: m.index,
        end,
        title: t,
        same: true,
        strong: false,
      });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}
