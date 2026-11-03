import type { Metadata } from "next";
import { ViewTransition } from "react";
import { StoryCard } from "./story-card";
import { STORIES, STORY_CLOSE, STORY_OPEN } from "./stories";

export const metadata: Metadata = { title: "Route transitions" };

/**
 * The shelf: six stories from a fictional applicant. Choosing one flies its card into the story's
 * page (spec §6.6: shared elements, not page swaps); the rest of the shelf steps back in 120 ms.
 */
export default function TransitionsPage() {
  return (
    <ViewTransition
      enter={{ [STORY_CLOSE]: "route-in", default: "none" }}
      exit={{ [STORY_OPEN]: "route-out", default: "none" }}
      default="none"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-display-sm text-text">Your story shelf</h1>
          <p className="max-w-prose text-lg text-text-soft">
            Choose a story. The card travels into its page, and back again when you return. Press
            Escape on a story to come back here.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORIES.map((story) => (
            <li key={story.id}>
              <StoryCard story={story} />
            </li>
          ))}
        </ul>
      </div>
    </ViewTransition>
  );
}
