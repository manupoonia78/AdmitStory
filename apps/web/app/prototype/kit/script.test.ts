import { describe, expect, it } from "vitest";
import {
  GAP_QUESTIONS,
  KIT_DURATION_MS,
  SCHOOL,
  STORIES,
  fileMapSummary,
  kitStateAt,
  revealed,
} from "./script";

const ORDER = {
  waiting: 0,
  active: 1,
  done: 2,
  mapped: 1,
  drafting: 2,
  ready: 3,
  failed: 3,
} as const;

describe("kitStateAt", () => {
  it("starts with nothing decided and positioning under way", () => {
    const state = kitStateAt(0);
    expect(state.stages.map((s) => s.status)).toEqual([
      "active",
      "waiting",
      "waiting",
      "waiting",
      "waiting",
    ]);
    expect(state.deliverables.every((d) => d.status === "waiting" && d.storyId === null)).toBe(
      true,
    );
    expect(state.deliverables.every((d) => d.text === "")).toBe(true);
    expect(state.gapCount).toBeNull();
    expect(state.done).toBe(false);
  });

  it("finishes everything within the run, about 40 seconds", () => {
    const state = kitStateAt(KIT_DURATION_MS);
    expect(state.done).toBe(true);
    expect(state.stages.every((s) => s.status === "done")).toBe(true);
    expect(state.deliverables.every((d) => d.status === "ready")).toBe(true);
    for (const d of state.deliverables) expect(d.text).toBe(d.reserve);
    expect(kitStateAt(KIT_DURATION_MS - 1_000).done).toBe(true);
    expect(kitStateAt(30_000).done).toBe(false);
  });

  it("only ever moves forwards: statuses never step back and text only grows", () => {
    let previous = kitStateAt(0);
    for (let ms = 100; ms <= KIT_DURATION_MS; ms += 100) {
      const next = kitStateAt(ms);
      next.stages.forEach((s, i) => {
        expect(ORDER[s.status]).toBeGreaterThanOrEqual(ORDER[previous.stages[i]!.status]);
      });
      next.deliverables.forEach((d, i) => {
        const before = previous.deliverables[i]!;
        expect(ORDER[d.status]).toBeGreaterThanOrEqual(ORDER[before.status]);
        expect(d.text.startsWith(before.text)).toBe(true);
      });
      previous = next;
    }
  });

  it("maps a story to every deliverable before any drafting starts", () => {
    const fileMapDone = kitStateAt(11_500);
    expect(fileMapDone.stages[1]).toMatchObject({ status: "done", actionLabel: "Read it now" });
    expect(fileMapDone.deliverables.every((d) => d.storyId !== null)).toBe(true);
    const storyIds = new Set(STORIES.map((s) => s.id));
    for (const d of fileMapDone.deliverables) expect(storyIds.has(d.storyId!)).toBe(true);
  });

  it("names the essay being drafted and its story, in the spec's wording", () => {
    expect(kitStateAt(16_000).stages[2]).toMatchObject({
      status: "active",
      detail: "Drafting Essay 2 from your story about eight people in a park",
    });
    expect(kitStateAt(12_000).stages[2]?.detail).toBe(
      "Drafting Essay 1 from your story about the night-shift fix",
    );
  });

  it("finds the gap questions once the file map is done", () => {
    expect(kitStateAt(11_999).gapCount).toBeNull();
    expect(kitStateAt(12_000).gapCount).toBe(GAP_QUESTIONS.length);
  });

  it("keeps every draft's reserved shape from the very start", () => {
    for (const d of kitStateAt(0).deliverables) expect(typeof d.reserve).toBe("string");
  });

  it("uses only the fictional school", () => {
    expect(SCHOOL.name).toBe("Northfield School of Management");
    const summary = fileMapSummary();
    expect(summary).toHaveLength(5);
    expect(summary[0]).toEqual({ title: "Essay 1", story: "The night-shift fix" });
  });
});

describe("revealed", () => {
  it("streams from empty to the whole text, arriving before the window closes", () => {
    const text = "One two. Three four.";
    expect(revealed(text, 0, 1_000, 5_000)).toBe("");
    expect(revealed(text, 1_000, 1_000, 5_000)).toBe("");
    expect(revealed(text, 2_400, 1_000, 5_000).length).toBe(10);
    expect(revealed(text, 3_800, 1_000, 5_000)).toBe(text);
    expect(revealed(text, 9_000, 1_000, 5_000)).toBe(text);
  });
});
