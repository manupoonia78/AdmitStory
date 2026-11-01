import { describe, expect, it } from "vitest";
import { collectFootnotes, formatFigure, isUncitedFigure } from "./matrix";
import type { MatrixGroup } from "./types";

const PROFILE = { source: "Class profile", year: 2026, verifiedOn: "2026-09-12" };
const JOBS = { source: "Employment report", year: 2025 };

describe("formatFigure", () => {
  it("typesets numbers, percentages and money", () => {
    expect(formatFigure({ value: 715 })).toBe("715");
    expect(formatFigure({ value: 3.5, digits: 2 })).toBe("3.50");
    expect(formatFigure({ value: 18, style: "percent" })).toBe("18%");
    expect(formatFigure({ value: 165000, style: "currency", currency: "USD" })).toBe("$165,000");
  });
});

describe("citations in the table", () => {
  it("treats a figure without a usable citation as uncited", () => {
    expect(isUncitedFigure({ kind: "number", value: 1, citation: PROFILE })).toBe(false);
    expect(isUncitedFigure({ kind: "number", value: 1 } as never)).toBe(true);
    expect(
      isUncitedFigure({ kind: "median", standing: "near", citation: { source: "x" } } as never),
    ).toBe(true);
    expect(isUncitedFigure({ kind: "text", text: "Case method" })).toBe(false);
  });

  it("numbers each source once, in reading order", () => {
    const groups: MatrixGroup[] = [
      {
        id: "class",
        label: "Class profile",
        rows: [
          {
            id: "gmat",
            label: "GMAT",
            cells: {
              a: { kind: "median", standing: "above", median: 705, citation: PROFILE },
              b: { kind: "number", value: 18, style: "percent", citation: JOBS },
            },
          },
          {
            id: "gpa",
            label: "GPA",
            cells: { a: { kind: "number", value: 3.5, digits: 2, citation: { ...PROFILE } } },
          },
        ],
      },
    ];
    const footnotes = collectFootnotes(groups, ["a", "b"]);
    expect(footnotes.list.map((c) => c.source)).toEqual(["Class profile", "Employment report"]);
    expect(footnotes.numberOf(JOBS)).toBe(2);
  });
});
