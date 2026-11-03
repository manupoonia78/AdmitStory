"use client";

// Chapter 2, the story (direction §4.3): the expanded StoryCard, its three confirmed facts, and
// the spoken phrase lit in --voice in the card's golden line (the Studio's capture treatment).

import { StatusLabel, StoryCard } from "@admitstory/ui";
import { STORY_FRAME } from "../../_copy/follow";
import { SAMPLE_FACTS, SAMPLE_LINE, SAMPLE_PHRASE, SAMPLE_STORY } from "../../_data/sample";

const [before = "", after = ""] = SAMPLE_LINE.split(SAMPLE_PHRASE);

export default function StoryFrame() {
  return (
    <div className="grid h-full grid-cols-[1fr_15rem] gap-8 p-10">
      <div className="flex flex-col gap-6">
        <StoryCard story={SAMPLE_STORY} variant="expanded" layout={false} />
        <p
          data-sentence-slot=""
          className="border-l-2 border-voice pl-4 font-reading text-lg text-text"
        >
          “{before}
          <span className="rounded-control bg-voice-glow text-voice [text-shadow:0_0_24px_var(--voice-glow)]">
            {SAMPLE_PHRASE}
          </span>
          {after}”
        </p>
      </div>
      <div>
        <p className="text-sm text-text-soft">{STORY_FRAME.factsHeading}</p>
        <ul className="mt-3 flex flex-col divide-y divide-edge border-y border-edge">
          {SAMPLE_FACTS.map((fact) => (
            <li key={fact} className="flex flex-col gap-1 py-3">
              <span className="text-base text-text">{fact}</span>
              <StatusLabel tone="verified">{STORY_FRAME.confirmed}</StatusLabel>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
