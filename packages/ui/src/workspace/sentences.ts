// Sentence splitting and counting for drafts (spec §5.8, §6.6). Pure, so streaming, the
// your-words view and the limit counter all agree on where a sentence or a word starts.

// Words that end in a full stop without ending the sentence. Lowercase, without the stop.
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "st",
  "mt",
  "jr",
  "sr",
  "vs",
  "no",
  "approx",
  "dept",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
]);

// Terminal punctuation, optional closing quotes or brackets, whitespace, then something that can
// start a sentence (a capital or a digit, perhaps after an opening quote).
const BOUNDARY = /[.!?…]+["'”’)\]]*(\s+)(?=["'“‘(\[]?[\p{Lu}\p{N}])/gu;

/** The word just before index `end`, without trailing punctuation, lowercased. */
function wordBefore(text: string, end: number): string {
  const word = /\S+$/u.exec(text.slice(0, end))?.[0] ?? "";
  return word
    .replace(/^["'“‘(\[]+/u, "")
    .replace(/[.!?…"'”’)\]]+$/u, "")
    .toLowerCase();
}

function isAbbreviation(word: string): boolean {
  // A single capital initial ("J. K. Rowling") or a listed abbreviation.
  return /^\p{L}$/u.test(word) || ABBREVIATIONS.has(word);
}

/**
 * Splits prose into sentences. A boundary is terminal punctuation followed by whitespace and a
 * capital or digit, so "2 a.m. and" stays one sentence while "2 a.m. The" splits, and titles such
 * as "Dr." never end one. Whitespace between sentences is dropped.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(BOUNDARY)) {
    const spaceAt = match.index + match[0].length - (match[1]?.length ?? 0);
    if (isAbbreviation(wordBefore(text, spaceAt))) continue;
    const sentence = text.slice(start, spaceAt).trim();
    if (sentence) sentences.push(sentence);
    start = match.index + match[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

export interface StreamedSentences {
  /** Sentences that can no longer change, in order. */
  complete: string[];
  /** The trailing fragment still arriving ("" when there is none). */
  pending: string;
}

/**
 * Separates the sentences of a stream that are finished from the one still arriving. The last
 * sentence counts as finished only once the next one has started or the stream is done: until
 * then "It was 2 a.m." could still continue "and the feed…".
 */
export function streamedSentences(text: string, done = false): StreamedSentences {
  const sentences = splitSentences(text);
  if (done || sentences.length === 0) {
    return { complete: sentences, pending: "" };
  }
  return { complete: sentences.slice(0, -1), pending: sentences.at(-1) ?? "" };
}

/**
 * Words as most application portals count them: runs of non-space characters that contain a
 * letter or digit. "night-shift" and "fix—and" are one word; a lone dash is none.
 */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/u)) {
    if (/[\p{L}\p{N}]/u.test(token)) count += 1;
  }
  return count;
}

/** Characters as people see them (an emoji or accented letter is one), with or without spaces. */
export function countCharacters(
  text: string,
  { spaces = true }: { spaces?: boolean } = {},
): number {
  const counted = spaces ? text : text.replace(/\s+/gu, "");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let count = 0;
  for (const _ of segmenter.segment(counted)) count += 1;
  return count;
}
