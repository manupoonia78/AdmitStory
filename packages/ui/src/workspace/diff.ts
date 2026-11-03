// Word-level diff for revisions (spec §5.8 Refine, §6.6 "Diffs morph"). A plain longest common
// subsequence over whitespace-separated words: paragraphs are short (a few hundred words at most),
// so the quadratic table is small, and trimming the shared start and end keeps it smaller still.

export type DiffKind = "same" | "removed" | "added";

export interface DiffToken {
  kind: DiffKind;
  /** One word, punctuation attached ("story,"). */
  text: string;
  /**
   * Stable across renders of the same pair: "b3" is word 3 of the old version (kept or removed),
   * "a5" word 5 of the new one (added). Animations key words by it.
   */
  key: string;
}

export interface DiffRun {
  kind: DiffKind;
  text: string;
}

/** Words of a text, in order, without the whitespace between them. */
export function tokenizeWords(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

/**
 * The edit from `before` to `after`, word by word. Within a change, removed words come before the
 * words that replace them, so the old wording reads first.
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const rows = a.length - head - tail;
  const cols = b.length - head - tail;
  // lcs[i][j]: length of the common subsequence of the middles from a[head+i] and b[head+j] on.
  const lcs = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    const row = lcs[i] as Uint16Array;
    const below = lcs[i + 1] as Uint16Array;
    for (let j = cols - 1; j >= 0; j -= 1) {
      row[j] =
        a[head + i] === b[head + j]
          ? (below[j + 1] as number) + 1
          : Math.max(below[j] as number, row[j + 1] as number);
    }
  }

  const at = (row: number, col: number) => (lcs[row] as Uint16Array)[col] as number;

  const tokens: DiffToken[] = [];
  const same = (ai: number) => tokens.push({ kind: "same", text: a[ai] as string, key: `b${ai}` });
  for (let i = 0; i < head; i += 1) same(i);

  // Walk forwards, holding added words back until the removed words of the same change are out.
  let i = 0;
  let j = 0;
  let added: DiffToken[] = [];
  const flushAdded = () => {
    tokens.push(...added);
    added = [];
  };
  while (i < rows || j < cols) {
    const ai = head + i;
    const bj = head + j;
    if (i < rows && j < cols && a[ai] === b[bj]) {
      flushAdded();
      same(ai);
      i += 1;
      j += 1;
    } else if (j >= cols || (i < rows && at(i + 1, j) >= at(i, j + 1))) {
      tokens.push({ kind: "removed", text: a[ai] as string, key: `b${ai}` });
      i += 1;
    } else {
      added.push({ kind: "added", text: b[bj] as string, key: `a${bj}` });
      j += 1;
    }
  }
  flushAdded();

  for (let k = 0; k < tail; k += 1) same(a.length - tail + k);
  return tokens;
}

/** Joins neighbouring words of the same kind, for screen reader text and summaries. */
export function diffRuns(tokens: readonly DiffToken[]): DiffRun[] {
  const runs: DiffRun[] = [];
  for (const token of tokens) {
    const last = runs.at(-1);
    if (last && last.kind === token.kind) last.text += ` ${token.text}`;
    else runs.push({ kind: token.kind, text: token.text });
  }
  return runs;
}

/** The text one side of the diff reads as: "before" drops added words, "after" drops removed. */
export function diffSide(tokens: readonly DiffToken[], side: "before" | "after"): string {
  const skip: DiffKind = side === "before" ? "added" : "removed";
  return tokens
    .filter((token) => token.kind !== skip)
    .map((token) => token.text)
    .join(" ");
}
