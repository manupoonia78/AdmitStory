// Rules on agent output that a JSON Schema cannot express, checked in code after parsing (spec
// §8.4 step 6, §8.7). The AI layer turns a non-empty result into one repair attempt; the app can
// re-run the same functions when a user edits a file map. Pure and Zod-free.

import { parseCode, type CodeKind } from "../codes";
import { LEAD_TRAITS_MIN, type FileMap, type Positioning } from "./types";

/** Same shape as the AI layer's ValidationIssue, so issues pass straight into a repair turn. */
export interface RuleIssue {
  path: string;
  message: string;
}

const CODE_IN_TEXT = /\b[FSLPCK]\d{1,6}\b/g;

/** Every provenance code written anywhere in a text (a compact dossier, a compiled pack). */
export function codesIn(text: string): Set<string> {
  return new Set(text.match(CODE_IN_TEXT) ?? []);
}

/**
 * The stories a compact dossier actually contains: the codes that head a story block
 * (`S03 "The night-shift fix" | ...`). A withheld story (no consent, §8.7) never gets a block,
 * so a story code missing from this set is either withheld, trimmed for budget, or invented.
 */
export function dossierStoryCodes(dossier: string): Set<string> {
  return new Set([...dossier.matchAll(/^(S\d{1,6}) "/gm)].map((match) => match[1] as string));
}

/**
 * The brand traits a compact dossier states, from its `BRAND  trait (S07,S11) | ...` line. Empty
 * when the Consolidator has not set a brand yet.
 */
export function dossierBrandTraits(dossier: string): Set<string> {
  const line = /^BRAND {2}(.*)$/m.exec(dossier)?.[1] ?? "";
  return new Set(
    line
      .split("|")
      .map((part) => part.trim().split(/\s|\(/)[0] ?? "")
      .filter((trait) => trait !== ""),
  );
}

/**
 * The codes a model may cite from the material it was given: the applicant's codes from the compact
 * dossier, the school's K codes from the compiled pack and the retrieved chunks. Each kind comes
 * only from its own layer, and a story resolves only where the dossier has its block, so a withheld
 * story's code never resolves even if it is mentioned elsewhere.
 */
export function citableCodes(material: {
  dossier?: string | undefined;
  schoolPack?: string | undefined;
  retrievalIds?: readonly string[];
}): Set<string> {
  const known = new Set<string>();
  for (const code of codesIn(material.dossier ?? "")) {
    const kind = parseCode(code)?.kind;
    if (kind !== "pack" && kind !== "story") known.add(code);
  }
  for (const code of dossierStoryCodes(material.dossier ?? "")) known.add(code);
  for (const code of codesIn(material.schoolPack ?? ""))
    if (parseCode(code)?.kind === "pack") known.add(code);
  for (const id of material.retrievalIds ?? []) known.add(id);
  return known;
}

/** Keys whose values are provenance codes, in every Appendix I and Phase 3 output shape. */
const CITE_KEYS = new Set(["cites", "sources", "source", "k_ids", "conflicts_with"]);

export interface FoundCite {
  path: string;
  code: string;
}

/** Walks an output and returns every code under a cite-bearing key, with its path. */
export function citesIn(value: unknown, path = ""): FoundCite[] {
  const join = (key: string | number) => (path === "" ? String(key) : `${path}.${key}`);
  if (Array.isArray(value)) return value.flatMap((item, index) => citesIn(item, join(index)));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (!CITE_KEYS.has(key)) return citesIn(child, join(key));
    if (typeof child === "string") return [{ path: join(key), code: child }];
    if (Array.isArray(child))
      return child.flatMap((code, index) =>
        typeof code === "string" ? [{ path: `${join(key)}.${index}`, code }] : [],
      );
    return [];
  });
}

/**
 * Citations that point at nothing the model was given. `kinds` limits which code kinds may be
 * cited at all (Profile Read cites the applicant's material, School Fit only the pack).
 */
export function unresolvedCites(
  value: unknown,
  known: ReadonlySet<string>,
  kinds?: readonly CodeKind[],
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const { path, code } of citesIn(value)) {
    const parsed = parseCode(code);
    if (kinds && parsed && !kinds.includes(parsed.kind)) {
      issues.push({
        path,
        message: `${code} is not a citable kind here (allowed: ${kinds.join(", ")})`,
      });
    } else if (!known.has(code)) {
      issues.push({ path, message: `${code} does not exist in the material provided` });
    }
  }
  return issues;
}

/** Profile Read and School Strategy never give odds or scores (§5.4, §14.5). */
const ODDS = [
  /\b\d{1,3}\s?%\s*(chance|odds|likelihood|probability)/i,
  /\b(chance|odds|likelihood|probability)\s+of\s+(admission|admit|getting\s+in)/i,
  /\b\d{1,3}\s*(\/|out of)\s*100\b/i,
];

export function oddsLanguage(value: unknown, path = ""): RuleIssue[] {
  const join = (key: string | number) => (path === "" ? String(key) : `${path}.${key}`);
  if (typeof value === "string")
    return ODDS.some((pattern) => pattern.test(value))
      ? [{ path, message: "No admission odds or scores out of 100; describe evidence instead" }]
      : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => oddsLanguage(item, join(index)));
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, child]) => oddsLanguage(child, join(key)));
  return [];
}

/* Strategist rules (§8.5.5) ------------------------------------------------------------------- */

export interface FileMapRules {
  /** Stories present in the dossier snapshot (dossierStoryCodes). */
  storyCodes: ReadonlySet<string>;
  /** Every deliverable the school's application has; each must be mapped exactly once. */
  deliverableKeys: readonly string[];
  recommenderIds: readonly string[];
}

/**
 * The file map's hard rules: every deliverable mapped once; a story is primary in at most one
 * deliverable (FILE-02); only stories in the snapshot (consent, §8.7); a deliverable without a
 * primary story says why; recommenders are the applicant's.
 */
export function fileMapIssues(fileMap: FileMap, rules: FileMapRules): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const keys = new Set(rules.deliverableKeys);
  const recommenders = new Set(rules.recommenderIds);
  const seen = new Map<string, number>();
  const primaryAt = new Map<string, string>();

  const storyIssue = (path: string, code: string) => {
    if (!rules.storyCodes.has(code))
      issues.push({
        path,
        message: `${code} is not a story in the dossier snapshot; plan only stories it contains (withheld and sensitive stories without consent are never planned)`,
      });
  };

  fileMap.items.forEach((item, index) => {
    const path = `file_map.items.${index}`;
    if (!keys.has(item.deliverable_key))
      issues.push({
        path: `${path}.deliverable_key`,
        message: `Unknown deliverable "${item.deliverable_key}"`,
      });
    seen.set(item.deliverable_key, (seen.get(item.deliverable_key) ?? 0) + 1);

    if (item.primary_story === null) {
      if (!item.primary_reason_if_none?.trim())
        issues.push({
          path: `${path}.primary_reason_if_none`,
          message: "Say why no story leads this deliverable",
        });
    } else {
      storyIssue(`${path}.primary_story`, item.primary_story);
      const earlier = primaryAt.get(item.primary_story);
      if (earlier !== undefined)
        issues.push({
          path: `${path}.primary_story`,
          message: `${item.primary_story} is already primary in "${earlier}"; a story is primary in at most one deliverable (FILE-02)`,
        });
      else primaryAt.set(item.primary_story, item.deliverable_key);
      if (item.supporting.includes(item.primary_story))
        issues.push({
          path: `${path}.supporting`,
          message: "The primary story is not also a supporting story",
        });
    }
    item.supporting.forEach((code, i) => storyIssue(`${path}.supporting.${i}`, code));
  });

  for (const key of rules.deliverableKeys) {
    const count = seen.get(key) ?? 0;
    if (count !== 1)
      issues.push({
        path: "file_map.items",
        message:
          count === 0
            ? `Deliverable "${key}" is not mapped`
            : `Deliverable "${key}" is mapped ${count} times`,
      });
  }

  fileMap.recommender_plan.forEach((plan, index) => {
    const path = `file_map.recommender_plan.${index}`;
    if (!recommenders.has(plan.recommender_id))
      issues.push({
        path: `${path}.recommender_id`,
        message: `Unknown recommender "${plan.recommender_id}"`,
      });
    plan.stories.forEach((code, i) => storyIssue(`${path}.stories.${i}`, code));
  });

  return issues;
}

export interface PositioningRules {
  isReapplicant: boolean;
  /**
   * The dossier's brand traits (dossierBrandTraits). Lead traits must come from it only when it
   * has at least LEAD_TRAITS_MIN traits; a thinner brand could never satisfy both rules.
   */
  brandTraits?: ReadonlySet<string>;
}

/**
 * §8.5.5: must_see items cite the school (K), lead traits are the applicant's brand traits and
 * cite a story (S), and the reapplicant angle is present exactly when the applicant reapplies.
 */
export function positioningIssues(positioning: Positioning, rules: PositioningRules): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const cites = (codes: readonly string[], kind: CodeKind) =>
    codes.some((code) => parseCode(code)?.kind === kind);

  positioning.must_see.forEach((item, index) => {
    if (!cites(item.cites, "pack"))
      issues.push({
        path: `positioning.must_see.${index}.cites`,
        message: "Cite the school pack (a K code) for what this school needs to see",
      });
  });
  const brand = rules.brandTraits;
  positioning.lead_traits.forEach((lead, index) => {
    if (brand && brand.size >= LEAD_TRAITS_MIN && !brand.has(lead.trait))
      issues.push({
        path: `positioning.lead_traits.${index}.trait`,
        message: `${lead.trait} is not one of the applicant's brand traits`,
      });
    if (!cites(lead.cites, "story"))
      issues.push({
        path: `positioning.lead_traits.${index}.cites`,
        message: "Cite the story (an S code) that proves this trait",
      });
  });

  const angle = positioning.reapplicant_angle;
  if (rules.isReapplicant && !angle?.trim())
    issues.push({
      path: "positioning.reapplicant_angle",
      message: "The applicant is a reapplicant: say what has materially changed",
    });
  if (!rules.isReapplicant && angle !== null)
    issues.push({
      path: "positioning.reapplicant_angle",
      message: "Must be null: the applicant is not a reapplicant",
    });
  return issues;
}
