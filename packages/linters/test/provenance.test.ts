import { describe, expect, it } from "vitest";
import {
  checkProvenance,
  peopleNamed,
  scanClaims,
  VOICE_FIDELITY_TARGETS,
  voiceFidelity,
  voiceFidelityFinding,
} from "../src/provenance";
import type { PersonRef } from "../src/types";
import { doc, para, s } from "./helpers";

const texts = (list: { text: string }[]) => list.map((c) => c.text);

describe("scanClaims", () => {
  it("finds numbers, dates, quotes and names that are not sentence-initial", () => {
    const scan = scanClaims(
      'In March 2021 I met Asha, who said "we will not ship this" and cut 40% of scope.',
    );
    expect(scan.claims.map((c) => [c.kind, c.text])).toEqual([
      ["date", "March 2021"],
      ["proper_noun", "Asha"],
      ["quote", '"we will not ship this"'],
      ["number", "40%"],
    ]);
  });

  it("treats a common sentence opener and 'I' as nothing", () => {
    expect(scanClaims("The room went quiet and I waited.")).toEqual({ claims: [], ambiguous: [] });
  });

  it("returns cases regex cannot decide as ambiguous", () => {
    expect(texts(scanClaims("Priya said no.").ambiguous)).toEqual(["Priya"]);
    expect(texts(scanClaims("We hired three analysts.").ambiguous)).toEqual(["three"]);
    expect(texts(scanClaims('She called it "fine" again.').ambiguous)).toEqual(['"fine"']);
    expect(texts(scanClaims("The audit flagged our GDPR gaps.").ambiguous)).toEqual(["GDPR"]);
  });

  it("finds school terms", () => {
    expect(scanClaims("I want to take Ledger Lab.", ["Ledger Lab"]).claims[0]).toMatchObject({
      kind: "school_term",
    });
  });
});

describe("checkProvenance", () => {
  it("makes a Verify item and a must fix for an unsourced concrete claim", () => {
    const d = doc(para("p1", s("I cut costs by 30%.", "composed", [])));
    const r = checkProvenance(d);
    expect(r.findings).toEqual([
      expect.objectContaining({
        rule_id: "unsupportedClaim",
        severity: "must",
        location: { paragraph_id: "p1", sentence: 0 },
      }),
    ]);
    expect(r.verify).toEqual([
      {
        text: "I cut costs by 30%.",
        reason: 'States a number ("30%") with no source.',
        paragraph_id: "p1",
        sentence: 0,
      },
    ]);
  });

  it("passes a sourced claim, and composed prose that claims nothing", () => {
    const d = doc(
      para(
        "p1",
        s("I cut costs by 30%.", "composed", ["F02"]),
        s("It was not easy.", "composed", []),
      ),
    );
    expect(checkProvenance(d)).toEqual({ findings: [], verify: [], ambiguous: [] });
  });

  it("hands ambiguous cases back without a finding", () => {
    const d = doc(para("p1", s("Priya said no.", "composed", [])));
    const r = checkProvenance(d);
    expect(r.findings).toEqual([]);
    expect(r.ambiguous).toEqual([
      {
        paragraph_id: "p1",
        sentence: 0,
        text: "Priya said no.",
        candidates: [expect.objectContaining({ text: "Priya" })],
      },
    ]);
  });

  it("flags own-words sentences that point to no source", () => {
    const d = doc(
      para("p1", s("I stayed until six.", "verbatim", []), s("I left.", "adapted", ["C1"])),
    );
    expect(checkProvenance(d).findings.map((f) => [f.rule_id, f.location.sentence])).toEqual([
      ["unsourcedOwnWords", 0],
    ]);
  });
});

describe("peopleNamed", () => {
  const people: PersonRef[] = [
    { code: "P1", name: "Asha Rao", role: "my manager", mayName: false },
    { code: "P2", name: "Tomas Wren", role: "my mentor", mayName: true },
  ];

  it("is a must fix with a patch that swaps the name for the role", () => {
    const d = doc(para("p1", "I waited.", "Asha looked at the numbers and frowned."));
    const [f] = peopleNamed(d, { people });
    expect(f).toMatchObject({
      rule_id: "personNamed",
      severity: "must",
      location: { paragraph_id: "p1", sentence: 1 },
    });
    expect(f?.patch?.sentences?.map((x) => x.text)).toEqual([
      "I waited.",
      "My manager looked at the numbers and frowned.",
    ]);
  });

  it("matches the full name before its parts", () => {
    const d = doc(para("p1", "I called Asha Rao that night."));
    expect(peopleNamed(d, { people })[0]?.patch?.sentences?.[0]?.text).toBe(
      "I called my manager that night.",
    );
  });

  it("passes people who may be named, and partial-word matches", () => {
    expect(peopleNamed(doc(para("p1", "Tomas Wren hired me.")), { people })).toEqual([]);
    expect(
      peopleNamed(doc(para("p1", "The Rao-ville office closed.", "Ashanti came too.")), {
        people: [{ ...people[0]!, name: "Asha" }],
      }),
    ).toEqual([]);
  });
});

describe("voiceFidelity", () => {
  const d = doc(
    para(
      "p1",
      s("one two three four five six", "verbatim"),
      s("one two", "adapted"),
      s("one two three four five six seven eight nine ten eleven twelve", "composed", []),
    ),
  );

  it("is the share of words in verbatim and adapted sentences", () => {
    expect(voiceFidelity(d)).toMatchObject({ ownWords: 8, totalWords: 20, score: 0.4 });
  });

  it("targets more own words for personal essays than for goals", () => {
    expect(VOICE_FIDELITY_TARGETS.IDENTITY.min).toBeGreaterThan(VOICE_FIDELITY_TARGETS.GOALS.min);
    expect(voiceFidelity(d, "IDENTITY").status).toBe("below");
    expect(voiceFidelity(d, "GOALS").status).toBe("within");
  });

  it("nudges only when below the target", () => {
    expect(voiceFidelityFinding(d, { promptType: "IDENTITY" })).toEqual([
      expect.objectContaining({ rule_id: "voiceFidelity", severity: "consider" }),
    ]);
    expect(voiceFidelityFinding(d, { promptType: "GOALS" })).toEqual([]);
    expect(voiceFidelityFinding(doc())).toEqual([]);
  });
});
