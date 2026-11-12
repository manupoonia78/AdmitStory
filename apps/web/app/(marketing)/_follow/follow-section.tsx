// Follow one sentence (direction §4.3, plan §9.2). This server markup is the stacked version that
// phones, tablets, touch, reduced motion and browsers without GSAP get, and it is complete on its
// own: four chapters in reading order, each with its statement, paragraph and frame.
//
// On desktop with a mouse and motion welcome, FollowHost loads ./follow-sequence, which rearranges
// the same DOM into the pinned two-column stage (class "is-pinned") and steps between chapters.
// The articles stay in the DOM and in order, so a screen reader reads the same four chapters.

import {
  FOLLOW_CHAPTERS,
  FOLLOW_HEADING,
  chapterPosition,
  type FollowChapter,
} from "../_copy/follow";
import { PlaneFrame, ScaledFrame } from "../_ui/frames";
import { FictionalNote, MarginNote } from "../_ui/notes";
import { sampleHueStyle } from "../_ui/sample-hue";
import { SECTION_GRID } from "../_ui/section";
import { FollowHost } from "./follow-host";
import { EssayFrameIsland, StoryFrameIsland, StudioFrameIsland } from "./frames/islands";
import { InterviewFrame } from "./frames/interview-frame";

/** Every frame is designed at 720 × 480 and scaled to its column (no reflow, no CLS). */
export const FRAME_WIDTH = 720;
export const FRAME_HEIGHT = 480;

function Frame({ chapter }: { chapter: FollowChapter }) {
  switch (chapter.id) {
    case "studio":
      return <StudioFrameIsland islandClassName="h-full" />;
    case "story":
      return <StoryFrameIsland islandClassName="h-full" />;
    case "essay":
      return <EssayFrameIsland islandClassName="h-full" />;
    case "interview":
      return <InterviewFrame />;
  }
}

export function FollowSection() {
  return (
    <section
      id="follow"
      aria-labelledby="follow-title"
      data-theme="night"
      className="follow grain relative bg-space py-24 text-text sm:py-32"
      style={sampleHueStyle()}
    >
      <h2 id="follow-title" className="sr-only">
        {FOLLOW_HEADING}
      </h2>
      <div className={`follow-stage ${SECTION_GRID}`}>
        <div className="follow-chapters col-span-4 flex flex-col gap-24 sm:col-span-8 sm:gap-32 lg:col-span-12">
          {FOLLOW_CHAPTERS.map((chapter, index) => (
            <article
              key={chapter.id}
              data-chapter={index + 1}
              aria-labelledby={`follow-${chapter.id}`}
              className="follow-chapter grid grid-cols-4 gap-x-4 gap-y-10 sm:grid-cols-8 sm:gap-x-6 lg:grid-cols-12 lg:items-center"
            >
              <div className="follow-text col-span-4 sm:col-span-7 lg:col-span-5">
                <MarginNote className="follow-note flex items-center gap-3">
                  <span>{chapterPosition(index)}</span>
                  {chapter.label ? (
                    <span className="rounded-control border border-edge px-1.5 text-text">
                      {chapter.label}
                    </span>
                  ) : null}
                </MarginNote>
                <h3
                  id={`follow-${chapter.id}`}
                  className="follow-statement mt-5 font-display text-display text-text"
                >
                  {chapter.statement[0]} <br aria-hidden="true" />
                  {chapter.statement[1]}
                </h3>
                <p className="follow-paragraph mt-6 max-w-[34rem] font-reading text-read text-text-soft">
                  {chapter.paragraph}
                </p>
              </div>
              <figure className="follow-frame col-span-4 sm:col-span-8 lg:col-span-7">
                <PlaneFrame>
                  <ScaledFrame designWidth={FRAME_WIDTH} designHeight={FRAME_HEIGHT}>
                    {/* A picture of real UI: not focusable, described by the caption. */}
                    <div inert className="h-full">
                      <Frame chapter={chapter} />
                    </div>
                  </ScaledFrame>
                </PlaneFrame>
                <figcaption className="sr-only">{chapter.frameLabel}</figcaption>
              </figure>
            </article>
          ))}
        </div>
        <FictionalNote className="follow-fictional col-span-4 mt-16 sm:col-span-8 lg:col-span-12" />
      </div>
      <FollowHost />
    </section>
  );
}
