// Truth linters (§8.7, §8.8): numbers, titles and dates must match the Fact Sheet, and school
// details must cite a verified pack item from the current cycle.

import { comparable, extractQuantities, sameQuantity, type Quantity } from "../quantities";
import { findSchoolTerms } from "../school-terms";
import { at, codePrefix, escapeRegExp, finding } from "../text";
import type { DraftDoc, FactRef, Finding, LintContext, PackItemRef } from "../types";

/* factMismatch ------------------------------------------------------------------------------- */

const MONTH =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(?=\s+\d|\s*,?\s+(?:19|20)\d{2})/gi;
const TITLE_KEY = /(?:^|_)(?:title|role|position|designation|job)(?:_|$)/i;
const TITLE_WORD =
  /\b(?:manager|director|lead|head|analyst|associate|engineer|officer|consultant|founder|co-founder|vp|vice\s+president|president|partner|principal|specialist|coordinator|supervisor|captain|lieutenant|major|nurse|teacher|intern|executive|chief)\b/i;
/** Words in a fact key too generic to tie a sentence to it ("team_size" ties on "team"). */
const GENERIC_KEY_WORDS = new Set([
  "size",
  "count",
  "number",
  "num",
  "total",
  "amount",
  "value",
  "current",
  "previous",
  "the",
  "of",
  "at",
  "in",
  "pct",
  "percent",
  "share",
  "first",
  "last",
  "start",
  "end",
  "date",
  "year",
  "years",
]);

function factQuantities(fact: FactRef): Quantity[] {
  const texts = [fact.approvedPhrasing, fact.value].filter((t): t is string => !!t);
  return texts.flatMap((t) => extractQuantities(t));
}

function months(text: string): string[] {
  return [...text.matchAll(MONTH)].map((m) => (m[1] ?? "").slice(0, 3).toLowerCase());
}

/** Key words a sentence must contain to be about this fact without citing it: "team_size" → ["team"]. */
function keyWords(fact: FactRef): string[] {
  return fact.key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GENERIC_KEY_WORDS.has(w));
}

function phrasing(fact: FactRef): string {
  return fact.approvedPhrasing ?? fact.value;
}

/** Where a fact's key word appears in the text: "team" also finds "teams" and "teammates". */
function keyWordSpans(text: string, word: string): [number, number][] {
  const stem = word.length > 5 ? word.slice(0, word.length - 1) : word;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(stem)}[\\p{L}]*`, "giu");
  return [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
}

// A quantity is attached to a key word when it sits right before it, with at most one word between
// ("13-person team", "8 direct reports"), or right after it through a linking word ("team of 15",
// "revenue grew to $2M"). "Our team shipped 3 releases" is not about the team's size.
const BEFORE_KEY = /^(?:[\s-]+[\p{L}]+)?[\s-]*$/u;
const AFTER_KEY =
  /^[\s:,-]*(?:(?:of|at|to|was|is|were|reached|hit|grew\s+to|rose\s+to|fell\s+to|totall?ed|totall?ing)\s+)?(?:(?:about|around|nearly|almost|roughly|some)\s+)?$/iu;

function attached(text: string, q: Quantity, spans: [number, number][]): boolean {
  const end = q.index + q.text.length;
  return spans.some(([s, e]) =>
    s >= end
      ? BEFORE_KEY.test(text.slice(end, s))
      : e <= q.index
        ? AFTER_KEY.test(text.slice(e, q.index))
        : false,
  );
}

function quantityConflict(
  text: string,
  fact: FactRef,
  keySpans?: [number, number][],
): Quantity | null {
  const fq = factQuantities(fact);
  if (fq.length === 0) return null;
  let dq = extractQuantities(text).filter((d) => fq.some((f) => comparable(d, f)));
  if (keySpans) dq = dq.filter((d) => attached(text, d, keySpans));
  if (dq.length === 0) return null;
  if (dq.some((d) => fq.some((f) => sameQuantity(d, f)))) return null;
  return dq[0] ?? null;
}

/** Title words about someone else ("my manager", "the team's lead", "her director") don't describe the applicant. */
const OTHERS_TITLE = new RegExp(
  `\\b(?:my|our|his|her|their|your|the\\s+[\\p{L}-]+['’]s|[\\p{L}-]+['’]s)\\s+(?:[\\p{L}-]+\\s+)?${TITLE_WORD.source.replace(/^\\b|\\b$/g, "")}\\b`,
  "giu",
);

function titleConflict(text: string, fact: FactRef): string | null {
  if (!TITLE_KEY.test(fact.key)) return null;
  const expected = phrasing(fact).trim().toLowerCase();
  if (!expected || text.toLowerCase().includes(expected)) return null;
  return TITLE_WORD.exec(text.replace(OTHERS_TITLE, (m) => " ".repeat(m.length)))?.[0] ?? null;
}

function monthConflict(text: string, fact: FactRef): string | null {
  const expected = months(phrasing(fact));
  const found = months(text);
  if (expected.length === 0 || found.length === 0) return null;
  return found.some((m) => expected.includes(m)) ? null : (found[0] ?? null);
}

/**
 * A number, title or date in a sentence that conflicts with a fact the sentence cites, or with an
 * uncited fact the sentence is evidently about (the number is attached to the fact's key word:
 * "a team of 15", "a 15-person team"). A sentence with no fact-like quantity, or with one that matches, is never flagged.
 */
export function factMismatch(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const facts = ctx.facts ?? [];
  if (facts.length === 0) return [];
  const byCode = new Map(facts.map((f) => [f.code.toUpperCase(), f]));
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    p.sentences.forEach((s, i) => {
      const cited = s.sources
        .map((c) => byCode.get(c.toUpperCase()))
        .filter((f): f is FactRef => !!f);
      const report = (fact: FactRef, said: string) =>
        findings.push(
          finding(
            "factMismatch",
            "must",
            at(p.id, i),
            `This says "${said}", but your Fact Sheet says "${phrasing(fact)}".`,
            `Use "${phrasing(fact)}", or correct the Fact Sheet if it's out of date.`,
          ),
        );
      for (const fact of cited) {
        const q = quantityConflict(s.text, fact);
        if (q) {
          report(fact, q.text);
          return;
        }
        const month = monthConflict(s.text, fact);
        if (month) {
          report(fact, month);
          return;
        }
        const title = titleConflict(s.text, fact);
        if (title) {
          report(fact, title);
          return;
        }
      }
      for (const fact of facts) {
        if (cited.includes(fact)) continue;
        const words = keyWords(fact);
        if (words.length === 0) continue;
        const spans = words.map((w) => keyWordSpans(s.text, w));
        if (spans.some((x) => x.length === 0)) continue;
        const q = quantityConflict(s.text, fact, spans.flat());
        if (q) {
          report(fact, q.text);
          return;
        }
      }
    });
  }
  return findings;
}

/* unverifiedSchool --------------------------------------------------------------------------- */

const APPLICANT_SOURCES = new Set(["F", "S", "L", "C", "P"]);

export function isValidPackSource(
  item: PackItemRef | undefined,
  currentCycle: string | undefined,
): boolean {
  if (!item || !item.verifiedAt) return false;
  return currentCycle === undefined || item.cycle === currentCycle;
}

export function unverifiedSchool(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const items = new Map((ctx.packItems ?? []).map((k) => [k.code.toUpperCase(), k]));
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    p.sentences.forEach((s, i) => {
      const ownMaterial = s.sources.some((c) => APPLICANT_SOURCES.has(codePrefix(c)));
      const terms = findSchoolTerms(s.text, ctx.schoolTerms).filter(
        (t) => t.via === "pack" || !ownMaterial,
      );
      const term = terms[0];
      if (!term) return;
      const kCodes = s.sources.filter((c) => codePrefix(c) === "K");
      if (kCodes.some((c) => isValidPackSource(items.get(c.toUpperCase()), ctx.currentCycle)))
        return;
      const explanation =
        kCodes.length === 0
          ? `"${term.text}" is a school detail with no verified source.`
          : `"${term.text}" cites a school source that hasn't been verified${ctx.currentCycle ? ` for ${ctx.currentCycle}` : ""}.`;
      findings.push(
        finding(
          "unverifiedSchool",
          "must",
          at(p.id, i),
          explanation,
          "Cite a verified school source, or cut the detail.",
        ),
      );
    });
  }
  return findings;
}
