import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isRefreshDay } = await import("./refresh");

describe("isRefreshDay (§9.3: weekly August–January, monthly otherwise)", () => {
  it("runs every week from August to January", () => {
    expect(isRefreshDay(new Date("2026-08-24T06:00:00Z"))).toBe(true);
    expect(isRefreshDay(new Date("2026-11-23T06:00:00Z"))).toBe(true);
    expect(isRefreshDay(new Date("2027-01-25T06:00:00Z"))).toBe(true);
  });

  it("runs only in the first week of the month from February to July", () => {
    expect(isRefreshDay(new Date("2027-03-01T06:00:00Z"))).toBe(true);
    expect(isRefreshDay(new Date("2027-03-08T06:00:00Z"))).toBe(false);
    expect(isRefreshDay(new Date("2027-07-26T06:00:00Z"))).toBe(false);
  });
});
