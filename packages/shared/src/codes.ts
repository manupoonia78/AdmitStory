// Provenance codes (spec §8.7). Every citable thing an applicant's file is built from has a short,
// stable code: the model reads and writes these, never database uuids. The widths come from §8.7
// (`F##`, `S##`, `L###`, `P#`, `C#`, `K##`) and are minimums — a prolific applicant's 120th fact
// is `F120`, not an error.

export const CODE_KINDS = ["fact", "story", "line", "person", "conversation", "pack"] as const;

export type CodeKind = (typeof CODE_KINDS)[number];

interface CodeShape {
  prefix: string;
  /** Zero-padded to at least this many digits, so sorting by code matches sorting by number. */
  digits: number;
}

const SHAPES: Record<CodeKind, CodeShape> = {
  fact: { prefix: "F", digits: 2 },
  story: { prefix: "S", digits: 2 },
  line: { prefix: "L", digits: 3 },
  person: { prefix: "P", digits: 1 },
  conversation: { prefix: "C", digits: 1 },
  pack: { prefix: "K", digits: 2 },
};

const KIND_BY_PREFIX = new Map<string, CodeKind>(
  CODE_KINDS.map((kind) => [SHAPES[kind].prefix, kind] as const),
);

/** `code("story", 3)` → "S03". */
export function code(kind: CodeKind, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Code numbers start at 1, got ${n}`);
  const { prefix, digits } = SHAPES[kind];
  return `${prefix}${String(n).padStart(digits, "0")}`;
}

export interface ParsedCode {
  kind: CodeKind;
  n: number;
}

/** The kind and number in a code, or undefined if it is not one. Case-insensitive on the prefix. */
export function parseCode(value: string): ParsedCode | undefined {
  const match = /^([A-Za-z])(\d{1,6})$/.exec(value.trim());
  const [, prefix, digits] = match ?? [];
  if (prefix === undefined || digits === undefined) return undefined;
  const kind = KIND_BY_PREFIX.get(prefix.toUpperCase());
  if (!kind) return undefined;
  const n = Number(digits);
  return n >= 1 ? { kind, n } : undefined;
}

export function isCode(value: string, kind?: CodeKind): boolean {
  const parsed = parseCode(value);
  return parsed !== undefined && (kind === undefined || parsed.kind === kind);
}

/** The next free code of a kind, given the codes already in use. */
export function nextCode(kind: CodeKind, existing: Iterable<string>): string {
  let highest = 0;
  for (const value of existing) {
    const parsed = parseCode(value);
    if (parsed?.kind === kind && parsed.n > highest) highest = parsed.n;
  }
  return code(kind, highest + 1);
}

/** Codes in canonical order: by kind as listed in §8.7, then numerically. */
export function sortCodes(codes: readonly string[]): string[] {
  return [...codes].sort((a, b) => {
    const left = parseCode(a);
    const right = parseCode(b);
    if (!left || !right) return a.localeCompare(b);
    const byKind = CODE_KINDS.indexOf(left.kind) - CODE_KINDS.indexOf(right.kind);
    return byKind !== 0 ? byKind : left.n - right.n;
  });
}
