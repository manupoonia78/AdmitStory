// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatrixTable } from "./matrix-table";
import type { MatrixColumn, MatrixGroup, MedianCell, NumberCell } from "./types";

const PROFILE = { source: "Class profile", year: 2026, verifiedOn: "2026-09-12" };
const JOBS = {
  source: "Employment report",
  year: 2025,
  url: "https://harbor.example.edu/jobs",
};

const COLUMNS: MatrixColumn[] = [
  { id: "northfield", label: "Northfield", meta: "Round 2" },
  { id: "harbor", label: "Harbor" },
];

const GROUPS: MatrixGroup[] = [
  {
    id: "class",
    label: "Class profile",
    rows: [
      {
        id: "gmat",
        label: "GMAT",
        hint: "You: 705",
        cells: {
          northfield: { kind: "median", standing: "near", median: 705, citation: PROFILE },
          harbor: { kind: "median", standing: "below", median: 725, citation: PROFILE },
        },
      },
    ],
  },
  {
    id: "outcomes",
    label: "Outcomes in product management",
    rows: [
      {
        id: "share",
        label: "Share of class",
        cells: {
          northfield: { kind: "number", value: 4, style: "percent", citation: JOBS },
          harbor: { kind: "empty", reason: "Not published" },
        },
      },
      {
        id: "base",
        label: "Median base",
        cells: {
          northfield: {
            kind: "number",
            value: 150000,
            style: "currency",
            currency: "USD",
            citation: JOBS,
          },
        },
      },
    ],
  },
];

describe("MatrixTable", () => {
  it("puts schools in columns and criteria in grouped rows", () => {
    render(<MatrixTable caption="Your schools side by side" columns={COLUMNS} groups={GROUPS} />);
    const table = screen.getByRole("table", { name: "Your schools side by side" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent?.trim()),
    ).toEqual(["Criterion", "Northfield Round 2", "Harbor"]);
    expect(within(table).getByRole("rowheader", { name: "GMAT You: 705" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Your schools side by side" }).tabIndex).toBe(0);
  });

  it("says the median standing in words, with the median beside it", () => {
    const { container } = render(
      <MatrixTable caption="Compare" columns={COLUMNS} groups={GROUPS} />,
    );
    const near = container.querySelector("[data-standing='near']")!;
    expect(near.textContent).toMatch(/^Near median.*Median 705/);
    expect(container.querySelector("[data-standing='below']")!.textContent).toMatch(/Below median/);
  });

  it("right-aligns figures in tabular numerals and marks every one with its source", () => {
    const { container } = render(
      <MatrixTable caption="Compare" columns={COLUMNS} groups={GROUPS} />,
    );
    const figures = [...container.querySelectorAll("td[data-kind='number']")];
    expect(figures.map((td) => td.textContent)).toEqual(["4%2", "$150,0002"]);
    for (const td of figures) {
      expect(td.className).toContain("text-right");
      expect(td.querySelector(".tabular-nums")).not.toBeNull();
      expect(td.querySelector("[data-citation]")).not.toBeNull();
    }
    const mark = screen.getAllByRole("link", { name: /^Source 2: Employment report, 2025\./ })[0]!;
    expect(mark.getAttribute("href")).toBe("#compare-source-2");
  });

  it("lists the numbered sources under the table, each once", () => {
    const { container } = render(
      <MatrixTable caption="Compare" columns={COLUMNS} groups={GROUPS} />,
    );
    const notes = [...container.querySelectorAll("figcaption li")];
    expect(notes.map((li) => li.id)).toEqual(["compare-source-1", "compare-source-2"]);
    expect(notes[0]!.textContent).toContain("Class profile, 2026. Verified 12 Sep 2026.");
    expect(
      within(notes[1] as HTMLElement).getByRole("link", { name: /Official page/ }),
    ).toBeTruthy();
  });

  it("never shows a figure that arrives without a source", () => {
    const uncited = { kind: "number", value: 99 } as unknown as NumberCell;
    const { container } = render(
      <MatrixTable
        caption="Compare"
        columns={COLUMNS}
        groups={[
          { id: "g", label: "G", rows: [{ id: "r", label: "R", cells: { northfield: uncited } }] },
        ]}
      />,
    );
    const cell = container.querySelector("td[data-kind='uncited']")!;
    expect(cell.textContent).toBe("Not shown: no source");
    expect(container.textContent).not.toContain("99");
    expect(container.querySelector("td[data-kind='empty']")!.textContent).toBe("Not published");
  });

  it("requires a citation on numeric cells at the type level", () => {
    // @ts-expect-error a number cell without a citation does not compile
    const cell: NumberCell = { kind: "number", value: 715 };
    expect(cell.value).toBe(715);
    // @ts-expect-error a median, a school figure too, needs its citation as well
    const median: MedianCell = { kind: "median", standing: "near", median: 715 };
    expect(median.standing).toBe("near");
  });
});
