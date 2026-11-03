// The recommender's voice profile (Phase 6 plan §3), measured from their own notes and dictation
// and nothing else: the applicant's essays and stories never go in, because the product never
// writes a letter for anyone. The profile only lets the portal assistant keep the recommender's
// own sentence length, register and way of opening (LOR-08). Pure, synchronous and deterministic.

import { countWords } from "../count";
import type { RecommenderVoice } from "./types";

/** Sentence bounds, tolerant of notes: end punctuation or a line break, whatever follows. */
const SENTENCE_SPLIT = /(?<=[.!?])["'”’)\]]*\s+|\n+/u;
const HAS_WORD = /[\p{L}\p{N}]/u;

/** n't, 're, 've, 'll, 'm, 'd, and the 's contractions that are not possessives. */
const CONTRACTION =
  /(?:\bcan|\bwon|\bain|n)['’]t\b|['’](?:re|ve|ll|m)\b|\b(?:i|he|she|we|they|you|it|that|there|who|what|here|let|this)['’](?:s|d)\b/iu;
const FIRST_PERSON = /\b(?:i|i['’](?:m|ve|ll|d)|me|my|mine|myself|we|us|our|ours)\b/iu;

/** Markers of a formal register, counted per sentence. */
const FORMAL = new Set(
  (
    "furthermore moreover thus hence therefore whom shall whilst regarding pursuant accordingly " +
    "notwithstanding nevertheless additionally consequently utilise utilized utilise utilize " +
    "endeavour endeavor commenced commence subsequently aforementioned herein hereby wherein " +
    "indeed utmost exemplary"
  ).split(" "),
);

const TIME_OPENER =
  /^(?:in|on|during|over|since|by|after|before|from|throughout)\b[^.!?]{0,40}?\b(?:\d{4}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december|month|months|year|years|week|weeks|day|days|quarter|quarters|semester|summer|winter|spring|autumn|fall)\b/iu;
const TIME_PHRASE_OPENER =
  /^(?:when|while|whenever|once|last|early|late|the (?:first|second|last) time|the (?:day|week|month|year)|two|three|four|five|six|seven|eight|nine|ten|a few|several|shortly|soon)\b/iu;
const PERSON_OPENER =
  /^(?:i|we|my|our|me|he|she|they|him|her|his|their|them|mr|mrs|ms|dr|prof|professor)\b/iu;

const round = (n: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
};

const EMPTY: RecommenderVoice = {
  sentences: 0,
  meanWords: 0,
  cv: 0,
  contractions: 0,
  firstPerson: 0,
  register: "plain",
  opener: "other",
  card: "",
};

function splitSentences(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const piece of text.split(SENTENCE_SPLIT)) {
      const sentence = piece.trim().replace(/^[-–—*•\d.)\s]+/u, "");
      if (sentence && HAS_WORD.test(sentence)) out.push(sentence);
    }
  }
  return out;
}

function formalWords(sentence: string): number {
  let n = 0;
  for (const word of sentence.toLowerCase().match(/[\p{L}]+/gu) ?? []) if (FORMAL.has(word)) n += 1;
  return n;
}

function openerOf(sentence: string): "time" | "person" | "other" {
  if (TIME_OPENER.test(sentence) || TIME_PHRASE_OPENER.test(sentence)) return "time";
  if (PERSON_OPENER.test(sentence)) return "person";
  return "other";
}

/** One line the assistant is given, as plain as the measurements behind it. */
function voiceCard(v: Omit<RecommenderVoice, "card">): string {
  const parts: string[] = [];
  const length = v.meanWords < 14 ? "short" : v.meanWords < 22 ? "medium-length" : "long";
  parts.push(`${length} sentences (about ${Math.round(v.meanWords)} words)`);
  if (v.cv < 0.25) parts.push("very even lengths");
  else if (v.cv > 0.55) parts.push("lengths that vary a lot");
  parts.push(v.register === "formal" ? "a formal register" : "a plain register");
  if (v.contractions >= 0.25) parts.push("contractions");
  else if (v.contractions <= 0.05) parts.push("no contractions");
  if (v.firstPerson >= 0.5) parts.push("first person");
  if (v.opener === "time") parts.push("often opening on a date or a moment");
  else if (v.opener === "person") parts.push("often opening on a person");
  const line = `They write ${parts.join(", ")}.`;
  return line.length <= 300 ? line : `${line.slice(0, 299).trimEnd()}.`;
}

/**
 * How the recommender writes, measured from their own notes: sentence count, mean sentence length
 * and its coefficient of variation, the share of sentences with a contraction and with a
 * first-person pronoun, their register, how they most often open a sentence, and one line of it
 * all for the assistant. Empty input gives zeros and an empty card.
 */
export function recommenderVoice(texts: readonly string[]): RecommenderVoice {
  const sentences = splitSentences(texts);
  if (sentences.length === 0) return { ...EMPTY };
  const lengths = sentences.map((s) => countWords(s));
  const words = lengths.reduce((a, n) => a + n, 0);
  if (words === 0) return { ...EMPTY };
  const mean = words / sentences.length;
  const variance = lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  let contractions = 0;
  let firstPerson = 0;
  let formal = 0;
  let time = 0;
  let person = 0;
  for (const sentence of sentences) {
    if (CONTRACTION.test(sentence)) contractions += 1;
    if (FIRST_PERSON.test(sentence)) firstPerson += 1;
    formal += formalWords(sentence);
    const opener = openerOf(sentence);
    if (opener === "time") time += 1;
    else if (opener === "person") person += 1;
  }
  const contractionShare = contractions / sentences.length;
  const firstPersonShare = firstPerson / sentences.length;
  // Two of the three formal signals: few contractions, long sentences, formal words.
  const formalSignals =
    (contractionShare < 0.1 ? 1 : 0) + (mean >= 20 ? 1 : 0) + (formal / words >= 0.01 ? 1 : 0);
  const timeShare = time / sentences.length;
  const personShare = person / sentences.length;
  // A habit needs a third of their sentences; a tie goes to the more distinctive time opener.
  const opener =
    timeShare >= 1 / 3 && timeShare >= personShare
      ? "time"
      : personShare >= 1 / 3
        ? "person"
        : "other";

  const measured = {
    sentences: sentences.length,
    meanWords: round(mean, 1),
    cv: round(cv, 2),
    contractions: round(contractionShare, 2),
    firstPerson: round(firstPersonShare, 2),
    register: (formalSignals >= 2 ? "formal" : "plain") as RecommenderVoice["register"],
    opener: opener as RecommenderVoice["opener"],
  };
  return { ...measured, card: voiceCard(measured) };
}
