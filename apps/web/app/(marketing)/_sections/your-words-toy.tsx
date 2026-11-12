"use client";

// The toy itself (direction §4.6). Loaded by ./your-words-island when the section is near. Its
// essay is a second sample applicant (../_data/sample-words.ts), not the one the page follows.
//
// Exactly the Workspace behaviour: the glow comes on along glide, and pointing at, focusing or
// tapping a lit sentence shows the moment it was said. Y toggles it only while focus is inside this
// section (no global key capture on marketing pages), so the switch's own shortcut is off.

import { YourWordsText, YourWordsToggle, isPlainKey } from "@admitstory/ui";
import { useState, type KeyboardEvent } from "react";
import { WORDS_PARAGRAPHS, WORDS_SOURCES } from "../_data/sample-words";
import { FictionalNote } from "../_ui/notes";

export interface YourWordsToyProps {
  paragraph: string;
  phoneParagraph: string;
  sheetLabel: string;
  sheetHeader: string;
}

export default function YourWordsToy({
  paragraph,
  phoneParagraph,
  sheetLabel,
  sheetHeader,
}: YourWordsToyProps) {
  const [on, setOn] = useState(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isPlainKey(event.nativeEvent, "y")) return;
    event.preventDefault();
    setOn((value) => !value);
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="grid grid-cols-4 gap-x-4 gap-y-8 sm:grid-cols-8 sm:gap-x-6 lg:grid-cols-12"
    >
      <div className="col-span-4 sm:col-span-6 lg:col-span-4">
        <p className="font-reading text-read text-text-soft">
          <span className="hidden pointer-fine:inline">{paragraph}</span>
          <span className="pointer-fine:hidden">{phoneParagraph}</span>
        </p>
        <div className="mt-6 flex items-center gap-2">
          <YourWordsToggle
            on={on}
            onChange={setOn}
            shortcut={false}
            className="w-full justify-start sm:w-auto"
          />
          {/* The key works while focus is in this section (the paragraph says so). */}
          <kbd
            aria-hidden="true"
            className="hidden rounded-control border border-edge px-1.5 font-ui text-sm text-text-soft pointer-fine:inline"
          >
            Y
          </kbd>
        </div>
      </div>
      <figure aria-label={sheetLabel} className="col-span-4 sm:col-span-8 lg:col-span-8">
        <div
          data-theme="day"
          className="rounded-sheet border border-edge bg-depth px-6 py-8 text-text sm:px-12 sm:py-12"
        >
          <p className="mb-6 text-sm text-text-soft">{sheetHeader}</p>
          <YourWordsText
            paragraphs={WORDS_PARAGRAPHS}
            sources={WORDS_SOURCES}
            on={on}
            className="max-w-(--measure-essay) font-reading text-read text-text"
          />
        </div>
        <figcaption>
          <FictionalNote className="mt-4" />
        </figcaption>
      </figure>
    </div>
  );
}
