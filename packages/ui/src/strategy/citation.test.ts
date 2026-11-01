import { describe, expect, it } from "vitest";
import { citationKey, citationText, formatVerifiedOn, isCitation } from "./citation";

describe("citations", () => {
  it("accepts a source and a year, and nothing less", () => {
    expect(isCitation({ source: "Class profile", year: 2026 })).toBe(true);
    expect(isCitation({ source: "Class profile", year: "2025–26" })).toBe(true);
    expect(isCitation({ source: "Class profile" })).toBe(false);
    expect(isCitation({ source: " ", year: 2026 })).toBe(false);
    expect(isCitation({ year: 2026 })).toBe(false);
    expect(isCitation(null)).toBe(false);
  });

  it("reads as a sentence with the verified date", () => {
    expect(citationText({ source: "Class profile", year: 2026, verifiedOn: "2026-09-12" })).toBe(
      "Class profile, 2026. Verified 12 Sep 2026.",
    );
    expect(citationText({ source: "Employment report", year: 2025 })).toBe(
      "Employment report, 2025.",
    );
  });

  it("formats a calendar date without shifting it by time zone", () => {
    expect(formatVerifiedOn("2026-01-01")).toBe("1 Jan 2026");
  });

  it("gives the same key to the same source", () => {
    expect(citationKey({ source: "A", year: 2026 })).toBe(citationKey({ source: "A", year: 2026 }));
    expect(citationKey({ source: "A", year: 2026 })).not.toBe(
      citationKey({ source: "A", year: 2025 }),
    );
  });
});
