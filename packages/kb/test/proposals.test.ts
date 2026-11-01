import { describe, expect, it } from "vitest";
import { FieldPathError, formatFieldPath, locate, parseFieldPath } from "../src/paths";
import {
  applyProposals,
  detectConflicts,
  nextPackId,
  packHighWater,
  type AcceptedProposal,
  type PackProposal,
} from "../src/proposals";
import type { PackSource, SchoolPack } from "../src/types";
import { citedNodes } from "../src/walk";
import { fixture } from "./packs";

const TODAY = "2026-10-30";
const pack = (): SchoolPack => structuredClone(fixture("halvorsen"));

const extraSources: PackSource[] = [
  {
    id: "forum",
    type: "insider",
    title: "Student forum thread (synthetic)",
    url: null,
    trust: 3,
    retrieved_at: TODAY,
    rights_note: null,
  },
  {
    id: "press",
    type: "press",
    title: "News article (synthetic)",
    url: null,
    trust: 2,
    retrieved_at: TODAY,
    rights_note: null,
  },
  {
    id: "site-2",
    type: "official",
    title: "Halvorsen essays page, re-read (synthetic)",
    url: "https://www.halvorsen.example/admissions/essays",
    trust: 5,
    retrieved_at: TODAY,
    rights_note: null,
  },
];

function limitProposal(value: number, source_id: string, current = 500): PackProposal {
  return {
    field_path: "application.essays[key=goals].limit.value",
    proposed: value,
    current,
    confidence: 0.9,
    source_id,
    source_span: { start: 120, end: 160, quote: `${value} words` },
  };
}

describe("field paths", () => {
  it("parses selectors, indices and appends, and formats them back", () => {
    const path = "application.essays[key=goals].notes[0].text";
    expect(formatFieldPath(parseFieldPath(path))).toBe(path);
    expect(parseFieldPath("values.stated[+]").at(-1)).toEqual({ kind: "append" });
    expect(() => parseFieldPath("values[+].stated")).toThrow(FieldPathError);
    expect(() => parseFieldPath(".values")).toThrow(FieldPathError);
    expect(() => parseFieldPath("")).toThrow(FieldPathError);
  });

  it("resolves a selector to its index", () => {
    const located = locate(pack(), "application.essays[key=shaped].limit");
    expect(located.canonical).toBe("application.essays[1].limit");
    expect(located.value).toEqual({ kind: "words", value: 400 });
    expect(() => locate(pack(), "application.essays[key=nope].limit")).toThrow(FieldPathError);
  });
});

describe("K id allocation", () => {
  it("allocates above the high-water mark and never reuses a removed id", () => {
    const start = pack();
    expect(packHighWater(start)).toBe(54);
    expect(nextPackId(start)).toBe("K55");

    const removed = applyProposals(
      start,
      [
        {
          field_path: "glossary[0]",
          op: "remove",
          proposed: null,
          current: start.glossary[0],
          confidence: 1,
          source_id: "halvorsen-admissions",
        },
      ],
      { verifiedOn: TODAY },
    );
    if (!removed.ok) throw new Error(removed.issues.join("\n"));
    expect(removed.pack.glossary).toEqual([]);
    expect(removed.pack.k_high_water).toBe(54);

    // K54 was the highest id and is gone; the next one is still K55.
    const added = applyProposals(
      removed.pack,
      [
        {
          field_path: "avoid[+]",
          proposed: { text: "Quoting the school's mission statement back at it." },
          current: null,
          confidence: 0.7,
          source_id: "halvorsen-coach",
        },
      ],
      { verifiedOn: TODAY },
    );
    if (!added.ok) throw new Error(added.issues.join("\n"));
    expect(added.applied[0]?.allocatedIds).toEqual(["K55"]);
    expect(added.pack.avoid.at(-1)).toEqual({
      text: "Quoting the school's mission statement back at it.",
      id: "K55",
      source_ids: ["halvorsen-coach"],
      verified_at: TODAY,
      confidence: 0.7,
    });
    expect(added.pack.k_high_water).toBe(55);
  });

  it("stamps every new cited object inside an added record", () => {
    const result = applyProposals(
      pack(),
      [
        {
          field_path: "academics.courses[+]",
          proposed: {
            name: "Negotiation Lab",
            what_it_is: "An elective on negotiation, taught through role plays.",
            why_it_matters_for: ["brings_people_along"],
            url: null,
          },
          current: null,
          confidence: 0.9,
          source_id: "site-2",
        },
        {
          field_path: "application.essays[+]",
          proposed: {
            key: "community",
            prompt_verbatim: "How will you contribute to the Halvorsen community?",
            limit: { kind: "words", value: 250 },
            required: true,
            archetypes: ["CONTRIBUTION"],
            parts: [],
            notes: [{ text: "New for 2026-27." }],
          },
          current: null,
          confidence: 0.95,
          source_id: "site-2",
        },
      ],
      { verifiedOn: TODAY, sources: extraSources },
    );
    if (!result.ok) throw new Error(result.issues.join("\n"));
    expect(result.applied.map((a) => a.allocatedIds)).toEqual([["K55"], ["K56", "K57"]]);
    const essay = result.pack.application.essays.at(-1);
    expect(essay).toMatchObject({ id: "K56", source_ids: ["site-2"], verified_at: TODAY });
    expect(essay?.notes[0]).toMatchObject({ id: "K57", confidence: 0.95, verified_at: TODAY });
    const ids = citedNodes(result.pack).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("applyProposals", () => {
  it("sets a field, re-dates and re-sources the record it belongs to, and keeps its K id", () => {
    const before = pack();
    const goals = before.application.essays[0];
    const result = applyProposals(before, [limitProposal(450, "site-2")], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    if (!result.ok) throw new Error(result.issues.join("\n"));
    const after = result.pack.application.essays[0];
    expect(after?.limit).toEqual({ kind: "words", value: 450 });
    expect(after?.id).toBe(goals?.id);
    expect(after?.verified_at).toBe(TODAY);
    expect(after?.source_ids).toEqual(["halvorsen-admissions", "site-2"]);
    expect(result.pack.sources.map((s) => s.id)).toContain("site-2");
    // The input is untouched.
    expect(before.application.essays[0]?.limit.value).toBe(500);
  });

  it("keeps the K id when a whole cited record is replaced", () => {
    const before = pack();
    const note = before.culture_and_location[0];
    const result = applyProposals(
      before,
      [
        {
          field_path: `culture_and_location[id=${note?.id}]`,
          proposed: { text: "Coastal campus; most students walk to class." },
          current: note,
          confidence: 0.8,
          source_id: "halvorsen-students",
        },
      ],
      { verifiedOn: TODAY },
    );
    if (!result.ok) throw new Error(result.issues.join("\n"));
    expect(result.pack.culture_and_location[0]).toMatchObject({
      id: note?.id,
      verified_at: TODAY,
      confidence: 0.8,
    });
  });

  it("treats a source confirming the current value as a re-verification", () => {
    const result = applyProposals(pack(), [limitProposal(500, "site-2")], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    if (!result.ok) throw new Error(result.issues.join("\n"));
    expect(result.pack.application.essays[0]).toMatchObject({
      verified_at: TODAY,
      limit: { value: 500 },
    });
  });

  it("refuses a proposal made against a value that has since changed", () => {
    const result = applyProposals(pack(), [limitProposal(450, "site-2", 300)], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    expect(result.ok && result.blocked).toEqual([
      expect.objectContaining({ index: 0, reason: "current_changed" }),
    ]);
    expect(result.ok && result.pack.application.essays[0]?.limit.value).toBe(500);
  });

  it("won't let a less trusted source overwrite an official value unless the admin overrides", () => {
    const blocked = applyProposals(pack(), [limitProposal(300, "forum")], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    expect(blocked.ok && blocked.blocked[0]?.reason).toBe("outranked_by_current");
    expect(blocked.ok && blocked.pack.application.essays[0]?.limit.value).toBe(500);

    const overridden: AcceptedProposal = { ...limitProposal(300, "forum"), override: true };
    const result = applyProposals(pack(), [overridden], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    expect(result.ok && result.pack.application.essays[0]?.limit.value).toBe(300);
  });

  it("applies neither of two accepted proposals that disagree on one field", () => {
    const result = applyProposals(
      pack(),
      [limitProposal(450, "site-2"), { ...limitProposal(300, "forum"), override: true }],
      { verifiedOn: TODAY, sources: extraSources },
    );
    expect(result.ok && result.blocked.map((b) => b.reason)).toEqual([
      "conflicting_accepted",
      "conflicting_accepted",
    ]);
    expect(result.ok && result.pack.application.essays[0]?.limit.value).toBe(500);
  });

  it("reports bad paths and unknown sources and applies the rest", () => {
    const result = applyProposals(
      pack(),
      [
        {
          ...limitProposal(450, "site-2"),
          field_path: "application.essays[key=missing].limit.value",
        },
        limitProposal(450, "nobody"),
        {
          field_path: "scholarships[+]",
          proposed: { text: "Fellowships for public-sector applicants." },
          current: null,
          confidence: 0.9,
          source_id: "halvorsen-admissions",
        },
      ],
      { verifiedOn: TODAY, sources: extraSources },
    );
    expect(result.ok && result.blocked.map((b) => b.reason)).toEqual([
      "bad_path",
      "unknown_source",
    ]);
    expect(result.ok && result.pack.scholarships).toHaveLength(2);
  });

  it("validates the result against the schema", () => {
    const result = applyProposals(pack(), [{ ...limitProposal(-5, "site-2") }], {
      verifiedOn: TODAY,
      sources: extraSources,
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.join()).toContain("limit");
  });
});

describe("detectConflicts (§9.3)", () => {
  it("defaults to the official value when an official source backs exactly one", () => {
    const [conflict, ...rest] = detectConflicts(
      pack(),
      [limitProposal(300, "forum"), limitProposal(250, "press")],
      { sources: extraSources },
    );
    expect(rest).toEqual([]);
    expect(conflict?.field_path).toBe("application.essays[0].limit.value");
    expect(conflict?.candidates.map((c) => [c.origin, c.value, c.trust])).toEqual([
      ["current", 500, 5],
      ["proposal", 300, 3],
      ["proposal", 250, 2],
    ]);
    expect(conflict?.defaultChoice).toBe(0);
    expect(conflict?.blocking).toBe(false);
  });

  it("blocks the field when two official sources disagree", () => {
    const [conflict] = detectConflicts(pack(), [limitProposal(450, "site-2")], {
      sources: extraSources,
    });
    expect(conflict?.candidates.every((c) => c.sourceType === "official")).toBe(true);
    expect(conflict?.defaultChoice).toBeNull();
    expect(conflict?.blocking).toBe(true);
  });

  it("blocks the field when no official source backs any value", () => {
    const start = pack();
    const note = start.culture_and_location[0];
    const [conflict] = detectConflicts(
      start,
      [
        {
          field_path: `culture_and_location[id=${note?.id}].text`,
          proposed: "Most students live off campus.",
          current: note?.text,
          confidence: 0.6,
          source_id: "press",
        },
      ],
      { sources: extraSources },
    );
    expect(conflict?.blocking).toBe(true);
  });

  it("finds no conflict when sources agree, and none for appends", () => {
    expect(
      detectConflicts(pack(), [limitProposal(500, "forum")], { sources: extraSources }),
    ).toEqual([]);
    expect(
      detectConflicts(
        pack(),
        [
          {
            field_path: "avoid[+]",
            proposed: { text: "x" },
            current: null,
            confidence: 1,
            source_id: "press",
          },
        ],
        { sources: extraSources },
      ),
    ).toEqual([]);
  });
});
