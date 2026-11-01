// Style and craft linters (§8.8; canon A5 story-craft and A13 anti-ai-tells). Each is a pure
// function of the draft (and, for some, the context) returning Critic-shaped findings.

import { countWords } from "../count";
import {
  ANNOUNCES_NEXT,
  BANNED_PHRASES,
  ENDING_OPENERS,
  IT_WAS_THEN,
  JARGON_ACRONYMS,
  JOURNEY,
  JOURNEY_OWNERS,
  NOT_ONLY,
  OPENING_THESIS,
  SENTENCE_START_FILLERS,
  SUMMARY_MARKERS,
} from "../phrases";
import {
  at,
  draftText,
  escapeRegExp,
  excerpt,
  finding,
  sentencesOf,
  withoutQuotedSpeech,
  wordTokens,
} from "../text";
import type { DraftDoc, DraftSentence, Finding, LintContext } from "../types";

/* bannedPhrases (TELL-01) -------------------------------------------------------------------- */

function capitalise(text: string): string {
  return text.replace(/^(["“‘']?)(\p{Ll})/u, (_, q: string, c: string) => q + c.toUpperCase());
}

/** "my journey" yes, "the journey from the village" no (see JOURNEY_OWNERS). */
function journeyAboutSelf(text: string): string | null {
  for (const m of text.matchAll(JOURNEY)) {
    const before = wordTokens(text.slice(0, m.index)).slice(-2);
    if (before.some((w) => JOURNEY_OWNERS.has(w))) return m[0];
  }
  return null;
}

export function bannedPhrases(draft: DraftDoc): Finding[] {
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    p.sentences.forEach((s, i) => {
      const hits: { label: string; instead: string | null }[] = [];
      for (const phrase of BANNED_PHRASES) {
        const m = s.text.match(phrase.pattern);
        if (m) hits.push({ label: m[0], instead: phrase.instead });
      }
      const journey = journeyAboutSelf(s.text);
      if (journey) hits.push({ label: journey, instead: "say where you actually went, or cut it" });
      for (const hit of hits) {
        findings.push(
          finding(
            "bannedPhrases",
            "should",
            at(p.id, i),
            `"${hit.label}" is a phrase that makes essays sound generated.`,
            hit.instead
              ? `Try "${hit.instead}", or say what you actually did.`
              : "Say what you actually did, in plain words.",
          ),
        );
      }
      // "Moreover," / "Furthermore," at sentence start: dropping it is safe, so offer the patch.
      const filler = SENTENCE_START_FILLERS.exec(s.text);
      if (filler) {
        const rest = s.text.slice(filler[0].length);
        const quote = /^["“‘']/.exec(s.text)?.[0] ?? "";
        const fixed: DraftSentence = { ...s, text: capitalise(quote + rest) };
        findings.push({
          ...finding(
            "bannedPhrases",
            "should",
            at(p.id, i),
            `Starting a sentence with "${filler[1]}" reads like a report, not a story.`,
            `Cut "${filler[1]}".`,
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

/* constructions (TELL-02) and formatting (TELL-03) ------------------------------------------- */

export function constructions(draft: DraftDoc): Finding[] {
  const findings: Finding[] = [];
  for (const s of sentencesOf(draft)) {
    if (IT_WAS_THEN.test(s.text)) {
      findings.push(
        finding(
          "constructions",
          "consider",
          at(s.paragraphId, s.index),
          `"It was then that I realised" tells the reader the lesson instead of showing the moment.`,
          "Stage the moment and let the reader get there first.",
        ),
      );
    }
    if (ANNOUNCES_NEXT.test(s.text.trim())) {
      findings.push(
        finding(
          "constructions",
          "consider",
          at(s.paragraphId, s.index),
          "This sentence only announces what comes next.",
          "Cut it and start with the next point.",
        ),
      );
    }
  }
  for (const p of draft.paragraphs) {
    const first = p.sentences[0];
    if (first && /\?["”]?\s*$/.test(first.text.trim()) && !/^["“]/.test(first.text.trim())) {
      findings.push(
        finding(
          "constructions",
          "consider",
          at(p.id, 0),
          "Opening a paragraph with a rhetorical question is a common generated pattern.",
          "Open with the moment itself.",
        ),
      );
    }
  }
  const notOnly = [...draftText(draft).matchAll(NOT_ONLY)].length;
  if (notOnly > 1) {
    findings.push(
      finding(
        "constructions",
        "consider",
        at(null),
        `"Not only… but also" appears ${notOnly} times; once is plenty.`,
        "Keep the strongest one and say the others plainly.",
      ),
    );
  }
  return findings;
}

const BULLET = /^\s*(?:[-*•▪◦]|\d+[.)])\s+/u;
const HEADING = /^\s*#{1,6}\s+/u;
const BOLD = /\*\*[^*]+\*\*|__[^_]+__/u;

export function formatting(draft: DraftDoc): Finding[] {
  const findings: Finding[] = [];
  for (const s of sentencesOf(draft)) {
    const what = HEADING.test(s.text)
      ? "a heading"
      : BULLET.test(s.text)
        ? "a bullet point"
        : BOLD.test(s.text)
          ? "bold text"
          : null;
    if (!what) continue;
    findings.push(
      finding(
        "formatting",
        "should",
        at(s.paragraphId, s.index),
        `This has ${what}, which reads as generated in an essay answer.`,
        "Write it as a plain sentence.",
      ),
    );
  }
  return findings;
}

/* openingThesis / endingSummary -------------------------------------------------------------- */

export function openingThesis(draft: DraftDoc): Finding[] {
  const first = draft.paragraphs[0];
  const sentence = first?.sentences[0];
  if (!first || !sentence) return [];
  const text = sentence.text.trim();
  if (!OPENING_THESIS.some((re) => re.test(text))) return [];
  return [
    finding(
      "openingThesis",
      "should",
      at(first.id, 0),
      `The essay opens with a statement about you ("${excerpt(text, 6)}") instead of a moment.`,
      "Stronger opening: start inside a scene with a real person in it.",
    ),
  ];
}

export function endingSummary(draft: DraftDoc): Finding[] {
  const last = draft.paragraphs.at(-1);
  if (!last || last.sentences.length === 0 || draft.paragraphs.length < 2) return [];
  const opener = last.sentences[0]?.text.trim() ?? "";
  const startsWithSummary = ENDING_OPENERS.some((re) => re.test(opener));
  const summaryLines = last.sentences.filter((s) =>
    SUMMARY_MARKERS.some((re) => re.test(s.text)),
  ).length;
  const dominated =
    summaryLines * 2 >= last.sentences.length && summaryLines >= 1 && last.sentences.length >= 2;
  if (!startsWithSummary && !dominated) return [];
  return [
    finding(
      "endingSummary",
      "should",
      at(last.id, startsWithSummary ? 0 : null),
      "The ending sums up the essay instead of landing on a moment.",
      "Stronger ending: close on an image or a next step that pays off the opening.",
    ),
  ];
}

/* weHiding (CRAFT-08) ------------------------------------------------------------------------ */

const WE = new Set(["we", "we're", "we've", "we'd", "we'll"]);
const I = new Set(["i", "i'm", "i've", "i'd", "i'll"]);

export function weHiding(draft: DraftDoc): Finding[] {
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    const tokens = p.sentences.flatMap((s) => wordTokens(withoutQuotedSpeech(s.text)));
    const we = tokens.filter((t) => WE.has(t)).length;
    const i = tokens.filter((t) => I.has(t)).length;
    if (we >= 2 && i === 0) {
      findings.push(
        finding(
          "weHiding",
          "should",
          at(p.id),
          `This paragraph says "we" ${we} times and never "I", so your own part is hidden.`,
          "Say what you did yourself, or cut the line.",
        ),
      );
    }
  }
  return findings;
}

/* tripletDensity (CRAFT-05, TELL-02) --------------------------------------------------------- */

const ITEM = "[\\p{L}\\p{N}'’-]+(?:\\s+[\\p{L}\\p{N}'’-]+){0,2}";
const TRIPLET = new RegExp(`(${ITEM}),\\s+(${ITEM}),?\\s+(?:and|or)\\s+(${ITEM})`, "gu");
const SUBJECT = /^(?:i|we|he|she|they|you|it|my|our|his|her|their)\b/iu;

/**
 * "A, B, and C" and "A, B and C" lists of one-to-three-word items. A clause boundary that only
 * looks like a list ("When I arrived, the team and I sat down") is rejected when the second or
 * third item starts with a subject pronoun or possessive.
 */
export function countTriplets(text: string): number {
  let n = 0;
  for (const m of text.matchAll(TRIPLET)) {
    const second = m[2] ?? "";
    const third = m[3] ?? "";
    if (SUBJECT.test(second) || SUBJECT.test(third)) continue;
    n += 1;
  }
  return n;
}

export function tripletDensity(draft: DraftDoc): Finding[] {
  const words = countWords(draftText(draft));
  const perParagraph = draft.paragraphs.map((p) =>
    p.sentences.reduce((n, s) => n + countTriplets(s.text), 0),
  );
  const total = perParagraph.reduce((a, b) => a + b, 0);
  if (total < 2) return [];
  const withTriplets = perParagraph.filter((n) => n > 0).length;
  const tooDense = total > Math.max(1, words / 150);
  const inMost = draft.paragraphs.length >= 2 && withTriplets * 2 > draft.paragraphs.length;
  if (!tooDense && !inMost) return [];
  const firstIndex = perParagraph.findIndex((n) => n > 0);
  return [
    finding(
      "tripletDensity",
      "consider",
      at(draft.paragraphs[firstIndex]?.id ?? null),
      `There are ${total} three-part lists in ${words} words, a pattern that reads as generated.`,
      "Keep the strongest list; give the others one specific item.",
    ),
  ];
}

/* rhythm (CRAFT-04, TELL-02) ----------------------------------------------------------------- */

export const RHYTHM_MIN_CV = 0.35;
const RHYTHM_MIN_SENTENCES = 5;

export function sentenceLengthCV(draft: DraftDoc): { cv: number; mean: number; sentences: number } {
  const lengths = sentencesOf(draft)
    .map((s) => countWords(s.text))
    .filter((n) => n > 0);
  if (lengths.length === 0) return { cv: 0, mean: 0, sentences: 0 };
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length;
  return { cv: mean > 0 ? Math.sqrt(variance) / mean : 0, mean, sentences: lengths.length };
}

export function rhythm(draft: DraftDoc): Finding[] {
  const { cv, mean, sentences } = sentenceLengthCV(draft);
  if (sentences < RHYTHM_MIN_SENTENCES || cv >= RHYTHM_MIN_CV) return [];
  return [
    finding(
      "rhythm",
      "consider",
      at(null),
      `Most sentences are close to ${Math.round(mean)} words long, so the rhythm feels flat.`,
      "Let a short line of four to eight words do the turning.",
    ),
  ];
}

/* dashDensity (TELL-02) ---------------------------------------------------------------------- */

/** Em dashes, plus spaced en dashes and double hyphens used as em dashes. */
export function countDashes(text: string): number {
  return (text.match(/—|\s–\s|\s--\s/g) ?? []).length;
}

/** More than one per 100 words. A single dash is never flagged, however short the answer. */
export function dashDensity(draft: DraftDoc): Finding[] {
  const text = draftText(draft);
  const dashes = countDashes(text);
  const words = countWords(text);
  if (dashes <= Math.max(1, words / 100)) return [];
  return [
    finding(
      "dashDensity",
      "consider",
      at(null),
      `There are ${dashes} dashes in ${words} words; heavy dash use reads as generated.`,
      "Turn most of them into full stops or commas.",
    ),
  ];
}

/* contextRatio (CRAFT-09) -------------------------------------------------------------------- */

export const CONTEXT_MAX_SHARE = 0.15;

const ACTION_VERB =
  "(?:\\w+ed|said|told|took|made|went|ran|wrote|built|called|asked|left|sat|stood|began|got|put|found|gave|brought|drove|walked|flew|kept|sent|spent|cut|led|met|quit|chose|did|grabbed|opened|shut|hung|stayed|picked|heard|saw|knew|thought|felt|rang|broke|caught|threw)";
const ACTION_PATTERNS: RegExp[] = [
  new RegExp(`(?<![\\p{L}])I\\s+(?:\\p{L}+ly\\s+)?${ACTION_VERB}\\b`, "u"),
  /"[^"]{3,}"|“[^”]{3,}”/u,
  /^(?:at\s+\d|on\s+(?:my|the|a)\s+(?:first|last|second)\s+(?:day|night|morning|week)|that\s+(?:night|morning|evening|afternoon)|the\s+(?:next|following)\s+(?:day|morning|week)|one\s+(?:night|morning|evening|afternoon))\b/iu,
];

/**
 * Index (in reading order) of the first sentence where the story moves. The Critic's tag wins;
 * otherwise the first sentence that has the applicant acting in the past tense, dialogue, or a
 * scene-setting time marker. Null when no sentence looks like action, in which case the linter
 * stays quiet rather than guess.
 */
export function firstActionIndex(draft: DraftDoc, ctx: LintContext = {}): number | null {
  const sentences = sentencesOf(draft);
  const tag = ctx.firstActionSentence;
  if (tag) {
    const i = sentences.findIndex(
      (s) => s.paragraphId === tag.paragraph_id && s.index === tag.sentence,
    );
    if (i >= 0) return i;
  }
  const i = sentences.findIndex((s) => ACTION_PATTERNS.some((re) => re.test(s.text.trim())));
  return i >= 0 ? i : null;
}

export function contextRatio(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const index = firstActionIndex(draft, ctx);
  if (index === null || index === 0) return [];
  const sentences = sentencesOf(draft);
  const total = sentences.reduce((n, s) => n + countWords(s.text), 0);
  const before = sentences.slice(0, index).reduce((n, s) => n + countWords(s.text), 0);
  if (total === 0 || before / total <= CONTEXT_MAX_SHARE) return [];
  const action = sentences[index];
  return [
    finding(
      "contextRatio",
      "should",
      at(action?.paragraphId ?? null, action?.index ?? null),
      `${Math.round((before / total) * 100)}% of the essay is background before the story starts moving.`,
      "Cut the setup to a line or two and start closer to this moment.",
    ),
  ];
}

/* jargon (CRAFT-19) -------------------------------------------------------------------------- */

/** Explained when the first use sits next to a parenthetical: "key results (OKRs)" or "OKR (objective…)". */
function explained(text: string, index: number, length: number): boolean {
  const before = text.slice(Math.max(0, index - 1), index);
  const after = text.slice(index + length, index + length + 3);
  return before === "(" || /^s?\s?\(/.test(after);
}

export function jargon(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const terms = [...JARGON_ACRONYMS, ...(ctx.jargonTerms ?? [])];
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const s of sentencesOf(draft)) {
    for (const term of terms) {
      if (seen.has(term)) continue;
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}&/])${escapeRegExp(term)}s?(?![\\p{L}\\p{N}&/])`,
        "u",
      );
      const m = re.exec(s.text);
      if (!m) continue;
      seen.add(term);
      if (explained(s.text, m.index, term.length)) continue;
      findings.push(
        finding(
          "jargon",
          "consider",
          at(s.paragraphId, s.index),
          `"${term}" may not mean anything to a reader outside your field.`,
          "Spell it out once, or describe the thing itself.",
        ),
      );
    }
  }
  return findings;
}
