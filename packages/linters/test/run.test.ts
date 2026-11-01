import { describe, expect, it } from "vitest";
import {
  affectedLinters,
  groupBySeverity,
  runAffectedLinters,
  runLinters,
  SEVERITY_LABELS,
  severityCounts,
} from "../src/run";
import type { DraftDoc, Finding, LintContext } from "../src/types";
import { doc, para, s } from "./helpers";

const ctx: LintContext = {
  limit: { kind: "words", value: 60 },
  facts: [{ code: "F01", key: "team_size", value: "13", approvedPhrasing: "a 13-person team" }],
  people: [{ code: "P1", name: "Asha Rao", role: "my manager", mayName: false }],
  schoolTerms: ["Ledger Lab"],
  currentCycle: "2026-27",
  packItems: [{ code: "K01", verifiedAt: "2026-08-01", cycle: "2026-27" }],
};

const draft: DraftDoc = doc(
  para(
    "p1",
    "Throughout my career, I have liked spreadsheets.",
    s("I led a 15-person team.", "composed", ["F01"]),
  ),
  para("p2", "We shipped it. We were proud.", "Asha said nothing."),
  para("p3", s("Ledger Lab is why I am applying.", "composed", []), "Moreover, I want to learn."),
);

const key = (f: Finding) =>
  `${f.rule_id}|${f.location.paragraph_id}|${f.location.sentence}|${f.explanation}`;
const keys = (list: Finding[]) => list.map(key).sort();

describe("runLinters", () => {
  it("runs every check and sorts must, should, consider, then reading order", () => {
    const findings = runLinters(draft, ctx);
    const rules = new Set(findings.map((f) => f.rule_id));
    for (const r of [
      "factMismatch",
      "personNamed",
      "unverifiedSchool",
      "openingThesis",
      "weHiding",
      "bannedPhrases",
    ] as const) {
      expect(rules).toContain(r);
    }
    const order = { must: 0, should: 1, consider: 2 };
    const severities = findings.map((f) => order[f.severity]);
    expect(severities).toEqual([...severities].sort((a, b) => a - b));
    const musts = findings.filter((f) => f.severity === "must").map((f) => f.location.paragraph_id);
    expect([...new Set(musts)]).toEqual(["p1", "p2", "p3"]);
  });

  it("returns nothing on a clean draft with no context", () => {
    expect(runLinters(doc(para("p1", "I called her at nine.", "She picked up.")))).toEqual([]);
  });
});

describe("runAffectedLinters (§8.6)", () => {
  it("re-runs paragraph checks only on the changed paragraph", () => {
    const ids = affectedLinters(["p2"], draft).map((l) => l.id);
    expect(ids).toContain("weHiding");
    expect(ids).not.toContain("openingThesis");
    expect(ids).not.toContain("storyReuse");
    expect(affectedLinters(["p1"], draft).map((l) => l.id)).toContain("openingThesis");
  });

  it("gives the same findings as a full run after a patch", () => {
    const before = runLinters(draft, ctx);
    const patched: DraftDoc = {
      paragraphs: draft.paragraphs.map((p) =>
        p.id === "p2" ? para("p2", "I shipped it on a Sunday.", "My manager said nothing.") : p,
      ),
    };
    const after = runAffectedLinters(["p2"], patched, ctx, before);
    expect(keys(after)).toEqual(keys(runLinters(patched, ctx)));
    expect(after.some((f) => f.location.paragraph_id === "p2" && f.rule_id === "weHiding")).toBe(
      false,
    );
  });

  it("drops findings on a deleted paragraph and re-checks the ending", () => {
    const before = runLinters(draft, ctx);
    const patched: DraftDoc = { paragraphs: draft.paragraphs.filter((p) => p.id !== "p3") };
    const after = runAffectedLinters(["p3"], patched, ctx, before);
    expect(after.some((f) => f.location.paragraph_id === "p3")).toBe(false);
    expect(keys(after)).toEqual(keys(runLinters(patched, ctx)));
  });
});

describe("severity grouping", () => {
  it("groups and counts findings for the Checks tab", () => {
    const findings = runLinters(draft, ctx);
    const groups = groupBySeverity(findings);
    expect(groups.must.every((f) => f.severity === "must")).toBe(true);
    expect(severityCounts(findings)).toEqual({
      must: groups.must.length,
      should: groups.should.length,
      consider: groups.consider.length,
    });
    expect(SEVERITY_LABELS).toEqual({
      must: "Must fix",
      should: "Should fix",
      consider: "Consider",
    });
  });
});
