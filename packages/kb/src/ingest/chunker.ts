// Chunking for `kb_chunks` (spec §9.3: "chunk (≈600 tokens, 80 overlap)"; §8.9 retrieval). Chunks
// follow the text's own structure: paragraphs are kept whole when they fit, long ones are split at
// sentence ends, and only a single run-on sentence longer than a chunk is cut between words. Each
// chunk after the first opens with the last ~80 tokens of the one before, so a fact that straddles
// a boundary is retrievable from either side.
//
// Deterministic: the same text always yields the same chunks in the same order, so re-ingesting an
// unchanged source produces the same rows (and the refresh checker's hash comparison stays honest).
// Token counts use the dossier's estimator, which reads high on purpose.

import { estimateTokens } from "@admitstory/shared";

export interface Chunk {
  /** 0-based, in document order. */
  index: number;
  /** The overlap from the previous chunk (if any), then this chunk's own content. */
  text: string;
  tokenCount: number;
  /** Character offsets of this chunk's own content (not the overlap) in the input text. */
  start: number;
  end: number;
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

export const CHUNK_DEFAULTS = { targetTokens: 600, overlapTokens: 80 } as const;

interface Span {
  start: number;
  end: number;
}

/** Non-empty paragraphs (separated by blank lines), as trimmed spans of the input. */
function paragraphs(text: string): Span[] {
  const spans: Span[] = [];
  const separator = /\n[ \t]*\n\s*/g;
  let from = 0;
  const push = (start: number, end: number) => {
    const slice = text.slice(start, end);
    const lead = slice.length - slice.trimStart().length;
    const trail = slice.length - slice.trimEnd().length;
    if (start + lead < end - trail) spans.push({ start: start + lead, end: end - trail });
  };
  for (const match of text.matchAll(separator)) {
    push(from, match.index);
    from = match.index + match[0].length;
  }
  push(from, text.length);
  return spans;
}

/** Spans of `span` split by `pattern`'s matches (each match ends a piece). */
function splitBy(text: string, span: Span, pattern: RegExp): Span[] {
  const pieces: Span[] = [];
  const slice = text.slice(span.start, span.end);
  let from = 0;
  for (const match of slice.matchAll(pattern)) {
    const end = match.index + match[0].length;
    if (end > from) pieces.push({ start: span.start + from, end: span.start + end });
    from = end;
  }
  if (from < slice.length) pieces.push({ start: span.start + from, end: span.end });
  return pieces;
}

const SENTENCE_END = /[.!?…]+["'”’)\]]*\s+/g;
const WORD = /\S+\s*/g;

/** Break a span into units that each fit `target`: sentences, then words as a last resort. */
function units(text: string, span: Span, target: number): Span[] {
  if (estimateTokens(text.slice(span.start, span.end)) <= target) return [span];
  const out: Span[] = [];
  for (const sentence of splitBy(text, span, SENTENCE_END)) {
    if (estimateTokens(text.slice(sentence.start, sentence.end)) <= target) {
      out.push(sentence);
      continue;
    }
    // One sentence longer than a chunk: pack its words.
    let current: Span | undefined;
    for (const word of splitBy(text, sentence, WORD)) {
      if (current && estimateTokens(text.slice(current.start, word.end)) > target) {
        out.push(current);
        current = undefined;
      }
      current = current ? { start: current.start, end: word.end } : word;
    }
    if (current) out.push(current);
  }
  return out;
}

/** The last ~`budget` tokens of a span, starting on a word boundary. */
function tail(text: string, span: Span, budget: number): string {
  if (budget <= 0) return "";
  const words = splitBy(text, span, WORD);
  let start = span.end;
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (!word) break;
    if (estimateTokens(text.slice(word.start, span.end)) > budget) break;
    start = word.start;
  }
  return text.slice(start, span.end).trim();
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const target = options.targetTokens ?? CHUNK_DEFAULTS.targetTokens;
  const overlap = options.overlapTokens ?? CHUNK_DEFAULTS.overlapTokens;
  if (overlap >= target - 1) throw new Error("Chunk overlap must be smaller than the chunk");
  // Leave room for the overlap and the blank line after it (a newline pair costs a token), so a
  // chunk with its overlap never exceeds the target.
  const budget = target - overlap - 1;

  const groups: Span[] = [];
  let current: Span | undefined;
  for (const paragraph of paragraphs(text)) {
    for (const unit of units(text, paragraph, budget)) {
      if (current && estimateTokens(text.slice(current.start, unit.end)) > budget) {
        groups.push(current);
        current = undefined;
      }
      current = current ? { start: current.start, end: unit.end } : unit;
    }
  }
  if (current) groups.push(current);
  // Sentence and word pieces carry their trailing whitespace; a chunk's span doesn't.
  for (const group of groups) {
    const own = text.slice(group.start, group.end);
    group.end -= own.length - own.trimEnd().length;
  }

  return groups.map((group, index) => {
    const own = text.slice(group.start, group.end);
    const previous = groups[index - 1];
    const lead = previous ? tail(text, previous, overlap) : "";
    const chunk = lead ? `${lead}\n\n${own}` : own;
    return {
      index,
      text: chunk,
      tokenCount: estimateTokens(chunk),
      start: group.start,
      end: group.end,
    };
  });
}
