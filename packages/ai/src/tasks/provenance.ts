// Post-parse provenance checks for every output that carries draft sentences (spec §8.7): kit.draft,
// kit.shortform, draft.revise and draft.need_fill. The rules, each turned into a ValidationIssue so
// a violation gets the same single repair attempt as a schema failure (§8.4 step 6):
//
//   - every cited code exists in the material the call was given: the dossier snapshot's codes,
//     the compiled pack's K items, the retrieved chunks' codes (citableCodes, per layer);
//   - a composed sentence that makes a concrete claim (number, name, quote, date, school detail)
//     cites a source, and a verbatim/adapted sentence cites the words it uses (linters
//     checkProvenance; the ambiguous cases go to the app's classifier, not to a repair);
//   - a person is named only when may_name=yes (linters peopleNamed, inside checkProvenance);
//   - a school detail cites a verified K item of this cycle (linters unverifiedSchool);
//   - a verbatim sentence that cites a golden line reproduces that line.
//
// The dossier and pack are read from their compiled text (the L1/L2 layers), so the checks see
// exactly what the model saw.

import { checkProvenance, unverifiedSchool } from "@admitstory/linters";
import type { DraftDoc, Finding, PackItemRef, PersonRef } from "@admitstory/linters";
import { parseCode } from "@admitstory/shared";
import { citableCodes, unresolvedCites } from "@admitstory/shared/kit";
import type { ValidationIssue } from "../errors";
import type { TaskLayers } from "./define";

/* Reading the layers ------------------------------------------------------------------------- */

export interface DossierIndex {
  /** Golden lines by code: `lines: L001 "…" | L002 "…"` in the story blocks. */
  lines: Map<string, string>;
  people: PersonRef[];
}

const LINE_RE = /\b(L\d{3,6}) "((?:[^"\\]|\\.)*)"/g;
const PERSON_RE = /\b(P\d{1,6}) ([^(|\n]+?) \(([^;)]+); may_name=(yes|no)\)/g;

export function dossierIndex(dossier: string): DossierIndex {
  const lines = new Map<string, string>();
  const people = new Map<string, PersonRef>();
  for (const row of dossier.split("\n")) {
    const trimmed = row.trim();
    if (trimmed.startsWith("lines:"))
      for (const m of trimmed.matchAll(LINE_RE))
        if (m[1] && m[2] !== undefined) lines.set(m[1], m[2].replace(/\\"/g, '"'));
    if (trimmed.startsWith("people:") || trimmed.startsWith("ENGAGEMENT"))
      for (const m of trimmed.matchAll(PERSON_RE)) {
        const [, code, name, role] = m;
        if (!code || name === undefined || role === undefined) continue;
        people.set(code, {
          code,
          name: name.trim(),
          role: role.trim(),
          mayName: m[4] === "yes",
        });
      }
  }
  return { lines, people: [...people.values()] };
}

export interface PackIndex {
  /** "2026-27", from the compiled pack's header. */
  cycle: string | undefined;
  items: PackItemRef[];
  /** Names the pack lists (courses, centres, clubs, treks, events) for the school-detail check. */
  terms: string[];
}

const PACK_ITEM_RE = /^\s*(K\d{1,6})\b.*\[[a-z_]+ (\d{4}-\d{2}-\d{2})\]( stale)?/;
const PACK_TERM_RE = /^(K\d{1,6}) ([^:|\n]{3,80}?): /;

export function packIndex(
  pack: string,
  retrieval: readonly { id: string; verified_at: string | null }[] = [],
): PackIndex {
  const cycle = /\| cycle (\d{4}-\d{2})\b/.exec(pack)?.[1];
  const items: PackItemRef[] = [];
  const terms: string[] = [];
  for (const row of pack.split("\n")) {
    const item = PACK_ITEM_RE.exec(row);
    if (item?.[1] && item[2])
      items.push({
        code: item[1],
        verifiedAt: item[2],
        // A stale item is background only (kb compiler): never a valid source for a specific.
        cycle: item[3] ? "stale" : (cycle ?? ""),
      });
    // Named things only ("Operating in Uncertainty", "Tidewater Consulting Club"): a glossary word
    // like "Section" would otherwise make every "section" in an essay a school detail.
    const term = PACK_TERM_RE.exec(row.trim())?.[2]?.trim();
    if (term && /^\p{Lu}/u.test(term) && /\s/.test(term) && !/[\d,]/.test(term)) terms.push(term);
  }
  for (const chunk of retrieval)
    items.push({ code: chunk.id, verifiedAt: chunk.verified_at, cycle: cycle ?? "" });
  return { cycle, items, terms };
}

/** Everything a draft-like output may draw on, read once per check. */
export interface Material {
  known: Set<string>;
  dossier: DossierIndex;
  pack: PackIndex;
}

export function materialFor(
  layers: TaskLayers,
  retrieval: readonly { id: string; verified_at: string | null }[] = [],
  extra: { knownCodes?: Iterable<string>; dossierText?: string } = {},
): Material {
  const dossierText = [layers.dossier ?? "", extra.dossierText ?? ""].join("\n");
  const known = citableCodes({
    dossier: dossierText,
    schoolPack: layers.schoolPack,
    retrievalIds: retrieval.map((chunk) => chunk.id),
  });
  for (const code of extra.knownCodes ?? []) known.add(code);
  return {
    known,
    dossier: dossierIndex(dossierText),
    pack: packIndex(layers.schoolPack ?? "", retrieval),
  };
}

/* Checks ------------------------------------------------------------------------------------- */

/** Straight quotes, single spaces, no trailing punctuation, lower case: for verbatim matching. */
export function normaliseLine(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…,;:"']+$/u, "")
    .toLowerCase();
}

const MODEL_HINTS: Partial<Record<string, string>> = {
  unsupportedClaim:
    "Cite the F/S/L/K code it comes from. If nothing supports it, remove the claim or put a need at this point instead.",
  unsourcedOwnWords:
    "A verbatim or adapted sentence lists the codes of the applicant's words it uses; otherwise mark it composed.",
  personNamed: "This person may not be named (may_name=no): use their role instead.",
  unverifiedSchool:
    "Cite the verified K item for this school detail (not a stale one), or cut the detail.",
};

function findingIssues(findings: readonly Finding[], pathOf: (f: Finding) => string) {
  return findings
    .filter((f) => f.severity === "must")
    .map((f) => ({
      path: pathOf(f),
      message:
        `${f.rule_id}: ${f.explanation} ${MODEL_HINTS[f.rule_id] ?? f.fix_hint ?? ""}`.trim(),
    }));
}

/**
 * The provenance issues in a set of paragraphs. `path` prefixes every issue (e.g. "draft" or
 * "items.2"), and paragraph paths use their index in `doc.paragraphs`.
 */
export function draftProvenanceIssues(
  doc: DraftDoc,
  material: Material,
  path: string,
): ValidationIssue[] {
  const join = (rest: string) => (path === "" ? rest : `${path}.${rest}`);
  const indexOf = new Map(doc.paragraphs.map((p, i) => [p.id, i] as const));
  const at = (f: Finding) => {
    const p = f.location.paragraph_id === null ? undefined : indexOf.get(f.location.paragraph_id);
    if (p === undefined) return join("paragraphs");
    return join(
      f.location.sentence === null
        ? `paragraphs.${p}`
        : `paragraphs.${p}.sentences.${f.location.sentence}`,
    );
  };

  const issues: ValidationIssue[] = unresolvedCites(
    { paragraphs: doc.paragraphs },
    material.known,
  ).map((issue) => ({ ...issue, path: join(issue.path) }));

  const ctx = {
    people: material.dossier.people,
    packItems: material.pack.items,
    schoolTerms: material.pack.terms,
    ...(material.pack.cycle ? { currentCycle: material.pack.cycle } : {}),
  };
  issues.push(...findingIssues(checkProvenance(doc, ctx).findings, at));
  issues.push(...findingIssues(unverifiedSchool(doc, ctx), at));

  doc.paragraphs.forEach((paragraph, p) => {
    paragraph.sentences.forEach((sentence, s) => {
      if (sentence.kind !== "verbatim") return;
      const where = join(`paragraphs.${p}.sentences.${s}`);
      const own = sentence.sources.filter((code) => {
        const kind = parseCode(code)?.kind;
        return kind === "line" || kind === "conversation";
      });
      if (own.length === 0) {
        issues.push({
          path: where,
          message:
            "A verbatim sentence cites the golden line (L###) or conversation (C#) it is taken from; otherwise mark it adapted or composed.",
        });
        return;
      }
      const lines = own
        .filter((code) => parseCode(code)?.kind === "line")
        .map((code) => material.dossier.lines.get(code))
        .filter((line): line is string => line !== undefined);
      if (lines.length > 0 && !lines.some((l) => normaliseLine(l) === normaliseLine(sentence.text)))
        issues.push({
          path: where,
          message: `Marked verbatim but does not reproduce the golden line it cites (${own.join(", ")}). Use the line word for word, or mark the sentence adapted.`,
        });
    });
  });
  return issues;
}

/** Paragraph ids are unique within a draft (§8.6 patches address them). */
export function paragraphIdIssues(doc: DraftDoc, path: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  doc.paragraphs.forEach((p, i) => {
    if (seen.has(p.id))
      issues.push({
        path: `${path}.paragraphs.${i}.id`,
        message: `Duplicate paragraph id "${p.id}"`,
      });
    seen.add(p.id);
  });
  return issues;
}

/** Needs point at a paragraph and sentence that exist. */
export function needIssues(
  doc: DraftDoc,
  needs: readonly { paragraph_id: string; after_sentence: number }[],
  path: string,
): ValidationIssue[] {
  const sizes = new Map(doc.paragraphs.map((p) => [p.id, p.sentences.length] as const));
  const issues: ValidationIssue[] = [];
  needs.forEach((need, i) => {
    const size = sizes.get(need.paragraph_id);
    if (size === undefined)
      issues.push({
        path: `${path}.${i}.paragraph_id`,
        message: `No paragraph "${need.paragraph_id}"`,
      });
    else if (need.after_sentence >= size)
      issues.push({
        path: `${path}.${i}.after_sentence`,
        message: `Paragraph "${need.paragraph_id}" has ${size} sentence(s); after_sentence counts from 0`,
      });
  });
  return issues;
}
