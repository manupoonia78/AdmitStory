import { describe, expect, it } from "vitest";
import { applyDecisions, nextPending, planRevision, revisionMessage } from "./revision";
import type { DraftParagraph, DraftSentence } from "./types";

const s = (text: string): DraftSentence => ({ text, kind: "composed", sources: [] });

const DRAFT: DraftParagraph[] = [
  { id: "p1", sentences: [s("One.")] },
  { id: "p2", sentences: [s("Two.")] },
  { id: "p3", locked: true, sentences: [s("Three.")] },
];

describe("planRevision", () => {
  it("plans replace, insert and delete, numbering by the kept draft, skipping locks", () => {
    const plan = planRevision(DRAFT, [
      { op: "replace", paragraph_id: "p2", sentences: [s("Two, better.")] },
      { op: "insert_after", paragraph_id: "p1", sentences: [s("One and a half.")] },
      { op: "replace", paragraph_id: "p3", sentences: [s("Locked away.")] },
      { op: "delete", paragraph_id: "p9", sentences: null },
    ]);
    expect(plan.skipped).toEqual([
      { paragraph_id: "p3", reason: "locked" },
      { paragraph_id: "p9", reason: "missing" },
    ]);
    expect(plan.changes.map((c) => [c.paragraphId, c.op, c.number])).toEqual([
      ["p2", "replace", 3],
      ["p1-1", "insert_after", 2],
    ]);
  });

  it("says what changed in the §6.9 words", () => {
    const one = planRevision(DRAFT, [
      { op: "replace", paragraph_id: "p2", sentences: [s("Two, better.")] },
    ]);
    expect(revisionMessage(one.changes)).toBe("Paragraph 2 rewritten. Review the change.");
    const two = planRevision(DRAFT, [
      { op: "replace", paragraph_id: "p2", sentences: [s("Two, better.")] },
      { op: "delete", paragraph_id: "p1", sentences: null },
    ]);
    expect(revisionMessage(two.changes)).toBe("2 paragraphs changed. Review the changes.");
  });
});

describe("applyDecisions", () => {
  const plan = planRevision(DRAFT, [
    { op: "replace", paragraph_id: "p2", sentences: [s("Two, better.")] },
    { op: "insert_after", paragraph_id: "p1", sentences: [s("One and a half.")] },
    { op: "delete", paragraph_id: "p1", sentences: null },
  ]);

  it("applies only kept changes, per paragraph", () => {
    const text = (ps: DraftParagraph[]) => ps.map((p) => p.sentences[0]?.text);
    expect(text(applyDecisions(DRAFT, plan.changes, {}))).toEqual(["One.", "Two.", "Three."]);
    expect(text(applyDecisions(DRAFT, plan.changes, { p2: "kept", "p1-1": "undone" }))).toEqual([
      "One.",
      "Two, better.",
      "Three.",
    ]);
    expect(
      text(applyDecisions(DRAFT, plan.changes, { p2: "kept", "p1-1": "kept", p1: "kept" })),
    ).toEqual(["One and a half.", "Two, better.", "Three."]);
  });

  it("finds the next undecided change for A and R", () => {
    expect(nextPending(plan.changes, { p2: "kept" })?.paragraphId).toBe("p1-1");
    expect(nextPending(plan.changes, { p2: "kept", "p1-1": "undone", p1: "kept" })).toBeUndefined();
  });
});
