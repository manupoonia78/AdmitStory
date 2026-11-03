// The hero's line, tidied in code (direction §4.2 step 4). Nothing goes to a model. Only fillers
// are removed ("um", "uh", "erm", "you know", "like," used as a filler, and a word said twice),
// the first letter is capitalised and a full stop added. Over 40 words, the first full sentence is
// kept. Every other word stays exactly as it was said: the caption promises "Nothing else changed."

import { FIRST_LINE_MAX_CHARS } from "@/lib/marketing/first-line";

export interface CleanLine {
  line: string;
  /** How many fillers were removed (a "you know" counts once). */
  removed: number;
}

const FILLERS = new Set(["um", "umm", "uh", "uhh", "uhm", "erm", "er", "hmm", "mm"]);
/** Words that are fine said twice ("had had", "that that"). */
const DOUBLES_ALLOWED = new Set(["had", "that"]);
const MAX_WORDS = 40;
const SENTENCE_END = /[.?!…]["'”’)]*$/;

/** The word without surrounding punctuation, lower-cased. */
function core(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}']+$/u, "");
}

/** Punctuation trailing a token ("," "." "?"). */
function trailing(token: string): string {
  return /[^\p{L}\p{N}']+$/u.exec(token)?.[0] ?? "";
}

/**
 * Tidies the word before a removed filler: a sentence end the filler carried moves onto it, and
 * a comma that only set the filler apart ("and, uh, the") goes with the filler.
 */
function carry(tokens: string[], punctuation: string) {
  if (tokens.length === 0) return;
  const last = tokens.length - 1;
  const previous = tokens[last] ?? "";
  const end = /[.?!…]/.exec(punctuation)?.[0];
  if (end) tokens[last] = previous.replace(/[,;:]+$/u, "") + end;
  else tokens[last] = previous.replace(/,$/u, "");
}

function removeFillers(words: readonly string[]): { tokens: string[]; removed: number } {
  const tokens: string[] = [];
  let removed = 0;
  for (let index = 0; index < words.length; index += 1) {
    const token = words[index] ?? "";
    const word = core(token);
    const next = words[index + 1];
    if (FILLERS.has(word)) {
      carry(tokens, trailing(token));
      removed += 1;
      continue;
    }
    // "you know," or ", you know": a filler only when commas set it apart.
    if (word === "you" && next !== undefined && core(next) === "know") {
      const setApart =
        trailing(next).startsWith(",") || trailing(tokens.at(-1) ?? "").endsWith(",");
      if (setApart) {
        carry(tokens, trailing(next));
        removed += 1;
        index += 1;
        continue;
      }
    }
    // "like," as a filler: only with its comma.
    if (word === "like" && trailing(token).startsWith(",") && tokens.length > 0) {
      carry(tokens, "");
      removed += 1;
      continue;
    }
    // "I I was": a word repeated straight away, with nothing between.
    if (
      next !== undefined &&
      word !== "" &&
      word === core(next) &&
      trailing(token) === "" &&
      !DOUBLES_ALLOWED.has(word)
    ) {
      removed += 1;
      continue;
    }
    tokens.push(token);
  }
  // A filler at the start can leave a stray comma on the new first word's predecessor; and a
  // removed filler can leave ", ," between words.
  return {
    tokens: tokens.filter((token) => token.length > 0 && !/^[,;:]+$/u.test(token)),
    removed,
  };
}

/** The first full sentence: a sentence end followed by a capital, or the end of the text. */
function firstSentence(tokens: readonly string[]): string[] {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const next = tokens[index + 1];
    if (SENTENCE_END.test(token) && (next === undefined || /^["'“‘(]?\p{Lu}/u.test(next))) {
      return tokens.slice(0, index + 1);
    }
  }
  return [...tokens];
}

/** Keeps whole words up to the limit, ending with an ellipsis when something was cut. */
function fitLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[,;:.]+$/u, "")}…`;
}

export function cleanSpokenLine(raw: string): CleanLine | null {
  const words = raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return null;
  const { tokens, removed } = removeFillers(words);
  if (tokens.every((token) => core(token) === "")) return null;
  const kept = tokens.length > MAX_WORDS ? firstSentence(tokens) : tokens;
  let line = kept.join(" ").replace(/^[,;:\s]+/u, "");
  // Capitalise the first letter (after any opening quote).
  line = line.replace(
    /^(["'“‘(]?)(\p{Ll})/u,
    (_, quote: string, letter: string) => quote + letter.toUpperCase(),
  );
  if (!SENTENCE_END.test(line)) line = `${line.replace(/[,;:]+$/u, "")}.`;
  line = fitLength(line, FIRST_LINE_MAX_CHARS);
  return line.length > 1 ? { line, removed } : null;
}

/** A written line: trimmed and capped, with a full stop added if it has no ending. No filler step. */
export function cleanWrittenLine(raw: string): CleanLine | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!/[\p{L}\p{N}]/u.test(text)) return null;
  let line = text.replace(
    /^(["'“‘(]?)(\p{Ll})/u,
    (_, quote: string, letter: string) => quote + letter.toUpperCase(),
  );
  if (!SENTENCE_END.test(line)) line = `${line.replace(/[,;:]+$/u, "")}.`;
  return { line: fitLength(line, FIRST_LINE_MAX_CHARS), removed: 0 };
}
