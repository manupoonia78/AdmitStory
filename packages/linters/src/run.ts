// Running the checks (§8.8: "run on every draft version"; §8.6: after a patch, "re-runs only the
// affected linters"). Each linter declares its scope:
//   - paragraph: its findings for a paragraph depend only on that paragraph (and the context), so
//     after a patch it re-runs on the changed paragraphs alone and keeps everything else.
//   - draft: it reads the whole draft (counts, rhythm, the opening, the ending…). It re-runs when
//     its `affectedBy` says the change could matter; all of these are cheap.

import {
  bannedPhrases,
  constructions,
  contextRatio,
  dashDensity,
  endingSummary,
  formatting,
  jargon,
  openingThesis,
  rhythm,
  tripletDensity,
  weHiding,
} from "./linters/style";
import { limit, lineReuse, lorOverlap, promptParts, storyReuse } from "./linters/file";
import { factMismatch, unverifiedSchool } from "./linters/truth";
import { checkProvenance, peopleNamed, voiceFidelityFinding } from "./provenance";
import type { DraftDoc, Finding, LintContext, RuleId, Severity } from "./types";

export interface Linter {
  id: string;
  /** Rule ids this linter emits, so earlier findings can be traced back to it. */
  rules: RuleId[];
  scope: "paragraph" | "draft";
  run: (draft: DraftDoc, ctx: LintContext) => Finding[];
  /** Draft-scoped only. Defaults to "any change". */
  affectedBy?: (change: ChangeInfo) => boolean;
}

export interface ChangeInfo {
  changed: ReadonlySet<string>;
  draft: DraftDoc;
  /** A changed id is no longer in the draft, so positions may have shifted. */
  deleted: boolean;
}

const provenanceClaims = (draft: DraftDoc, ctx: LintContext) =>
  checkProvenance(draft, { ...ctx, people: [] }).findings;

export const LINTERS: Linter[] = [
  { id: "limit", rules: ["limit"], scope: "draft", run: limit },
  { id: "promptParts", rules: ["promptParts"], scope: "draft", run: promptParts },
  {
    id: "storyReuse",
    rules: ["storyReuse"],
    scope: "draft",
    run: storyReuse,
    // Depends on the file map, not the text: a paragraph patch can't change it.
    affectedBy: () => false,
  },
  { id: "lineReuse", rules: ["lineReuse"], scope: "paragraph", run: lineReuse },
  { id: "factMismatch", rules: ["factMismatch"], scope: "paragraph", run: factMismatch },
  {
    id: "unverifiedSchool",
    rules: ["unverifiedSchool"],
    scope: "paragraph",
    run: unverifiedSchool,
  },
  {
    id: "provenance",
    rules: ["unsupportedClaim", "unsourcedOwnWords"],
    scope: "paragraph",
    run: provenanceClaims,
  },
  { id: "peopleNamed", rules: ["personNamed"], scope: "paragraph", run: peopleNamed },
  {
    id: "openingThesis",
    rules: ["openingThesis"],
    scope: "draft",
    run: openingThesis,
    affectedBy: ({ changed, draft, deleted }) =>
      deleted || changed.has(draft.paragraphs[0]?.id ?? ""),
  },
  {
    id: "endingSummary",
    rules: ["endingSummary"],
    scope: "draft",
    run: endingSummary,
    affectedBy: ({ changed, draft, deleted }) =>
      deleted || changed.has(draft.paragraphs.at(-1)?.id ?? ""),
  },
  { id: "weHiding", rules: ["weHiding"], scope: "paragraph", run: weHiding },
  { id: "contextRatio", rules: ["contextRatio"], scope: "draft", run: contextRatio },
  { id: "lorOverlap", rules: ["lorOverlap"], scope: "paragraph", run: lorOverlap },
  { id: "bannedPhrases", rules: ["bannedPhrases"], scope: "paragraph", run: bannedPhrases },
  { id: "formatting", rules: ["formatting"], scope: "paragraph", run: formatting },
  { id: "constructions", rules: ["constructions"], scope: "draft", run: constructions },
  { id: "tripletDensity", rules: ["tripletDensity"], scope: "draft", run: tripletDensity },
  { id: "rhythm", rules: ["rhythm"], scope: "draft", run: rhythm },
  { id: "dashDensity", rules: ["dashDensity"], scope: "draft", run: dashDensity },
  { id: "jargon", rules: ["jargon"], scope: "draft", run: jargon },
  { id: "voiceFidelity", rules: ["voiceFidelity"], scope: "draft", run: voiceFidelityFinding },
];

const LINTER_BY_RULE = new Map<RuleId, Linter>(
  LINTERS.flatMap((l) => l.rules.map((r) => [r, l] as const)),
);

const SEVERITY_ORDER: Record<Severity, number> = { must: 0, should: 1, consider: 2 };

/** Must before should before consider, then in reading order. */
export function sortFindings(findings: readonly Finding[], draft: DraftDoc): Finding[] {
  const order = new Map(draft.paragraphs.map((p, i) => [p.id, i]));
  const pos = (f: Finding) =>
    f.location.paragraph_id === null ? -1 : (order.get(f.location.paragraph_id) ?? 1e9);
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      pos(a) - pos(b) ||
      (a.location.sentence ?? -1) - (b.location.sentence ?? -1),
  );
}

export function runLinters(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  return sortFindings(
    LINTERS.flatMap((l) => l.run(draft, ctx)),
    draft,
  );
}

/** Which linters a change to these paragraphs re-runs. */
export function affectedLinters(changedParagraphIds: readonly string[], draft: DraftDoc): Linter[] {
  const changed = new Set(changedParagraphIds);
  const present = new Set(draft.paragraphs.map((p) => p.id));
  const deleted = [...changed].some((id) => !present.has(id));
  const anyPresent = [...changed].some((id) => present.has(id));
  return LINTERS.filter((l) =>
    l.scope === "paragraph"
      ? anyPresent
      : (l.affectedBy ?? (() => changed.size > 0))({ changed, draft, deleted }),
  );
}

/**
 * After a patch (§8.6): re-run only the checks the changed paragraphs can affect, and keep the
 * previous findings for everything else. Findings on paragraphs that no longer exist are dropped.
 * `previous` is the full finding list for the version before the patch.
 */
export function runAffectedLinters(
  changedParagraphIds: readonly string[],
  draft: DraftDoc,
  ctx: LintContext,
  previous: readonly Finding[],
): Finding[] {
  const changed = new Set(changedParagraphIds);
  const present = new Set(draft.paragraphs.map((p) => p.id));
  const rerun = new Set(affectedLinters(changedParagraphIds, draft));

  const kept = previous.filter((f) => {
    const linter = LINTER_BY_RULE.get(f.rule_id);
    const pid = f.location.paragraph_id;
    if (pid !== null && !present.has(pid)) return false;
    if (!linter || !rerun.has(linter)) return true;
    return linter.scope === "paragraph" && pid !== null && !changed.has(pid);
  });

  const changedDraft: DraftDoc = { paragraphs: draft.paragraphs.filter((p) => changed.has(p.id)) };
  const fresh = [...rerun].flatMap((l) =>
    l.run(l.scope === "paragraph" ? changedDraft : draft, ctx),
  );
  return sortFindings([...kept, ...fresh], draft);
}

/* Grouping for the Checks tab (§5.8) --------------------------------------------------------- */

export const SEVERITY_LABELS: Record<Severity, string> = {
  must: "Must fix",
  should: "Should fix",
  consider: "Consider",
};

export function groupBySeverity(findings: readonly Finding[]): Record<Severity, Finding[]> {
  const groups: Record<Severity, Finding[]> = { must: [], should: [], consider: [] };
  for (const f of findings) groups[f.severity].push(f);
  return groups;
}

export function severityCounts(findings: readonly Finding[]): Record<Severity, number> {
  const g = groupBySeverity(findings);
  return { must: g.must.length, should: g.should.length, consider: g.consider.length };
}
