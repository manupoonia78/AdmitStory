// The KB Normalizer's output as field-level diffs, and what happens when an admin accepts them
// (spec §9.3: "propose pack updates as field-level diffs with source spans, confidence, and
// conflicts with current values ──► Admin review: accept / edit / reject each diff ──► Publish").
//
// Rules this module enforces in code:
//   - Conflicts: when sources disagree on a field, every candidate is shown with its trust.
//     `official` wins by default; when no single value has official backing the conflict is
//     unresolved, and an unresolved field is not changed (it "blocks publishing that field").
//   - An accepted proposal never silently overwrites a value backed by a more trusted source:
//     the admin must mark it `override`.
//   - A proposal made against a value that has since changed is refused (`current_changed`), so a
//     reviewer never approves a diff against something they didn't see.
//   - K ids are allocated from `k_high_water`, never reused, and never reach the retrieval range.
//   - The result is validated against the schema before it is returned.

import { code } from "@admitstory/shared";
import { FieldPathError, locate, parseFieldPath, pathPattern, type PathSegment } from "./paths";
import { SchoolPack as SchoolPackSchema } from "./schema/school-pack";
import {
  RETRIEVAL_CODE_BASE,
  type IsoDate,
  type KbSourceType,
  type PackSource,
  type SchoolPack,
} from "./types";
import { citedNodes, isCitedNode, packIdNumber } from "./walk";

export interface SourceSpan {
  /** Character offsets in the source's extracted text. */
  start: number;
  end: number;
  quote?: string;
}

/** One field-level diff, as the Normalizer proposes it and `kb_proposals` stores it. */
export interface PackProposal {
  field_path: string;
  /** For `remove`, ignored. New cited objects may omit `id`, `source_ids` and `verified_at`. */
  proposed: unknown;
  /** The value the Normalizer saw; checked against the pack when the proposal is applied. */
  current: unknown;
  /** 0–1. */
  confidence: number;
  source_id: string;
  source_span?: SourceSpan;
  /** Default: `add` when the path ends in `[+]`, otherwise `set`. */
  op?: "set" | "add" | "remove";
}

export interface AcceptedProposal extends PackProposal {
  /** The admin chose this over a more trusted current value. */
  override?: boolean;
}

/* Values ---------------------------------------------------------------------------------------- */

const METADATA_KEYS = new Set([
  "id",
  "source_ids",
  "verified_at",
  "confidence",
  "approved_rewrite",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stable JSON of a value's content: object keys sorted, provenance metadata dropped. */
function contentKey(value: unknown): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (!isRecord(v)) return v === undefined ? null : v;
    return Object.fromEntries(
      Object.keys(v)
        .filter((k) => !METADATA_KEYS.has(k) && v[k] !== undefined)
        .sort()
        .map((k) => [k, strip(v[k])]),
    );
  };
  return JSON.stringify(strip(value));
}

/** Same content, ignoring ids, sources, dates and confidence. `undefined` equals `null`. */
export function sameContent(a: unknown, b: unknown): boolean {
  return contentKey(a) === contentKey(b);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/* Trust ----------------------------------------------------------------------------------------- */

function sourceMap(pack: SchoolPack, extra: readonly PackSource[] = []): Map<string, PackSource> {
  return new Map([...pack.sources, ...extra].map((s) => [s.id, s] as const));
}

/** The nearest cited node at or above a located path (the record a leaf value belongs to). */
function nearestCited(
  chain: readonly unknown[],
  value: unknown,
): Record<string, unknown> | undefined {
  if (isCitedNode(value)) return value;
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    if (isCitedNode(node)) return node;
  }
  return undefined;
}

interface Backing {
  trust: number;
  sourceType: KbSourceType | null;
  sourceIds: string[];
}

function backingOf(
  node: Record<string, unknown> | undefined,
  sources: Map<string, PackSource>,
): Backing {
  const ids = node && Array.isArray(node.source_ids) ? (node.source_ids as string[]) : [];
  const known = ids.map((id) => sources.get(id)).filter((s): s is PackSource => s !== undefined);
  const best = [...known].sort((a, b) => b.trust - a.trust)[0];
  return { trust: best?.trust ?? 0, sourceType: best?.type ?? null, sourceIds: ids };
}

function opOf(proposal: PackProposal, segments: readonly PathSegment[]): "set" | "add" | "remove" {
  if (proposal.op) return proposal.op;
  return segments[segments.length - 1]?.kind === "append" ? "add" : "set";
}

/* Conflicts ------------------------------------------------------------------------------------- */

export interface ConflictCandidate {
  origin: "current" | "proposal";
  /** Index into the proposals passed in, for `origin: "proposal"`. */
  proposalIndex: number | null;
  value: unknown;
  sourceIds: string[];
  sourceType: KbSourceType | null;
  trust: number;
  confidence: number | null;
}

export interface FieldConflict {
  /** Canonical path (selectors resolved to indices against the current pack). */
  field_path: string;
  /** Most trusted first. */
  candidates: ConflictCandidate[];
  /** Index into `candidates` of the default choice: the one value backed by an official source. */
  defaultChoice: number | null;
  /** No default: the admin must choose, and until then the field doesn't change. */
  blocking: boolean;
}

/**
 * Fields where the current value and the proposals (or proposals among themselves) disagree.
 * Appends never conflict; proposals whose path doesn't resolve are skipped (applyProposals
 * reports them).
 */
export function detectConflicts(
  pack: SchoolPack,
  proposals: readonly PackProposal[],
  options: { sources?: readonly PackSource[] } = {},
): FieldConflict[] {
  const sources = sourceMap(pack, options.sources);
  const groups = new Map<
    string,
    { current: ConflictCandidate | null; proposed: ConflictCandidate[] }
  >();
  proposals.forEach((proposal, proposalIndex) => {
    let segments: PathSegment[];
    let located: ReturnType<typeof locate>;
    try {
      segments = parseFieldPath(proposal.field_path);
      located = locate(pack, segments);
    } catch {
      return;
    }
    if (located.append || opOf(proposal, segments) === "add") return;
    const group = groups.get(located.canonical) ?? { current: null, proposed: [] };
    if (!group.current && located.value !== undefined && located.value !== null) {
      const backing = backingOf(nearestCited(located.chain, located.value), sources);
      group.current = {
        origin: "current",
        proposalIndex: null,
        value: located.value,
        confidence: null,
        ...backing,
      };
    }
    const source = sources.get(proposal.source_id);
    group.proposed.push({
      origin: "proposal",
      proposalIndex,
      value: opOf(proposal, segments) === "remove" ? null : proposal.proposed,
      sourceIds: [proposal.source_id],
      sourceType: source?.type ?? null,
      trust: source?.trust ?? 0,
      confidence: proposal.confidence,
    });
    groups.set(located.canonical, group);
  });

  const conflicts: FieldConflict[] = [];
  for (const [field_path, group] of groups) {
    const candidates = [...(group.current ? [group.current] : []), ...group.proposed].sort(
      (a, b) => b.trust - a.trust || (b.confidence ?? 1) - (a.confidence ?? 1),
    );
    const distinct = new Set(candidates.map((c) => contentKey(c.value)));
    if (distinct.size < 2) continue;
    const officialValues = new Set(
      candidates.filter((c) => c.sourceType === "official").map((c) => contentKey(c.value)),
    );
    const defaultChoice =
      officialValues.size === 1 ? candidates.findIndex((c) => c.sourceType === "official") : null;
    conflicts.push({ field_path, candidates, defaultChoice, blocking: defaultChoice === null });
  }
  return conflicts;
}

/* K id allocation ------------------------------------------------------------------------------- */

/** The highest K number in use or ever allocated in this pack's lineage. */
export function packHighWater(pack: SchoolPack): number {
  let highest = pack.k_high_water ?? 0;
  for (const node of citedNodes(pack)) highest = Math.max(highest, packIdNumber(node.id) ?? 0);
  return highest;
}

/** The next K id this pack may use. Never a reused one, never in the retrieval range. */
export function nextPackId(pack: SchoolPack): string {
  const n = packHighWater(pack) + 1;
  if (n >= RETRIEVAL_CODE_BASE)
    throw new Error("This pack has used every K id below the retrieval range");
  return code("pack", n);
}

/*
 * Where cited objects live in a pack, as path patterns. A new object at one of these positions
 * gets a K id, the proposal's source and the verification date. Items (leaf `{text, …}` notes)
 * also get the proposal's confidence. A test checks that every cited node in the fixtures sits
 * at one of these patterns.
 */
const ITEM_LISTS = [
  "rounds[].notes",
  "application.essays[].notes",
  "application.short_answers[].notes",
  "application.goal_fields[].notes",
  "application.optional_essay.notes",
  "application.reapplicant.essay.notes",
  "application.reapplicant.policy",
  "application.video[].question_types",
  "application.form_sections[].guidance",
  "application.recommendations.notes",
  "application.resume.notes",
  "application.test_policy",
  "application.fees_waivers",
  "values.stated",
  "culture_and_location",
  "academics.structure",
  "community.traditions",
  "careers.recruiting_notes",
  "interview.format_notes",
  "ai_policy.notes",
  "scholarships",
  "insider_notes",
  "avoid",
  "angles_that_work",
];

export const ITEM_PATTERNS: readonly string[] = [
  ...ITEM_LISTS.map((p) => `${p}[]`),
  "values.trait_map[].note",
  "careers.employment_report.intl_offer_rates",
];

export const RECORD_PATTERNS: readonly string[] = [
  "rounds[]",
  "application.essays[]",
  "application.short_answers[]",
  "application.goal_fields[]",
  "application.optional_essay",
  "application.reapplicant.essay",
  "application.video[]",
  "application.form_sections[]",
  "application.recommendations",
  "application.resume",
  "academics.courses[]",
  "academics.centers[]",
  "academics.experiential[]",
  "community.clubs[]",
  "community.treks_events[]",
  "careers.employment_report",
  "class_profile",
  "interview",
  "interview.common_questions[]",
  "ai_policy",
  "glossary[]",
];

const CITED_PATTERNS = new Set([...ITEM_PATTERNS, ...RECORD_PATTERNS]);
const ITEM_PATTERN_SET = new Set(ITEM_PATTERNS);

interface Stamp {
  sourceId: string;
  confidence: number;
  verifiedOn: IsoDate;
  allocate: () => string;
  allocated: string[];
}

/** Give every new cited object inside `value` (at `path`) an id, the source and the date. */
function stampNew(value: unknown, path: string, stamp: Stamp): void {
  if (Array.isArray(value)) {
    value.forEach((entry, i) => stampNew(entry, `${path}[${i}]`, stamp));
    return;
  }
  if (!isRecord(value)) return;
  const pattern = pathPattern(path);
  if (CITED_PATTERNS.has(pattern)) {
    if (typeof value.id !== "string" || value.id === "") {
      const id = stamp.allocate();
      value.id = id;
      stamp.allocated.push(id);
    }
    const ids = Array.isArray(value.source_ids) ? (value.source_ids as string[]) : [];
    value.source_ids = ids.includes(stamp.sourceId) ? ids : [...ids, stamp.sourceId];
    if (value.verified_at === undefined) value.verified_at = stamp.verifiedOn;
    if (ITEM_PATTERN_SET.has(pattern) && value.confidence === undefined)
      value.confidence = stamp.confidence;
  }
  for (const [key, child] of Object.entries(value))
    stampNew(child, path === "" ? key : `${path}.${key}`, stamp);
}

/** Record that a source confirmed an existing cited node today. */
function touch(node: Record<string, unknown>, sourceId: string, verifiedOn: IsoDate): void {
  const ids = Array.isArray(node.source_ids) ? (node.source_ids as string[]) : [];
  if (!ids.includes(sourceId)) node.source_ids = [...ids, sourceId];
  node.verified_at = verifiedOn;
}

/* Applying -------------------------------------------------------------------------------------- */

export type BlockReason =
  | "bad_path"
  | "unknown_source"
  | "current_changed"
  | "conflicting_accepted"
  | "outranked_by_current";

export interface BlockedProposal {
  index: number;
  field_path: string;
  reason: BlockReason;
  detail: string;
}

export interface AppliedProposal {
  index: number;
  /** Canonical path at the time it was applied. */
  field_path: string;
  allocatedIds: string[];
}

export type ApplyResult =
  | { ok: true; pack: SchoolPack; applied: AppliedProposal[]; blocked: BlockedProposal[] }
  | { ok: false; issues: string[]; applied: AppliedProposal[]; blocked: BlockedProposal[] };

export interface ApplyOptions {
  /** The admin's review date: becomes `verified_at` on everything the accepted proposals touch. */
  verifiedOn: IsoDate;
  /** Sources the proposals cite that aren't in the pack yet; added (or updated) by id. */
  sources?: readonly PackSource[];
}

/**
 * Apply the proposals an admin accepted, in order, to a copy of `pack`. Proposals that can't be
 * applied safely are returned in `blocked` and leave their field unchanged; the rest are applied.
 * The new pack is validated against the schema; if it fails, nothing is returned but the issues.
 */
export function applyProposals(
  pack: SchoolPack,
  accepted: readonly AcceptedProposal[],
  options: ApplyOptions,
): ApplyResult {
  const next = clone(pack);
  for (const source of options.sources ?? []) {
    const at = next.sources.findIndex((s) => s.id === source.id);
    if (at >= 0) next.sources[at] = clone(source);
    else next.sources.push(clone(source));
  }
  const sources = sourceMap(next);
  const applied: AppliedProposal[] = [];
  const blocked: BlockedProposal[] = [];
  const block = (index: number, proposal: PackProposal, reason: BlockReason, detail: string) =>
    blocked.push({ index, field_path: proposal.field_path, reason, detail });

  // Two accepted values for one field is a conflict the admin hasn't resolved: apply neither.
  const valuesByPath = new Map<string, Set<string>>();
  const canonicalOf = new Map<number, string>();
  accepted.forEach((proposal, index) => {
    try {
      const segments = parseFieldPath(proposal.field_path);
      const located = locate(pack, segments);
      if (located.append || opOf(proposal, segments) === "add") return;
      canonicalOf.set(index, located.canonical);
      const values = valuesByPath.get(located.canonical) ?? new Set<string>();
      values.add(opOf(proposal, segments) === "remove" ? "null" : contentKey(proposal.proposed));
      valuesByPath.set(located.canonical, values);
    } catch {
      // Reported below.
    }
  });

  let highWater = packHighWater(next);
  const allocate = () => {
    highWater += 1;
    if (highWater >= RETRIEVAL_CODE_BASE)
      throw new Error("This pack has used every K id below the retrieval range");
    return code("pack", highWater);
  };

  accepted.forEach((proposal, index) => {
    const source = sources.get(proposal.source_id);
    if (!source) return block(index, proposal, "unknown_source", `No source ${proposal.source_id}`);
    let segments: PathSegment[];
    let located: ReturnType<typeof locate>;
    try {
      segments = parseFieldPath(proposal.field_path);
      located = locate(next, segments);
    } catch (error) {
      if (error instanceof FieldPathError) return block(index, proposal, "bad_path", error.message);
      throw error;
    }
    const op = opOf(proposal, segments);
    const canonical = canonicalOf.get(index);
    if (canonical !== undefined && (valuesByPath.get(canonical)?.size ?? 0) > 1)
      return block(
        index,
        proposal,
        "conflicting_accepted",
        "Another accepted proposal sets this field differently",
      );

    if (op === "add") {
      if (!Array.isArray(located.container) || !located.append)
        return block(index, proposal, "bad_path", "An add needs a path ending in [+]");
      const value = clone(proposal.proposed);
      const allocated: string[] = [];
      stampNew(value, located.canonical.replace(/\[\+\]$/, `[${located.container.length}]`), {
        sourceId: source.id,
        confidence: proposal.confidence,
        verifiedOn: options.verifiedOn,
        allocate,
        allocated,
      });
      located.container.push(value);
      applied.push({ index, field_path: located.canonical, allocatedIds: allocated });
      return;
    }

    if (!sameContent(proposal.current, located.value))
      return block(
        index,
        proposal,
        "current_changed",
        "The field changed after this proposal was made",
      );

    const owner = nearestCited(located.chain, located.value);
    const current = backingOf(owner, sources);
    const changes = op === "remove" || !sameContent(proposal.proposed, located.value);
    if (changes && current.trust > source.trust && proposal.override !== true)
      return block(
        index,
        proposal,
        "outranked_by_current",
        `The current value comes from a more trusted source (${current.sourceType ?? "unknown"}, trust ${current.trust})`,
      );

    const allocated: string[] = [];
    if (op === "remove") {
      if (Array.isArray(located.container)) located.container.splice(located.key as number, 1);
      else located.container[located.key as string] = null;
      // The owner, if it survives (a removed note's parent record), was reviewed today.
      if (owner && owner !== located.value) touch(owner, source.id, options.verifiedOn);
    } else if (!changes) {
      // A source confirming what the pack already says: add it as a source, re-date the record.
      if (owner) touch(owner, source.id, options.verifiedOn);
    } else {
      let value = clone(proposal.proposed);
      // Replacing a cited object keeps its id: the K id is what drafts cite.
      if (isCitedNode(located.value) && isRecord(value) && value.id === undefined)
        value = { ...value, id: located.value.id };
      stampNew(value, located.canonical, {
        sourceId: source.id,
        confidence: proposal.confidence,
        verifiedOn: options.verifiedOn,
        allocate,
        allocated,
      });
      if (Array.isArray(located.container)) located.container[located.key as number] = value;
      else located.container[located.key as string] = value;
      if (isCitedNode(value)) touch(value, source.id, options.verifiedOn);
      else if (owner) touch(owner, source.id, options.verifiedOn);
    }
    applied.push({ index, field_path: located.canonical, allocatedIds: allocated });
  });

  next.k_high_water = highWater;
  const parsed = SchoolPackSchema.safeParse(next);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "pack"}: ${issue.message}`,
      ),
      applied,
      blocked,
    };
  return { ok: true, pack: parsed.data, applied, blocked };
}
