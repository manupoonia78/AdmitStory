"use client";

// Chapter 3, the essay (direction §4.3): a Day paper sheet with the essay's first two sentences,
// the first one lit as the applicant's own words, where it was said, and the one question the
// draft needs answered (a NeedChip: never a guess).

import { NeedChip, YourWordsText } from "@admitstory/ui";
import { ESSAY_FRAME } from "../../_copy/follow";
import {
  SAMPLE_NEED,
  SAMPLE_PARAGRAPHS,
  SAMPLE_PROVENANCE,
  SAMPLE_SOURCES,
} from "../../_data/sample";

const FIRST = SAMPLE_PARAGRAPHS[0];
const OPENING = FIRST ? [{ ...FIRST, sentences: FIRST.sentences.slice(0, 2) }] : [];

export default function EssayFrame() {
  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div data-theme="day" className="flex-1 rounded-sheet border border-edge bg-depth px-10 py-8">
        <p className="text-sm text-text-soft">{ESSAY_FRAME.header}</p>
        <div data-sentence-slot="" className="mt-5">
          <YourWordsText
            paragraphs={OPENING}
            sources={SAMPLE_SOURCES}
            on
            className="font-reading text-read text-text"
          />
        </div>
        <div aria-hidden="true" className="mt-5 flex flex-col gap-4">
          <span className="block h-px w-full bg-edge" />
          <span className="block h-px w-11/12 bg-edge" />
        </div>
      </div>
      <div className="flex items-start gap-4">
        <p className="plane flex-1 px-4 py-3 text-sm text-text-soft">{SAMPLE_PROVENANCE}</p>
        <NeedChip
          question={SAMPLE_NEED.question}
          approxWords={SAMPLE_NEED.approx_words}
          className="max-w-[16rem] text-sm"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
