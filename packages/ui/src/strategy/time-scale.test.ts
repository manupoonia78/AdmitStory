import { describe, expect, it } from "vitest";
import {
  calendarDay,
  daysLeftText,
  daysUntil,
  formatDeadline,
  monthTicks,
  positionIn,
  timeDomain,
} from "./time-scale";

describe("time scale", () => {
  it("counts days in the applicant's time zone", () => {
    // 23:59 New York on 6 Jan is already 7 Jan in Kolkata.
    const deadline = "2027-01-06T23:59:00-05:00";
    expect(daysUntil(deadline, "2027-01-06T12:00:00Z", "America/New_York")).toBe(0);
    expect(daysUntil(deadline, "2027-01-06T12:00:00Z", "Asia/Kolkata")).toBe(1);
    expect(calendarDay("1970-01-02T00:00:00Z", "UTC")).toBe(1);
  });

  it("says how long is left in words", () => {
    expect(daysLeftText(-1)).toBe("Passed");
    expect(daysLeftText(0)).toBe("Due today");
    expect(daysLeftText(1)).toBe("1 day left");
    expect(daysLeftText(12)).toBe("12 days left");
  });

  it("formats a deadline in the given zone", () => {
    expect(formatDeadline("2027-01-06T23:59:00-05:00", "Asia/Kolkata")).toMatch(/7 Jan 2027/);
  });

  it("spans today and every date, and places instants within it", () => {
    const domain = timeDomain(["2026-12-01T00:00:00Z"], "2026-10-01T00:00:00Z", 0);
    expect(positionIn(domain, "2026-10-01T00:00:00Z")).toBe(0);
    expect(positionIn(domain, "2026-12-01T00:00:00Z")).toBe(1);
    expect(positionIn(domain, "2027-06-01T00:00:00Z")).toBe(1);
    const labels = monthTicks(domain).map((tick) => tick.label);
    expect(labels).toEqual(["Nov 2026", "Dec"]);
  });
});

describe("house date style", () => {
  it("abbreviates September to three letters in English", async () => {
    const { formatDay } = await import("./time-scale");
    expect(formatDay("2026-09-12T12:00:00Z", "UTC")).toBe("12 Sep 2026");
  });
});
