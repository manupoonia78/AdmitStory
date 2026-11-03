// Every citable node in a pack, found structurally: any object with an `id` and a `source_ids`
// array is an Item or a cited record (types.ts). The schema's integrity checks, the proposals
// model, the publish gate and the freshness helpers all need "every K id in this pack", and one
// walker keeps them agreeing on what that means.

import { code, parseCode } from "@admitstory/shared";

export interface CitedNode {
  id: string;
  /** Where it sits, e.g. `application.essays[2].notes[0]`. Index paths, for messages and spans. */
  path: string;
  /** The top-level section: `application`, `academics`, `rounds`… */
  section: string;
  sourceIds: string[];
  verifiedAt: string | null;
  node: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCitedNode(value: unknown): value is Record<string, unknown> & {
  id: string;
  source_ids: string[];
} {
  return isRecord(value) && typeof value.id === "string" && Array.isArray(value.source_ids);
}

/** Depth-first, in document order, so the result is stable for a given pack. */
export function citedNodes(pack: unknown): CitedNode[] {
  const out: CitedNode[] = [];
  const visit = (value: unknown, path: string, section: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, section));
      return;
    }
    if (!isRecord(value)) return;
    if (isCitedNode(value)) {
      out.push({
        id: value.id,
        path,
        section,
        sourceIds: value.source_ids.filter((s): s is string => typeof s === "string"),
        verifiedAt: typeof value.verified_at === "string" ? value.verified_at : null,
        node: value,
      });
    }
    for (const [key, child] of Object.entries(value)) {
      // `sources` are what nodes cite, not cited nodes themselves.
      if (path === "" && (key === "sources" || key === "school")) continue;
      visit(child, path === "" ? key : `${path}.${key}`, section === "" ? key : section);
    }
  };
  visit(pack, "", "");
  return out;
}

/** The number in a canonical pack K id ("K07", "K112"), or undefined if `id` isn't one. */
export function packIdNumber(id: string): number | undefined {
  const parsed = parseCode(id);
  return parsed?.kind === "pack" && code("pack", parsed.n) === id ? parsed.n : undefined;
}
