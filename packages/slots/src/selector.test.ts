import { describe, expect, it } from "vitest";
import { DEFAULT_NEED, gapOnlySlots, packNeed, selectSlot } from "./selector";
import { SLOTS } from "./slots";

// Phase 3 AC: need() comes from the applicant's schools' published prompts (§5.2).

const now = new Date("2026-11-01T10:00:00Z");

describe("packNeed", () => {
  it("is the typical need when no school has a published pack", () => {
    expect(packNeed([])).toBe(DEFAULT_NEED);
  });

  it("fully needs the slots behind the archetypes a school asks for, and few others", () => {
    const need = packNeed(["SETBACK"]);
    const failureSlots = SLOTS.filter((s) => s.archetypes.includes("SETBACK"));
    expect(failureSlots.length).toBeGreaterThan(0);
    for (const slot of failureSlots) expect(need(slot, {})).toBe(1);
    const unasked = SLOTS.find(
      (s) => s.archetypes.length > 0 && !s.archetypes.includes("SETBACK") && !s.consumers?.length,
    )!;
    expect(need(unasked, {})).toBeLessThan(DEFAULT_NEED(unasked, {}));
  });

  it("asks a school's archetype first in hurry mode", () => {
    const need = packNeed(["SETBACK"]);
    const only = gapOnlySlots(new Map(), {}, 3, need);
    const picked = selectSlot({ now, need, only });
    expect(picked?.slot.archetypes).toContain("SETBACK");
  });

  it("keeps reapplicant archetypes out unless the applicant is reapplying", () => {
    const reappSlot = SLOTS.find((s) => s.reapplicantOnly);
    if (!reappSlot) return;
    expect(gapOnlySlots(new Map(), {}, 200)).not.toContain(reappSlot.key);
    expect(gapOnlySlots(new Map(), { isReapplicant: true }, 200)).toContain(reappSlot.key);
  });
});
