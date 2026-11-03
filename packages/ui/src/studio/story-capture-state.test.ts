import { describe, expect, it } from "vitest";
import {
  announceStory,
  captureReducer,
  initCaptureState,
  landedStories,
  type CaptureAction,
  type CaptureState,
} from "./story-capture-state";
import type { StoryCardData } from "./story-card";

const story = (id: string, nickname: string): StoryCardData => ({
  id,
  nickname,
  era: "2024",
  context: "Work",
  traits: ["initiative"],
  status: { tone: "needs", label: "Needs one number" },
});

const PARK = story("park", "Eight people in a park");
const FIX = story("fix", "The night-shift fix");
const VENDOR = story("vendor", "The vendor who said no");
const FROM = { x: 10, y: 400, width: 300, height: 30 };

const run = (state: CaptureState, ...actions: CaptureAction[]) =>
  actions.reduce(captureReducer, state);

const order = (state: CaptureState) =>
  state.items.map((item) => `${item.story.id}${item.landed ? "" : "*"}`);

describe("captureReducer", () => {
  it("reserves a slot and lights the phrase on capture, without counting the story yet", () => {
    const state = run(initCaptureState([PARK]), { type: "capture", story: FIX, sourceId: "seg-4" });
    expect(order(state)).toEqual(["fix*", "park"]);
    expect(landedStories(state)).toEqual([PARK]);
    expect(state.ignited).toEqual(["seg-4"]);
    expect(state.announcement).toBe("");
  });

  it("flies after launch, then lands: counted, announced and the phrase unlit", () => {
    const state = run(
      initCaptureState([PARK]),
      { type: "capture", story: FIX, sourceId: "seg-4" },
      { type: "launch", id: "fix", from: FROM },
    );
    expect(state.flights).toEqual([{ id: "fix", from: FROM }]);
    const landed = captureReducer(state, { type: "land", id: "fix" });
    expect(order(landed)).toEqual(["fix", "park"]);
    expect(landed.flights).toEqual([]);
    expect(landed.ignited).toEqual([]);
    expect(landed.announcement).toBe("New story added to your shelf: The night-shift fix.");
  });

  it("handles a second detection mid-flight: both land, in captured order, each announced", () => {
    let state = run(
      initCaptureState([PARK]),
      { type: "capture", story: FIX, sourceId: "seg-4" },
      { type: "launch", id: "fix", from: FROM },
      { type: "capture", story: VENDOR, sourceId: "seg-6" },
    );
    expect(order(state)).toEqual(["vendor*", "fix*", "park"]);
    expect(state.ignited).toEqual(["seg-4", "seg-6"]);

    // The newer flight is shorter and lands first: the cards keep their places.
    state = run(
      state,
      { type: "launch", id: "vendor", from: FROM },
      { type: "land", id: "vendor" },
    );
    expect(order(state)).toEqual(["vendor", "fix*", "park"]);
    expect(state.announcement).toBe(announceStory(VENDOR));
    expect(state.ignited).toEqual(["seg-4"]);

    state = captureReducer(state, { type: "land", id: "fix" });
    expect(order(state)).toEqual(["vendor", "fix", "park"]);
    expect(landedStories(state)).toHaveLength(3);
    expect(state.flights).toEqual([]);
    expect(state.announcement).toBe(announceStory(FIX));
  });

  it("ignores a story it already has, and stray launches and landings", () => {
    const start = run(initCaptureState([PARK]), { type: "capture", story: FIX });
    expect(captureReducer(start, { type: "capture", story: FIX })).toBe(start);
    expect(captureReducer(start, { type: "capture", story: PARK })).toBe(start);
    expect(captureReducer(start, { type: "land", id: "nobody" })).toBe(start);
    expect(captureReducer(start, { type: "launch", id: "park", from: FROM })).toBe(start);
    const flying = captureReducer(start, { type: "launch", id: "fix", from: FROM });
    expect(captureReducer(flying, { type: "launch", id: "fix", from: FROM })).toBe(flying);
  });

  it("lands straight away when there is nowhere to fly from", () => {
    const state = run(
      initCaptureState(),
      { type: "capture", story: FIX, sourceId: "gone" },
      { type: "launch", id: "fix", from: null },
    );
    expect(order(state)).toEqual(["fix"]);
    expect(state.flights).toEqual([]);
    expect(state.announcement).toBe(announceStory(FIX));
  });

  it("adds an instant capture (reduced motion) to the shelf at once, without lighting anything", () => {
    const state = captureReducer(initCaptureState([PARK]), {
      type: "capture",
      story: FIX,
      sourceId: "seg-4",
      instant: true,
    });
    expect(order(state)).toEqual(["fix", "park"]);
    expect(state.ignited).toEqual([]);
    expect(state.announcement).toBe(announceStory(FIX));
  });

  it("resets to a given shelf", () => {
    const state = run(
      initCaptureState([PARK]),
      { type: "capture", story: FIX },
      {
        type: "reset",
        stories: [VENDOR],
      },
    );
    expect(order(state)).toEqual(["vendor"]);
    expect(state.flights).toEqual([]);
  });
});
