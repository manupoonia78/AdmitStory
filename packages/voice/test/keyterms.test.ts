import { describe, expect, it } from "vitest";
import { DEEPGRAM } from "../src/config";
import { MBA_TERMS, buildKeyterms, cleanKeyterm, employersFromFacts } from "../src/keyterms";

const schools = ["Harvard Business School", "Wharton (Penn)", "ISB (India)", "Oxford Saïd"];

describe("keyterms (§7.5)", () => {
  it("puts the applicant's employers and people first, then MBA terms, then schools", () => {
    const terms = buildKeyterms({ employers: ["Meridian Health"], people: ["Asha Rao"], schools });
    expect(terms.slice(0, 2)).toEqual(["Meridian Health", "Asha Rao"]);
    expect(terms.slice(2, 2 + MBA_TERMS.length)).toEqual([...MBA_TERMS]);
    expect(terms.slice(-4)).toEqual(["Harvard Business School", "Wharton", "ISB", "Oxford Saïd"]);
  });

  it("dedupes case-insensitively", () => {
    const terms = buildKeyterms({ employers: ["GMAT"], people: ["asha rao", "Asha Rao"] });
    expect(terms.filter((t) => t.toLowerCase() === "gmat")).toHaveLength(1);
    expect(terms.filter((t) => t.toLowerCase() === "asha rao")).toHaveLength(1);
  });

  it("caps the count and total length within Deepgram's limits", () => {
    const many = Array.from({ length: 200 }, (_, i) => `Person Number ${i} Surname`);
    const terms = buildKeyterms({ people: many, schools });
    expect(terms.length).toBeLessThanOrEqual(DEEPGRAM.maxKeyterms);
    expect(terms.join("").length).toBeLessThanOrEqual(DEEPGRAM.maxKeytermChars);
  });

  it("drops separators Deepgram would read literally, and over-long or empty terms", () => {
    expect(cleanKeyterm("Acme, Inc; Ltd")).toBe("Acme Inc Ltd");
    expect(cleanKeyterm("x")).toBeNull();
    expect(cleanKeyterm("a".repeat(DEEPGRAM.maxKeytermLength + 1))).toBeNull();
    expect(cleanKeyterm("Procter & Gamble")).toBe("Procter & Gamble");
  });

  it("finds employers among the extractor's fact keys", () => {
    expect(
      employersFromFacts([
        { key: "current_employer", value: "Meridian Health" },
        { key: "previous_company", value: "Lumen Labs" },
        { key: "team_size", value: "13" },
      ]),
    ).toEqual(["Meridian Health", "Lumen Labs"]);
  });
});
