import { SharedElement } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { BackOnEscape } from "../back-on-escape";
import { STORIES, STORY_CLOSE, STORY_OPEN, getStory, storyTransitionName } from "../stories";

const SHELF = "/prototype/transitions";

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return STORIES.map((story) => ({ id: story.id }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const story = getStory((await params).id);
  return { title: story ? story.title : "Story not found" };
}

/**
 * One story. Its plane, title and golden line arrive from the shelf as shared elements; the
 * written-up story rises in beneath them.
 */
export default async function StoryPage({ params }: StoryPageProps) {
  const story = getStory((await params).id);
  if (!story) notFound();

  const sections = [
    { heading: "Situation and stakes", body: story.situation },
    { heading: "What I did", body: story.action },
    { heading: "Result", body: story.result },
    { heading: "Reflection", body: story.reflection },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14">
      <BackOnEscape href={SHELF} />
      <Link
        href={SHELF}
        transitionTypes={[STORY_CLOSE]}
        aria-keyshortcuts="Escape"
        className="self-start rounded-control text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
      >
        All stories
      </Link>

      <section
        aria-labelledby="story-title"
        className="relative flex flex-col gap-6 rounded-plane p-6 sm:p-10"
      >
        <SharedElement
          name={storyTransitionName(story.id, "surface")}
          surface
          className="absolute inset-0 rounded-plane border border-edge bg-depth shadow-plane"
        />
        <p className="relative text-sm text-text-soft">
          {story.context}, {story.year}
        </p>
        <SharedElement name={storyTransitionName(story.id, "title")} className="relative w-fit">
          <h1 id="story-title" className="text-display text-text">
            {story.title}
          </h1>
        </SharedElement>
        <SharedElement name={storyTransitionName(story.id, "line")} className="relative">
          <p className="max-w-essay font-reading text-read-lg">
            <mark>{story.line}</mark>
          </p>
        </SharedElement>
        <p className="relative text-sm text-text-soft">
          Shows {story.traits.join(" and ")}. Used in {story.usedIn}.
        </p>
      </section>

      <ViewTransition
        enter={{ [STORY_OPEN]: "route-in", default: "none" }}
        exit={{ [STORY_CLOSE]: "route-out", default: "none" }}
        default="none"
      >
        <div className="flex max-w-essay flex-col gap-8">
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-text">{section.heading}</h2>
              <p className="font-reading text-read text-text">{section.body}</p>
            </section>
          ))}
        </div>
      </ViewTransition>
    </div>
  );
}
