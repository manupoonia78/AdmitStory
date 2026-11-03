// State of the story-capture choreography (spec §6.7), kept pure so interruption is testable.
//
// A capture moves a story through three steps: "capture" reserves its slot at the top of the shelf
// and lights the phrase it came from; "launch" (200 ms later) starts its flight from that phrase;
// "land" puts it on the shelf, counts it and announces it. Any number of captures can be at any
// step at once: a second story found mid-flight gets its own slot and flight, and neither waits
// for the other. Shelf order is fixed when a story is captured (newest first), whatever order the
// flights land in, so cards never swap places.

import type { Box } from "./flight-path";
import type { StoryCardData } from "./story-card";

export interface ShelfItem {
  story: StoryCardData;
  /** False while the story is igniting or in flight: its slot is reserved but empty. */
  landed: boolean;
}

export interface Flight {
  id: string;
  from: Box;
}

export interface CaptureState {
  /** Newest first. */
  items: ShelfItem[];
  flights: Flight[];
  /** Transcript segments lit in the applicant's hue. */
  ignited: string[];
  /** Which segment each in-progress story came from. */
  sources: Record<string, string>;
  /** The latest screen-reader announcement. */
  announcement: string;
}

export type CaptureAction =
  | { type: "capture"; story: StoryCardData; sourceId?: string; instant?: boolean }
  | { type: "launch"; id: string; from: Box | null }
  | { type: "land"; id: string }
  | { type: "reset"; stories: readonly StoryCardData[] };

export const announceStory = (story: StoryCardData) =>
  `New story added to your shelf: ${story.nickname}.`;

export function initCaptureState(stories: readonly StoryCardData[] = []): CaptureState {
  return {
    items: stories.map((story) => ({ story, landed: true })),
    flights: [],
    ignited: [],
    sources: {},
    announcement: "",
  };
}

export function landedStories(state: CaptureState): StoryCardData[] {
  return state.items.filter((item) => item.landed).map((item) => item.story);
}

function land(state: CaptureState, id: string): CaptureState {
  const item = state.items.find((entry) => entry.story.id === id);
  if (!item || item.landed) return state;
  const source = state.sources[id];
  const { [id]: _done, ...sources } = state.sources;
  return {
    items: state.items.map((entry) => (entry.story.id === id ? { ...entry, landed: true } : entry)),
    flights: state.flights.filter((flight) => flight.id !== id),
    // Another story in flight from the same segment keeps it lit.
    ignited:
      source && !Object.values(sources).includes(source)
        ? state.ignited.filter((segment) => segment !== source)
        : state.ignited,
    sources,
    announcement: announceStory(item.story),
  };
}

export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case "capture": {
      const { story, sourceId, instant } = action;
      // The extractor may report the same story twice; it is on the shelf once.
      if (state.items.some((item) => item.story.id === story.id)) return state;
      if (instant) {
        return {
          ...state,
          items: [{ story, landed: true }, ...state.items],
          announcement: announceStory(story),
        };
      }
      return {
        ...state,
        items: [{ story, landed: false }, ...state.items],
        ignited:
          sourceId && !state.ignited.includes(sourceId)
            ? [...state.ignited, sourceId]
            : state.ignited,
        sources: sourceId ? { ...state.sources, [story.id]: sourceId } : state.sources,
      };
    }
    case "launch": {
      const item = state.items.find((entry) => entry.story.id === action.id);
      if (!item || item.landed || state.flights.some((flight) => flight.id === action.id)) {
        return state;
      }
      // Nowhere to fly from (the phrase scrolled away or was never shown): it just appears.
      if (!action.from) return land(state, action.id);
      return { ...state, flights: [...state.flights, { id: action.id, from: action.from }] };
    }
    case "land":
      return land(state, action.id);
    case "reset":
      return initCaptureState(action.stories);
  }
}
