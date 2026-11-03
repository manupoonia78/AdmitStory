import { describe, expect, it } from "vitest";
import { factMismatch, isValidPackSource, unverifiedSchool } from "../src/linters/truth";
import { extractQuantities } from "../src/quantities";
import { findSchoolTerms } from "../src/school-terms";
import type { FactRef } from "../src/types";
import { doc, para, s } from "./helpers";

const kinds = (text: string) =>
  extractQuantities(text).map((q) => [q.kind, q.value, q.high ?? null, q.timeUnit]);

describe("extractQuantities", () => {
  it.each([
    ["I led a 13-person team", [["number", 13, null, false]]],
    ["thirteen-person crew", [["number", 13, null, false]]],
    ["50+ engineers", [["atLeast", 50, null, false]]],
    ["over 40 clients", [["atLeast", 40, null, false]]],
    ["10–12 people", [["range", 10, 12, false]]],
    ["between 10 and 12 people", [["range", 10, 12, false]]],
    ["a $1.2M budget", [["money", 1_200_000, null, false]]],
    ["$1,200,000", [["money", 1_200_000, null, false]]],
    ["1.2 million dollars", [["money", 1_200_000, null, false]]],
    ["₹4 crore", [["money", 40_000_000, null, false]]],
    ["grew 35%", [["percent", 35, null, false]]],
    ["in 2019", [["year", 2019, null, false]]],
    ["for 9 years", [["number", 9, null, true]]],
  ] as const)("reads %s", (text, expected) => {
    expect(kinds(text)).toEqual(expected);
  });

  it("reads a whole number word, never its prefix", () => {
    expect(kinds("more than seventeen engineers")).toEqual([["atLeast", 17, null, false]]);
    expect(kinds("over sixty people")).toEqual([["atLeast", 60, null, false]]);
  });

  it("does not read a degenerate span as a range", () => {
    expect(extractQuantities("one to one meetings")).toEqual([]);
  });

  it("leaves bare number words alone", () => {
    expect(extractQuantities("one of my engineers left two weeks later")).toEqual([]);
  });
});

const facts: FactRef[] = [
  { code: "F01", key: "team_size", value: "13", approvedPhrasing: "a 13-person team" },
  { code: "F02", key: "revenue_growth", value: "35%", approvedPhrasing: "35% revenue growth" },
  {
    code: "F03",
    key: "current_title",
    value: "Senior Analyst",
    approvedPhrasing: "Senior Analyst",
  },
  { code: "F04", key: "promotion_date", value: "2023-03", approvedPhrasing: "March 2023" },
];

describe("factMismatch", () => {
  it("is a must fix when a cited fact's number differs", () => {
    const d = doc(
      para("p1", s("I led a 15-person team through the rollout.", "composed", ["F01"])),
    );
    const [f] = factMismatch(d, { facts });
    expect(f).toMatchObject({
      rule_id: "factMismatch",
      severity: "must",
      location: { paragraph_id: "p1", sentence: 0 },
    });
    expect(f?.explanation).toBe('This says "15", but your Fact Sheet says "a 13-person team".');
  });

  it("passes a matching number in another form", () => {
    const d = doc(
      para(
        "p1",
        s("Thirteen-person teams are small.", "composed", ["F01"]),
        s("I ran 13 people.", "composed", ["F01"]),
      ),
    );
    expect(factMismatch(d, { facts })).toEqual([]);
  });

  it("catches an uncited sentence that is evidently about a fact", () => {
    const d = doc(para("p1", s("My team grew to 20 people that spring.", "composed", [])));
    expect(factMismatch(d, { facts })).toHaveLength(1);
  });

  it("ignores an uncited number that is not attached to the fact's key word", () => {
    const d = doc(para("p1", s("Our team shipped 3 releases that spring.", "composed", [])));
    expect(factMismatch(d, { facts })).toEqual([]);
    const attached = doc(para("p1", s("I ran a 15-person team.", "composed", [])));
    expect(factMismatch(attached, { facts })).toHaveLength(1);
  });

  it("does not read someone else's title as the applicant's", () => {
    const d = doc(
      para("p1", s("My manager pulled me aside after the review.", "composed", ["F03"])),
    );
    expect(factMismatch(d, { facts })).toEqual([]);
  });

  it("does not compare a duration with a head count, or a sentence about something else", () => {
    const d = doc(
      para(
        "p1",
        s("I spent 9 years with that team.", "composed", ["F01"]),
        s("The village had 400 households.", "composed", []),
      ),
    );
    expect(factMismatch(d, { facts })).toEqual([]);
  });

  it("checks percentages against the cited fact", () => {
    const d = doc(para("p1", s("Revenue grew 40% that year.", "composed", ["F02"])));
    expect(factMismatch(d, { facts })[0]?.explanation).toContain('"40%"');
  });

  it("checks titles and months", () => {
    const title = doc(
      para("p1", s("As a Product Manager, I owned the roadmap.", "composed", ["F03"])),
    );
    expect(factMismatch(title, { facts })).toHaveLength(1);
    const okTitle = doc(
      para("p1", s("As a Senior Analyst, I owned the model.", "composed", ["F03"])),
    );
    expect(factMismatch(okTitle, { facts })).toEqual([]);
    const month = doc(para("p1", s("I was promoted in June 2023.", "composed", ["F04"])));
    expect(factMismatch(month, { facts })).toHaveLength(1);
  });

  it("does nothing without facts", () => {
    expect(factMismatch(doc(para("p1", "I led 15 people.")))).toEqual([]);
  });
});

describe("findSchoolTerms", () => {
  it("finds pack terms and school-shaped names", () => {
    const found = findSchoolTerms(
      "I want to join the Harborview Energy Club and take Ledger Lab.",
      ["Ledger Lab"],
    );
    expect(found.map((t) => [t.text, t.via])).toEqual([
      ["Harborview Energy Club", "shape"],
      ["Ledger Lab", "pack"],
    ]);
  });

  it("ignores an institution noun with no name in front of it", () => {
    expect(findSchoolTerms("The Fund grew fast. Our Studio was small.")).toEqual([]);
  });

  it("finds professors and class statistics", () => {
    expect(findSchoolTerms("Professor Okafor teaches it.")[0]?.text).toBe("Professor Okafor");
    expect(findSchoolTerms("40% of the class works abroad.")).toHaveLength(1);
  });
});

describe("unverifiedSchool", () => {
  const ctx = {
    schoolTerms: ["Ledger Lab"],
    currentCycle: "2026-27",
    packItems: [
      { code: "K01", verifiedAt: "2026-08-01", cycle: "2026-27" },
      { code: "K02", verifiedAt: null, cycle: "2026-27" },
      { code: "K03", verifiedAt: "2025-08-01", cycle: "2025-26" },
    ],
  };

  it("is a must fix for a school term with no K source", () => {
    const d = doc(para("p1", s("Ledger Lab is why I am applying.", "composed", [])));
    const [f] = unverifiedSchool(d, ctx);
    expect(f).toMatchObject({ severity: "must", location: { paragraph_id: "p1", sentence: 0 } });
    expect(f?.explanation).toBe('"Ledger Lab" is a school detail with no verified source.');
  });

  it("passes a verified K source from the current cycle", () => {
    const d = doc(para("p1", s("Ledger Lab is why I am applying.", "composed", ["K01"])));
    expect(unverifiedSchool(d, ctx)).toEqual([]);
  });

  it("rejects an unverified or last-cycle K source", () => {
    for (const code of ["K02", "K03", "K99"]) {
      const d = doc(para("p1", s("Ledger Lab is why I am applying.", "composed", [code])));
      expect(unverifiedSchool(d, ctx)[0]?.explanation).toContain(
        "hasn't been verified for 2026-27",
      );
    }
  });

  it("lets the applicant's own club stand when the sentence cites their file", () => {
    const own = doc(
      para("p1", s("I founded the Riverside Robotics Club in college.", "verbatim", ["S02"])),
    );
    expect(unverifiedSchool(own, ctx)).toEqual([]);
    const bare = doc(para("p1", s("The Riverside Robotics Club drew me in.", "composed", [])));
    expect(unverifiedSchool(bare, ctx)).toHaveLength(1);
  });

  it("validates pack sources by verification and cycle", () => {
    expect(
      isValidPackSource({ code: "K01", verifiedAt: "2026-08-01", cycle: "2026-27" }, "2026-27"),
    ).toBe(true);
    expect(
      isValidPackSource({ code: "K01", verifiedAt: "2026-08-01", cycle: "2025-26" }, "2026-27"),
    ).toBe(false);
    expect(isValidPackSource({ code: "K01", verifiedAt: null, cycle: "2026-27" }, "2026-27")).toBe(
      false,
    );
    expect(isValidPackSource(undefined, "2026-27")).toBe(false);
  });
});
