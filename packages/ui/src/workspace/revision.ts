// Reviewing a refinement (spec §5.8 Refine, §8.6 revision protocol). The Reviser returns
// paragraph-scoped patches; the applicant keeps or undoes each changed paragraph, or all at once.
// Pure, so the server and the Workspace agree on what a decision does.

import { paragraphText } from "./provenance";
import type { DraftParagraph, DraftSentence } from "./types";

/** Appendix I `Patch`, with the Workspace's sentence shape. */
export interface DraftPatch {
  op: "replace" | "insert_after" | "delete";
  paragraph_id: string;
  sentences: readonly DraftSentence[] | null;
}

export interface RevisionChange {
  /** The paragraph the change applies to: the patched one, or the new one for insert_after. */
  paragraphId: string;
  op: DraftPatch["op"];
  /** 1-based position in the draft as it will read if kept ("Paragraph 2"). */
  number: number;
  before: DraftParagraph | null;
  after: DraftParagraph | null;
  /** For insert_after: the paragraph the new one follows. */
  anchorId?: string;
}

export type ChangeDecision = "pending" | "kept" | "undone";

export interface RevisionPlan {
  changes: RevisionChange[];
  /** Patches dropped because their paragraph is locked or unknown (spec §5.8: L protects it). */
  skipped: { paragraph_id: string; reason: "locked" | "missing" }[];
}

/**
 * The changes a set of patches would make. Locked paragraphs are never touched: their patches are
 * reported as skipped. A paragraph inserted after another gets the id `newId(anchorId, n)`.
 */
export function planRevision(
  paragraphs: readonly DraftParagraph[],
  patches: readonly DraftPatch[],
  newId: (afterId: string, n: number) => string = (afterId, n) => `${afterId}-${n}`,
): RevisionPlan {
  const byId = new Map(paragraphs.map((p) => [p.id, p]));
  const changes: RevisionChange[] = [];
  const skipped: RevisionPlan["skipped"] = [];
  const inserted = new Map<string, number>();
  for (const patch of patches) {
    const target = byId.get(patch.paragraph_id);
    if (!target) {
      skipped.push({ paragraph_id: patch.paragraph_id, reason: "missing" });
      continue;
    }
    if (patch.op !== "insert_after" && target.locked) {
      skipped.push({ paragraph_id: patch.paragraph_id, reason: "locked" });
      continue;
    }
    const sentences = [...(patch.sentences ?? [])];
    if (patch.op === "replace") {
      changes.push({
        paragraphId: target.id,
        op: "replace",
        number: 0,
        before: target,
        after: { ...target, sentences },
      });
    } else if (patch.op === "delete") {
      changes.push({
        paragraphId: target.id,
        op: "delete",
        number: 0,
        before: target,
        after: null,
      });
    } else {
      const n = (inserted.get(target.id) ?? 0) + 1;
      inserted.set(target.id, n);
      changes.push({
        paragraphId: newId(target.id, n),
        op: "insert_after",
        anchorId: target.id,
        number: 0,
        before: null,
        after: { id: newId(target.id, n), sentences },
      });
    }
  }
  // Number each change by where it lands in the draft with every change kept.
  const kept = applyDecisions(
    paragraphs,
    changes,
    Object.fromEntries(changes.map((c) => [c.paragraphId, "kept" as const])),
  );
  for (const change of changes) {
    const at = kept.findIndex((p) => p.id === change.paragraphId);
    change.number = at >= 0 ? at + 1 : paragraphs.findIndex((p) => p.id === change.paragraphId) + 1;
  }
  return { changes, skipped };
}

/**
 * The draft after the applicant's decisions: kept changes applied, undone or pending ones not.
 * Inserted paragraphs land straight after their anchor, in patch order.
 */
export function applyDecisions(
  paragraphs: readonly DraftParagraph[],
  changes: readonly RevisionChange[],
  decisions: Readonly<Record<string, ChangeDecision>>,
): DraftParagraph[] {
  const result: DraftParagraph[] = [];
  for (const paragraph of paragraphs) {
    const own = changes.find((c) => c.op !== "insert_after" && c.paragraphId === paragraph.id);
    const keep = own && decisions[own.paragraphId] === "kept";
    if (!keep) result.push(paragraph);
    else if (own.after) result.push(own.after);
    for (const change of changes) {
      if (change.op !== "insert_after" || !change.after) continue;
      if (decisions[change.paragraphId] !== "kept") continue;
      if (change.anchorId === paragraph.id) result.push(change.after);
    }
  }
  return result;
}

/** What the review says (spec §6.9 "Paragraph 2 rewritten. Review the change."). */
export function revisionMessage(changes: readonly RevisionChange[]): string {
  if (changes.length === 0) return "Nothing to change. The draft already does this.";
  if (changes.length === 1) {
    const [change] = changes as [RevisionChange];
    const verb =
      change.op === "delete" ? "removed" : change.op === "insert_after" ? "added" : "rewritten";
    return `Paragraph ${change.number} ${verb}. Review the change.`;
  }
  return `${changes.length} paragraphs changed. Review the changes.`;
}

/** The plain text a change reads as on either side, for the diff and for screen readers. */
export function changeText(change: RevisionChange, side: "before" | "after"): string {
  const paragraph = side === "before" ? change.before : change.after;
  return paragraph ? paragraphText(paragraph) : "";
}

/** The first change still waiting for a decision, which A and R act on. */
export function nextPending(
  changes: readonly RevisionChange[],
  decisions: Readonly<Record<string, ChangeDecision>>,
): RevisionChange | undefined {
  return changes.find((c) => (decisions[c.paragraphId] ?? "pending") === "pending");
}
