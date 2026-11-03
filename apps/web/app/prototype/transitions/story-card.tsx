"use client";

import { EdgeLight, SharedElement, useEdgeLight } from "@admitstory/ui";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { STORY_OPEN, storyTransitionName, type Story } from "./stories";

/** The card a story page was opened from, so focus can land back on it on return. */
let openedFrom: string | null = null;

/**
 * A story on the shelf. Its plane, title and golden line are shared elements: choosing the card
 * flies all three into the story's page on the drift spring, and back on return. The card catches
 * the edge light under the cursor; it does not lift on hover (spec §6.6).
 *
 * The link lies over the whole card rather than wrapping it: named by the title and described by
 * the golden line, it holds no visible text of its own, so its name never leaves out words a
 * speech user can see on it (WCAG 2.5.3), and a screen reader doesn't hear the card twice.
 */
export function StoryCard({ story }: { story: Story }) {
  const titleId = useId();
  const lineId = useId();
  const focusRef = useRef<HTMLAnchorElement | null>(null);
  const edgeLight = useEdgeLight<HTMLDivElement>();

  // Back from the story page: keyboard focus returns to the card it was opened from.
  useEffect(() => {
    if (openedFrom !== story.id) return;
    openedFrom = null;
    focusRef.current?.focus({ preventScroll: true });
  }, [story.id]);

  return (
    <div
      ref={edgeLight}
      className="relative flex h-full min-h-60 flex-col gap-4 rounded-plane p-6 text-text"
    >
      <SharedElement
        name={storyTransitionName(story.id, "surface")}
        surface
        className="absolute inset-0 rounded-plane border border-edge bg-depth shadow-plane"
      />
      <EdgeLight />
      <p className="relative text-sm text-text-soft">
        {story.context}, {story.year}
      </p>
      <SharedElement name={storyTransitionName(story.id, "title")} className="relative w-fit">
        <h2 id={titleId} className="text-lg font-semibold">
          {story.title}
        </h2>
      </SharedElement>
      <SharedElement name={storyTransitionName(story.id, "line")} className="relative">
        <p id={lineId} className="font-reading text-read">
          <mark>{story.line}</mark>
        </p>
      </SharedElement>
      <p className="relative mt-auto text-sm text-text-soft">{story.traits.join(" · ")}</p>
      {/* Last, so it sits over everything above and the whole card takes the click. */}
      <Link
        ref={focusRef}
        href={`/prototype/transitions/${story.id}`}
        // The story page is fetched ahead, so the flight starts on the same frame as the click.
        prefetch
        transitionTypes={[STORY_OPEN]}
        onClick={() => {
          openedFrom = story.id;
        }}
        aria-labelledby={titleId}
        aria-describedby={lineId}
        className="absolute inset-0 rounded-plane"
      />
    </div>
  );
}
