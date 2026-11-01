// Field paths into a School Pack, for the KB Normalizer's field-level diffs (spec §9.3) and the
// admin review screen. The grammar:
//
//   application.essays[key=goals].limit.value     select an array entry by a field's value
//   academics.courses[id=K31].what_it_is          …including by K id (the stable way)
//   rounds[0].deadline                             by index (unstable across edits; avoid)
//   values.stated[+]                               append (only as the last segment)
//
// Selectors are preferred because indices shift when entries are added or removed between the
// time a proposal is made and the time it is reviewed.

export type PathSegment =
  | { kind: "prop"; name: string }
  | { kind: "index"; index: number }
  | { kind: "select"; field: string; value: string }
  | { kind: "append" };

export class FieldPathError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "FieldPathError";
  }
}

const TOKEN = /\.?([A-Za-z_][A-Za-z0-9_]*)|\[(\d+|\+|[A-Za-z_][A-Za-z0-9_]*=[^\]]+)\]/y;

export function parseFieldPath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let at = 0;
  while (at < path.length) {
    TOKEN.lastIndex = at;
    const match = TOKEN.exec(path);
    const dotted = match?.[0].startsWith(".") ?? false;
    if (!match || (at === 0 && dotted) || (at > 0 && match[1] !== undefined && !dotted))
      throw new FieldPathError(`Bad field path at ${at}: ${path}`);
    const [whole, name, bracket] = match;
    if (name !== undefined) segments.push({ kind: "prop", name });
    else if (bracket === "+") segments.push({ kind: "append" });
    else if (bracket !== undefined && /^\d+$/.test(bracket))
      segments.push({ kind: "index", index: Number(bracket) });
    else if (bracket !== undefined) {
      const eq = bracket.indexOf("=");
      segments.push({ kind: "select", field: bracket.slice(0, eq), value: bracket.slice(eq + 1) });
    }
    at += whole.length;
  }
  if (segments.length === 0) throw new FieldPathError("Empty field path");
  if (segments.slice(0, -1).some((s) => s.kind === "append"))
    throw new FieldPathError(`[+] may only end a path: ${path}`);
  return segments;
}

export function formatFieldPath(segments: readonly PathSegment[]): string {
  return segments
    .map((s, i) => {
      switch (s.kind) {
        case "prop":
          return i === 0 ? s.name : `.${s.name}`;
        case "index":
          return `[${s.index}]`;
        case "select":
          return `[${s.field}=${s.value}]`;
        case "append":
          return "[+]";
      }
    })
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The array index a selector or index segment picks, or -1. */
function pick(array: readonly unknown[], segment: PathSegment): number {
  if (segment.kind === "index") return segment.index < array.length ? segment.index : -1;
  if (segment.kind === "select")
    return array.findIndex(
      (entry) => isRecord(entry) && String(entry[segment.field]) === segment.value,
    );
  return -1;
}

export interface Located {
  /** The objects and arrays from the root down to the target's container, in order. */
  chain: unknown[];
  container: Record<string, unknown> | unknown[];
  /** Property name, or array index; for an append, the index the new entry will take. */
  key: string | number;
  value: unknown;
  /** The path with selectors resolved to indices, for grouping proposals on the same field. */
  canonical: string;
  append: boolean;
}

/** Walk to a path's target. Throws if a segment doesn't exist or doesn't fit the value's type. */
export function locate(root: unknown, path: string | readonly PathSegment[]): Located {
  const segments = typeof path === "string" ? parseFieldPath(path) : path;
  const chain: unknown[] = [];
  const canonical: PathSegment[] = [];
  let node: unknown = root;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as PathSegment;
    const last = i === segments.length - 1;
    chain.push(node);
    if (segment.kind === "prop") {
      if (!isRecord(node))
        throw new FieldPathError(`Not an object at ${formatFieldPath(canonical)}`);
      canonical.push(segment);
      if (last)
        return {
          chain,
          container: node,
          key: segment.name,
          value: node[segment.name],
          canonical: formatFieldPath(canonical),
          append: false,
        };
      node = node[segment.name];
      continue;
    }
    if (!Array.isArray(node))
      throw new FieldPathError(`Not a list at ${formatFieldPath(canonical)}`);
    if (segment.kind === "append") {
      canonical.push(segment);
      return {
        chain,
        container: node,
        key: node.length,
        value: undefined,
        canonical: formatFieldPath(canonical),
        append: true,
      };
    }
    const index = pick(node, segment);
    if (index < 0)
      throw new FieldPathError(
        `No entry ${formatFieldPath([segment])} at ${formatFieldPath(canonical)}`,
      );
    canonical.push({ kind: "index", index });
    if (last)
      return {
        chain,
        container: node,
        key: index,
        value: node[index],
        canonical: formatFieldPath(canonical),
        append: false,
      };
    node = node[index];
  }
  throw new FieldPathError("Unreachable");
}

/** The pattern of a path with every array position generalised: `rounds[0].notes[+]` → `rounds[].notes[]`. */
export function pathPattern(path: string): string {
  return path.replace(/\[[^\]]*\]/g, "[]");
}
