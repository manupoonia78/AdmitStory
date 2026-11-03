"use client";

// Chapter 1, Story Studio (direction §4.3): the question, a small Voiceprint and the live
// transcript with the sentence in it. Real components with the sample applicant; rendered on the
// server through a "never" island, so this module's JS is never requested.

import { LiveTranscript, SpokenQuestion, VoiceprintStill } from "@admitstory/ui";
import { STUDIO_FRAME } from "../../_copy/follow";
import { SAMPLE_IDENTITY, SAMPLE_LINE, SAMPLE_QUESTION_STUDIO } from "../../_data/sample";

const SEGMENTS = [{ id: "sample-line", text: SAMPLE_LINE, final: true }] as const;

export default function StudioFrame() {
  return (
    <div className="flex h-full flex-col justify-between p-10">
      <div>
        <p className="text-sm text-text-soft">{STUDIO_FRAME.chapter}</p>
        <SpokenQuestion
          as="p"
          text={SAMPLE_QUESTION_STUDIO}
          className="mt-3 text-[30px] leading-[1.15]"
        />
      </div>
      <div className="flex items-end gap-6">
        <div className="shrink-0">
          <VoiceprintStill identity={SAMPLE_IDENTITY} size={96} mood="speaking" label="" />
          <p className="mt-2 text-center text-sm text-text-soft">{STUDIO_FRAME.listening}</p>
        </div>
        <div data-sentence-slot="" className="min-w-0 flex-1 pb-6">
          <LiveTranscript segments={SEGMENTS} label="Transcript" />
        </div>
      </div>
    </div>
  );
}
