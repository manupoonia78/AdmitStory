import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { replaceValue } = await import("./fix");

describe("replaceValue (the one-click consistency fix)", () => {
  it("replaces the value where it stands alone, ignoring case", () => {
    expect(replaceValue("Led a team of 15 engineers.", "15", "13")).toBe(
      "Led a team of 13 engineers.",
    );
    expect(
      replaceValue("Joined meridian health in 2020.", "Meridian Health", "Meridian Health Systems"),
    ).toBe("Joined Meridian Health Systems in 2020.");
  });

  it("never touches the value inside a longer number or word", () => {
    expect(replaceValue("Since 2015 I led 150 people; the team of 15 grew.", "15", "13")).toBe(
      "Since 2015 I led 150 people; the team of 13 grew.",
    );
    expect(replaceValue("Raised $1.2M in 2012.", "$1.2M", "$1.4M")).toBe("Raised $1.4M in 2012.");
  });

  it("returns null when the value isn't there", () => {
    expect(replaceValue("Since 2015 I led 150 people.", "15", "13")).toBeNull();
    expect(replaceValue("Anything.", "  ", "13")).toBeNull();
  });
});
