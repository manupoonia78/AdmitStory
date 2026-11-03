// The golden set's invented-fact checker (spec §8.11, §16 Phase 4 AC: "zero invented facts across
// the golden set"). Deterministic: it takes the sentences a kit agent wrote and reports every
// number, name, quote, date or school detail that cannot be traced to the fixture's ground truth
// (and profile), the school pack, or other material the call was given (retrieved chunks, the
// applicant's NEED answers). It does not judge whether a claim is cited; the provenance checks do
// that. It judges whether the claim is true to the material at all.
//
// Deliberately conservative in what counts as traced: a number must appear as a number (digits or
// words) somewhere in the material, a name as a capitalised word, a quote as a phrase. A paraphrase
// of a fact passes; a new number, name or quote does not.

import { findSchoolTerms } from "@admitstory/linters";
import type { FixtureProfile, GroundTruth } from "./types";

export type InventedKind = "number" | "name" | "quote" | "date" | "school_detail";

export interface InventedFact {
  kind: InventedKind;
  /** The claim as written in the draft. */
  text: string;
  sentence: string;
}

export interface GoldenMaterial {
  truth: GroundTruth;
  /** The compiled pack the call ran against. */
  pack: string;
  profile?: FixtureProfile;
  /** Anything else the call was given: retrieved chunk texts, NEED answers. */
  extra?: readonly string[];
}

/* Normalising -------------------------------------------------------------------------------- */

const UNITS: Record<string, number> = {
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
  dozen: 12,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};
const SPELLED = new RegExp(
  `(?<![\\p{L}])(?:(${Object.keys(TENS).join("|")})(?:[-\\s](${Object.keys(UNITS).join("|")}))?|(${Object.keys(UNITS).join("|")}))(?![\\p{L}])`,
  "giu",
);
const DIGITS = /(?<![\p{L}\d.])\d[\d,]*(?:\.\d+)?/gu;

function canonicalNumber(raw: string): string {
  const plain = raw.replace(/,/g, "");
  const n = Number(plain);
  return Number.isFinite(n) ? String(n) : plain;
}

/** Every number in a text, as canonical strings ("1,100" → "1100", "fourteen" → "14"). */
export function numbersIn(text: string): { raw: string; value: string }[] {
  const found: { raw: string; value: string }[] = [];
  for (const m of text.matchAll(DIGITS))
    found.push({
      raw: m[0].replace(/[,.]$/, ""),
      value: canonicalNumber(m[0].replace(/[,.]$/, "")),
    });
  for (const m of text.matchAll(SPELLED)) {
    const tens = m[1] ? (TENS[m[1].toLowerCase()] ?? 0) : 0;
    const unit = m[2]
      ? (UNITS[m[2].toLowerCase()] ?? 0)
      : m[3]
        ? (UNITS[m[3].toLowerCase()] ?? 0)
        : 0;
    found.push({ raw: m[0], value: String(tens + unit) });
  }
  return found;
}

const phrase = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}%$'.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DATE_WORD = new RegExp(
  `(?<![\\p{L}])(?:${[...MONTHS, ...DAYS].join("|")})s?(?![\\p{L}])`,
  "giu",
);

/** Capitalised words that are never a claim about the applicant. */
const NOT_NAMES = new Set([
  "I",
  "I'm",
  "I've",
  "I'd",
  "I'll",
  "MBA",
  "GMAT",
  "GRE",
  "AI",
  "CEO",
  "OK",
  "IT",
  "US",
  "UK",
]);

const CAPITALISED = /(?<![\p{L}\p{N}'’-])\p{Lu}[\p{L}'’-]*/gu;
const QUOTED = /"([^"]{2,})"|“([^”]{2,})”/gu;

/* The material --------------------------------------------------------------------------------- */

export interface GoldenCorpus {
  phrase: string;
  numbers: Set<string>;
  /** Words that appear capitalised somewhere in the material, lower-cased. */
  capitalised: Set<string>;
  words: Set<string>;
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

export function goldenCorpus(material: GoldenMaterial): GoldenCorpus {
  const texts = [
    ...stringsIn(material.truth),
    ...stringsIn(material.profile ?? {}),
    material.pack,
    ...(material.extra ?? []),
  ];
  const all = texts.join("\n");
  const capitalised = new Set<string>();
  for (const m of all.matchAll(CAPITALISED))
    capitalised.add(m[0].toLowerCase().replace(/[’]/g, "'"));
  return {
    phrase: phrase(all),
    numbers: new Set(numbersIn(all).map((n) => n.value)),
    capitalised,
    words: new Set(phrase(all).trim().split(" ")),
  };
}

/* The check ------------------------------------------------------------------------------------ */

/** Indexes of capitalised words that are at a sentence start (or after an opening quote or colon). */
function sentenceStarts(text: string): Set<number> {
  const starts = new Set<number>();
  for (const m of text.matchAll(/(?:^|[.!?:;]\s+|["“(]\s*)(\p{Lu})/gu))
    starts.add(m.index + m[0].length - 1);
  return starts;
}

/** The invented facts in one sentence. */
export function inventedInSentence(sentence: string, corpus: GoldenCorpus): InventedFact[] {
  const found: InventedFact[] = [];
  const add = (kind: InventedKind, text: string) => {
    if (!found.some((f) => f.kind === kind && f.text === text))
      found.push({ kind, text, sentence });
  };

  for (const n of numbersIn(sentence)) if (!corpus.numbers.has(n.value)) add("number", n.raw);

  for (const m of sentence.matchAll(QUOTED)) {
    const quote = (m[1] ?? m[2] ?? "").trim();
    if (!corpus.phrase.includes(phrase(quote))) add("quote", quote);
  }

  for (const m of sentence.matchAll(DATE_WORD))
    if (
      !corpus.words.has(m[0].toLowerCase().replace(/s$/, "")) &&
      !corpus.words.has(m[0].toLowerCase())
    )
      add("date", m[0]);

  const starts = sentenceStarts(sentence);
  const dateWords = new Set([...MONTHS, ...DAYS]);
  for (const m of sentence.matchAll(CAPITALISED)) {
    const word = m[0].replace(/['’]s$/, "");
    if (starts.has(m.index) || NOT_NAMES.has(word)) continue;
    const lower = word.toLowerCase().replace(/[’]/g, "'");
    if (dateWords.has(lower.replace(/s$/, ""))) continue;
    if (!corpus.capitalised.has(lower)) add("name", word);
  }

  for (const term of findSchoolTerms(sentence))
    if (!corpus.phrase.includes(phrase(term.text))) add("school_detail", term.text);

  return found;
}

/**
 * Every sentence-like text in an agent's output: draft sentences, a goals statement, coach-mode
 * lines and questions, talking points. Keys that hold labels or reasons are skipped.
 */
export function outputSentences(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(outputSentences);
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own: string[] = [];
  if (
    typeof record.text === "string" &&
    ["kind", "source", "sources", "k_ids"].some((key) => key in record)
  )
    own.push(record.text);
  return [
    ...own,
    ...Object.entries(record)
      .filter(([key]) => key !== "text")
      .flatMap(([, child]) => outputSentences(child)),
  ];
}

/** The invented facts across an output (or a list of sentences). Empty means the draft is clean. */
export function inventedFacts(
  output: unknown,
  material: GoldenMaterial | GoldenCorpus,
): InventedFact[] {
  const corpus = "phrase" in material ? material : goldenCorpus(material);
  const sentences =
    Array.isArray(output) && output.every((s) => typeof s === "string")
      ? (output as string[])
      : outputSentences(output);
  return sentences.flatMap((sentence) => inventedInSentence(sentence, corpus));
}
