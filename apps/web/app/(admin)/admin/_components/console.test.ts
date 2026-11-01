import { describe, expect, it } from "vitest";
import { displayValue, wordDiff } from "./diff";
import { toEditable, toStored } from "./rounds";

describe("wordDiff", () => {
  it("marks only the words that changed", () => {
    expect(wordDiff("due 6 January 2027", "due 13 January 2027")).toEqual([
      { kind: "same", text: "due " },
      { kind: "removed", text: "6" },
      { kind: "added", text: "13" },
      { kind: "same", text: " January 2027" },
    ]);
  });

  it("shows a new value as added and an emptied one as removed", () => {
    expect(wordDiff("", "250")).toEqual([{ kind: "added", text: "250" }]);
    expect(wordDiff("250", "")).toEqual([{ kind: "removed", text: "250" }]);
  });

  it("formats non-string values as JSON", () => {
    expect(displayValue({ kind: "words", value: 250 })).toContain('"value": 250');
    expect(displayValue(null)).toBe("");
  });
});

describe("rounds with deadline times and zones", () => {
  it("keeps the time and zone in the notes' first line and reads them back", () => {
    const stored = toStored({
      name: "R1",
      deadline: "2026-09-16",
      time: "17:00",
      timeZone: "America/New_York",
      decisionDate: "",
      interviewInvitesWindow: "",
      notes: "Scholarship consideration",
    });
    expect(stored.notes).toBe("Due 17:00 America/New_York\nScholarship consideration");
    expect(stored.decisionDate).toBeNull();
    const back = toEditable(stored);
    expect(back).toMatchObject({
      time: "17:00",
      timeZone: "America/New_York",
      notes: "Scholarship consideration",
    });
  });

  it("stores no time without its zone", () => {
    const stored = toStored({ ...toEditable({ name: "R2", deadline: null }), time: "12:00" });
    expect(stored.notes).toBeNull();
    expect(stored.deadline).toBeNull();
  });
});
