// A word-level diff for the review table's "current vs proposed" column. Plain TS, unit-tested.

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

const MAX_TOKENS = 600;

function tokens(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/** Longest-common-subsequence diff over words and whitespace; whole-value swap when too long. */
export function wordDiff(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ kind: "same", text: before }] : [];
  const a = tokens(before);
  const b = tokens(after);
  if (a.length === 0) return [{ kind: "added", text: after }];
  if (b.length === 0) return [{ kind: "removed", text: before }];
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS)
    return [
      { kind: "removed", text: before },
      { kind: "added", text: after },
    ];
  // lcs[i][j]: length of the longest common subsequence of a[i..] and b[j..], flattened.
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  const at = (i: number, j: number): number => lcs[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      lcs[i * width + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string | undefined) => {
    if (text === undefined) return;
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  for (; i < a.length; i += 1) push("removed", a[i]);
  for (; j < b.length; j += 1) push("added", b[j]);
  return parts;
}

/** A pack value as the reviewer reads it: strings bare, everything else as indented JSON. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
