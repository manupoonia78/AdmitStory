// Truth and provenance (spec §8.7). Three checks and one score:
//
//   - Unsupported claims: a composed sentence that makes a concrete claim (a number, a proper noun
//     that isn't sentence-initial, a quote, a date, a school detail) and cites nothing becomes a
//     Verify item and a must fix. Regex finds the clear cases; cases regex can't decide (a
//     capitalised first word, a short quoted phrase, a spelled-out number, an unknown acronym)
//     are returned as `ambiguous`, for the app to send to a Haiku classifier through ai.run().
//     Nothing here calls a model.
//   - Own words without a source: a verbatim or adapted sentence must resolve to a source span
//     (§5.8 AC: "every highlighted sentence resolves to a source span").
//   - People: a person's name appears only when may_name is yes; otherwise their role stands in.
//   - Voice fidelity: the share of draft words inside verbatim/adapted sentences, against a
//     target range per prompt type. Information, not a gate.

import { countWords } from "./count";
import { findSchoolTerms } from "./school-terms";
import { at, escapeRegExp, finding, sentencesOf } from "./text";
import type { DraftDoc, DraftSentence, Finding, LintContext, PersonRef, PromptType } from "./types";

/* Claims ------------------------------------------------------------------------------------- */

export type ClaimKind = "number" | "proper_noun" | "quote" | "date" | "school_term";

export interface Claim {
  kind: ClaimKind;
  text: string;
  index: number;
}

export interface ClaimScan {
  /** Concrete claims regex is sure about. */
  claims: Claim[];
  /** Possible claims for the classifier to decide. */
  ambiguous: Claim[];
}

const MONTHS =
  "January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const DATE_RE = new RegExp(
  `(?<![\\p{L}])(?:(?:${MONTHS})\\.?|(?<=\\b(?:in|on|of|since|by|until|from)\\s)May|May(?=\\s+\\d))(?![\\p{L}])(?:\\s+\\d{1,2}(?:st|nd|rd|th)?(?!\\d))?(?:,?\\s+(?:19|20)\\d{2})?|(?<![\\p{L}])(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?(?![\\p{L}])`,
  "gu",
);
const YEAR_RE = /(?<![\p{L}\d])(?:19|20)\d{2}(?!\d)/gu;
const DIGITS_RE = /[$€£₹¥]?\d(?:[\d,.]*\d)?(?:\s?%|\+)?(?:-\p{L}+)?/gu;
const SPELLED_RE =
  /(?<![\p{L}])(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen)(?![\p{L}])/giu;
const QUOTE_RE = /"([^"]+)"|“([^”]+)”|(?<=^|[\s(])‘([^‘]{3,}?)’(?=[\s.,;:!?)]|$)/gu;
const CAPITALISED_RE = /(?<![\p{L}\p{N}'’])\p{Lu}[\p{L}'’.-]*/gu;
const ALL_CAPS = /^\p{Lu}[\p{Lu}\d&.]+s?$/u;

/** Capitalised words that are never a claim on their own. */
const NOT_CLAIMS = new Set([
  "I",
  "I'm",
  "I’m",
  "I've",
  "I’ve",
  "I'd",
  "I’d",
  "I'll",
  "I’ll",
  "MBA",
  "CEO",
  "CFO",
  "COO",
  "CTO",
  "CMO",
  "VP",
  "AI",
  "OK",
  "TV",
  "PhD",
  "Ph.D.",
  "Mom",
  "Mum",
  "Dad",
]);

/** Common words that start sentences; a capitalised first word outside this list is ambiguous. */
const COMMON_STARTERS = new Set(
  (
    "a an the i we you he she it they my our your his her its their this that these those there here " +
    "when while after before as if because since though although but and or so yet then now later soon " +
    "once still even only just not no nobody everyone everybody someone somebody nothing everything " +
    "something none one each every all both some most many few more less what which who whom whose why " +
    "how where at in on by for from with without into through over under between during until " +
    "about above across against along among around behind beyond inside outside near toward towards " +
    "instead also again already always never sometimes often perhaps maybe yes today tonight yesterday " +
    "tomorrow years months weeks days hours minutes nights mornings evenings back first second next last " +
    "finally eventually suddenly slowly quietly within like unlike to let do does did is was were are be " +
    "being been have has had can could will would should must may might shall that's it's there's what's " +
    "i'm i've i'd i'll we're we've don't didn't couldn't wasn't weren't isn't aren't won't wouldn't"
  ).split(" "),
);

function firstWordIndex(text: string): number {
  const m = /[\p{L}\p{N}]/u.exec(text);
  return m ? m.index : -1;
}

export function scanClaims(text: string, schoolTerms: readonly string[] = []): ClaimScan {
  const claims: Claim[] = [];
  const ambiguous: Claim[] = [];
  const taken: [number, number][] = [];
  const free = (i: number, len: number) => taken.every(([s, e]) => i + len <= s || i >= e);
  const add = (list: Claim[], kind: ClaimKind, text: string, index: number) => {
    if (!free(index, text.length)) return;
    taken.push([index, index + text.length]);
    list.push({ kind, text, index });
  };

  for (const t of findSchoolTerms(text, schoolTerms)) add(claims, "school_term", t.text, t.index);
  for (const m of text.matchAll(QUOTE_RE)) {
    const inner = m[1] ?? m[2] ?? m[3] ?? "";
    add(inner.trim().split(/\s+/).length >= 3 ? claims : ambiguous, "quote", m[0], m.index);
  }
  for (const m of text.matchAll(DATE_RE)) add(claims, "date", m[0].trim(), m.index);
  for (const m of text.matchAll(YEAR_RE)) add(claims, "date", m[0], m.index);
  for (const m of text.matchAll(DIGITS_RE)) add(claims, "number", m[0], m.index);
  for (const m of text.matchAll(SPELLED_RE)) add(ambiguous, "number", m[0], m.index);

  const start = firstWordIndex(text);
  for (const m of text.matchAll(CAPITALISED_RE)) {
    const word = m[0].replace(/[.'’-]+$/, "");
    if (NOT_CLAIMS.has(word)) continue;
    const isStart = m.index === start;
    const afterColonOrQuote = /[:"“‘]\s*$/.test(text.slice(0, m.index));
    if (isStart) {
      if (!COMMON_STARTERS.has(word.toLowerCase())) add(ambiguous, "proper_noun", word, m.index);
    } else if (ALL_CAPS.test(word)) {
      add(ambiguous, "proper_noun", word, m.index);
    } else if (afterColonOrQuote) {
      if (!COMMON_STARTERS.has(word.toLowerCase())) add(ambiguous, "proper_noun", word, m.index);
    } else {
      add(claims, "proper_noun", word, m.index);
    }
  }
  const byIndex = (a: Claim, b: Claim) => a.index - b.index;
  return { claims: claims.sort(byIndex), ambiguous: ambiguous.sort(byIndex) };
}

/* Provenance check --------------------------------------------------------------------------- */

export interface VerifyItem {
  text: string;
  reason: string;
  paragraph_id: string;
  sentence: number;
}

export interface AmbiguousClaim {
  paragraph_id: string;
  sentence: number;
  text: string;
  candidates: Claim[];
}

export interface ProvenanceResult {
  findings: Finding[];
  verify: VerifyItem[];
  /** Composed, unsourced sentences whose only possible claims regex couldn't decide. */
  ambiguous: AmbiguousClaim[];
}

const CLAIM_WORDS: Record<ClaimKind, string> = {
  number: "a number",
  proper_noun: "a name",
  quote: "a quote",
  date: "a date",
  school_term: "a school detail",
};

export function checkProvenance(draft: DraftDoc, ctx: LintContext = {}): ProvenanceResult {
  const result: ProvenanceResult = { findings: [], verify: [], ambiguous: [] };
  for (const s of sentencesOf(draft)) {
    if (s.sources.length > 0) continue;
    if (s.kind !== "composed") {
      result.findings.push(
        finding(
          "unsourcedOwnWords",
          "must",
          at(s.paragraphId, s.index),
          "This sentence is shown as your words but doesn't point to anything you said.",
          "Link it to your answer, or mark it as composed.",
        ),
      );
      continue;
    }
    const scan = scanClaims(s.text, ctx.schoolTerms);
    const claim = scan.claims[0];
    if (claim) {
      result.findings.push(
        finding(
          "unsupportedClaim",
          "must",
          at(s.paragraphId, s.index),
          `This sentence states ${CLAIM_WORDS[claim.kind]} ("${claim.text}") that nothing in your file supports.`,
          "Confirm it in Verify, or cut it.",
        ),
      );
      result.verify.push({
        text: s.text,
        reason: `States ${CLAIM_WORDS[claim.kind]} ("${claim.text}") with no source.`,
        paragraph_id: s.paragraphId,
        sentence: s.index,
      });
    } else if (scan.ambiguous.length > 0) {
      result.ambiguous.push({
        paragraph_id: s.paragraphId,
        sentence: s.index,
        text: s.text,
        candidates: scan.ambiguous,
      });
    }
  }
  result.findings.push(...peopleNamed(draft, ctx));
  return result;
}

/* People ------------------------------------------------------------------------------------- */

function nameRegExp(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "gu");
}

/** The full name first, then each part of it ("Asha Rao", then "Asha", then "Rao"). */
function nameForms(person: PersonRef): string[] {
  const full = person.name.trim();
  const parts = full.split(/\s+/).filter((p) => p.length >= 2);
  return [...new Set([full, ...parts])];
}

function withRole(sentence: DraftSentence, form: string, role: string): DraftSentence {
  const text = sentence.text.replace(nameRegExp(form), (_m, offset: number) => {
    const atStart =
      sentence.text
        .slice(0, offset)
        .trim()
        .replace(/["“‘']/g, "") === "";
    return atStart ? role.charAt(0).toUpperCase() + role.slice(1) : role;
  });
  return { ...sentence, text };
}

export function peopleNamed(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const hidden = (ctx.people ?? []).filter((p) => !p.mayName && p.name.trim());
  if (hidden.length === 0) return [];
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    p.sentences.forEach((s, i) => {
      for (const person of hidden) {
        const form = nameForms(person).find((f) => nameRegExp(f).test(s.text));
        if (!form) continue;
        const fixed = withRole(s, form, person.role);
        findings.push({
          ...finding(
            "personNamed",
            "must",
            at(p.id, i),
            `This names ${form}, who you chose not to name, so it should say "${person.role}" instead.`,
            `Say "${person.role}".`,
          ),
          patch: {
            op: "replace",
            paragraph_id: p.id,
            sentences: p.sentences.map((x, j) => (j === i ? fixed : x)),
          },
        });
      }
    });
  }
  return findings;
}

/* Voice fidelity ----------------------------------------------------------------------------- */

export interface FidelityRange {
  min: number;
  max: number;
}

/**
 * Target share of the applicant's own words per prompt type (§8.7: "higher for personal essays,
 * lower for goals essays"). v1 starting numbers from judgment, to be recalibrated against the
 * eval harness (§8.11) once live kits exist:
 *   - personal stories (identity, context, support, list, micro, video): 45–80%. These are made
 *     of the applicant's own memories, and their sentences carry them best.
 *   - leadership, setback, values, contribution: 40–75%. Still stories, with more composed
 *     connective tissue between beats.
 *   - reapplicant, optional, scholarship: 25–60%. Partly factual explanation.
 *   - goals and goal boxes: 15–45%. Forward-looking plans the applicant rarely said in full.
 *   - why school: 10–40%. Mostly verified school specifics, which are never the applicant's words.
 */
export const VOICE_FIDELITY_TARGETS: Record<PromptType, FidelityRange> = {
  IDENTITY: { min: 0.45, max: 0.8 },
  CONTEXT: { min: 0.45, max: 0.8 },
  SUPPORT: { min: 0.45, max: 0.8 },
  LIST: { min: 0.45, max: 0.8 },
  MICRO: { min: 0.45, max: 0.8 },
  VIDEO: { min: 0.45, max: 0.8 },
  LEADERSHIP: { min: 0.4, max: 0.75 },
  SETBACK: { min: 0.4, max: 0.75 },
  VALUES: { min: 0.4, max: 0.75 },
  CONTRIBUTION: { min: 0.4, max: 0.75 },
  REAPPLICANT: { min: 0.25, max: 0.6 },
  OPTIONAL: { min: 0.25, max: 0.6 },
  SCHOLARSHIP: { min: 0.25, max: 0.6 },
  GOALS: { min: 0.15, max: 0.45 },
  GOALBOX: { min: 0.15, max: 0.45 },
  "WHY-SCHOOL": { min: 0.1, max: 0.4 },
};

export const DEFAULT_FIDELITY_TARGET: FidelityRange = { min: 0.3, max: 0.7 };

export interface VoiceFidelity {
  /** 0–1. */
  score: number;
  ownWords: number;
  totalWords: number;
  target: FidelityRange;
  status: "below" | "within" | "above";
}

export function voiceFidelity(draft: DraftDoc, promptType?: PromptType | null): VoiceFidelity {
  let own = 0;
  let total = 0;
  for (const s of sentencesOf(draft)) {
    const n = countWords(s.text);
    total += n;
    if (s.kind !== "composed") own += n;
  }
  const score = total > 0 ? own / total : 0;
  const target = (promptType && VOICE_FIDELITY_TARGETS[promptType]) || DEFAULT_FIDELITY_TARGET;
  const status = score < target.min ? "below" : score > target.max ? "above" : "within";
  return { score, ownWords: own, totalWords: total, target, status };
}

/** A consider-level nudge when the draft drifts below the target; the score itself is shown as information. */
export function voiceFidelityFinding(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const v = voiceFidelity(draft, ctx.promptType);
  if (v.totalWords === 0 || v.status !== "below") return [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return [
    finding(
      "voiceFidelity",
      "consider",
      at(null),
      `${pct(v.score)} of this draft is in your own words; for this kind of prompt, ${pct(v.target.min)}–${pct(v.target.max)} reads most like you.`,
      "Sound more like me",
    ),
  ];
}
