import { describe, expect, it } from "vitest";
import { curveTo, threadPath, threadsFor, usedStories, type ThreadAnchors } from "./threads";
import type { KitDeliverable } from "./types";

const deliverable = (
  key: string,
  status: KitDeliverable["status"],
  storyId: string | null,
): KitDeliverable => ({
  key,
  title: key,
  prompt: "A prompt.",
  limit: "200 words",
  status,
  storyId,
  text: "",
});

const ANCHORS: ThreadAnchors = {
  origin: { x: 100, y: 100 },
  stories: {
    S01: { enter: { x: 200, y: 60 }, exit: { x: 320, y: 60 } },
    S02: { enter: { x: 200, y: 120 }, exit: { x: 300, y: 120 } },
  },
  ports: { "essay-1": { x: 500, y: 40 }, "essay-2": { x: 500, y: 240 } },
};

describe("curveTo", () => {
  it("leaves and arrives horizontally, with control points halfway across", () => {
    expect(curveTo({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe("C 50 0, 50 50, 100 50");
  });

  it("rounds to a tenth of a pixel", () => {
    expect(curveTo({ x: 0.123, y: 0.456 }, { x: 10.049, y: 20.06 })).toBe(
      "C 5.1 0.5, 5.1 20.1, 10 20.1",
    );
  });
});

describe("threadPath", () => {
  it("runs from the Voiceprint into the story, then out past its label to the port", () => {
    expect(threadPath({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 30, y: 10 }, { x: 50, y: 0 })).toBe(
      "M 0 0 C 5 0, 5 10, 10 10 M 30 10 C 40 10, 40 0, 50 0",
    );
  });
});

describe("threadsFor", () => {
  it("draws a thread for every decided deliverable whose anchors exist", () => {
    const threads = threadsFor(
      [
        deliverable("essay-1", "drafting", "S01"),
        deliverable("essay-2", "mapped", "S02"),
        deliverable("essay-3", "waiting", null),
        deliverable("missing-port", "ready", "S01"),
        deliverable("missing-story", "ready", "S09"),
      ],
      ANCHORS,
    );
    expect(threads.map((t) => [t.key, t.storyId, t.status])).toEqual([
      ["essay-1", "S01", "drafting"],
      ["essay-2", "S02", "mapped"],
    ]);
    expect(threads[0]!.d).toBe(
      "M 100 100 C 150 100, 150 60, 200 60 M 320 60 C 410 60, 410 40, 500 40",
    );
  });

  it("draws nothing before the layout has been measured", () => {
    expect(threadsFor([deliverable("essay-1", "ready", "S01")], null)).toEqual([]);
  });

  it("ignores a story id on a deliverable still waiting for the file map", () => {
    expect(threadsFor([deliverable("essay-1", "waiting", "S01")], ANCHORS)).toEqual([]);
  });
});

describe("usedStories", () => {
  it("lists the stories decided deliverables use, once each", () => {
    const used = usedStories([
      deliverable("a", "ready", "S01"),
      deliverable("b", "drafting", "S01"),
      deliverable("c", "waiting", "S02"),
      deliverable("d", "mapped", "S03"),
    ]);
    expect([...used]).toEqual(["S01", "S03"]);
  });
});
