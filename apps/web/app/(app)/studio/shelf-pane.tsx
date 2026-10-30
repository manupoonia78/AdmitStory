"use client";

import {
  CoverageMeter,
  StoryCaptureProvider,
  StoryShelf,
  useStoryCapture,
  type StoryCardData,
} from "@admitstory/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COVERAGE_UI_ID, toCard, type CoverageBarDto, type ShelfStory } from "./types";

// The shelf, the coverage meter and the facts counter (spec §5.2), with the live channel that feeds
// them. This whole pane is code-split: it holds the story-capture flight, which is the one piece of
// the Studio that needs Motion, and nothing can be captured until the first answer is in. The
// question and the composer are what the first paint is for (spec §6.11's JS budget).

export interface ShelfPaneProps {
  sessionId: string | null;
  initialStories: StoryCardData[];
  initialCoverage: CoverageBarDto[];
  initialFactCount: number;
}

export function ShelfPane(props: ShelfPaneProps) {
  return (
    <StoryCaptureProvider initialStories={props.initialStories}>
      <Shelf {...props} />
    </StoryCaptureProvider>
  );
}

function Shelf({ sessionId, initialCoverage, initialFactCount }: ShelfPaneProps) {
  const { capture, count } = useStoryCapture();
  const [coverage, setCoverage] = useState(initialCoverage);
  const [factCount, setFactCount] = useState(initialFactCount);

  // The live channel (spec §5.2): a story card flies in as the Extractor finds it, and the counters
  // follow. Nothing here sets state synchronously: every update comes from an event.
  useEffect(() => {
    if (!sessionId) return;
    const source = new EventSource(`/api/studio/sessions/${sessionId}/events`);

    source.addEventListener("story", (event) => {
      const story = JSON.parse((event as MessageEvent<string>).data) as ShelfStory;
      capture(toCard(story));
    });
    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as {
        coverage: CoverageBarDto[];
        factCount: number;
      };
      setCoverage(data.coverage);
      setFactCount(data.factCount);
    });

    return () => source.close();
  }, [sessionId, capture]);

  return (
    <>
      <StoryShelf
        heading="Your shelf"
        emptyText="No stories yet. Talk for five minutes and they'll start appearing here."
      />
      <CoverageMeter
        lenses={coverage.map((bar) => ({
          id: COVERAGE_UI_ID[bar.id],
          level: bar.level,
          ...(bar.note ? { note: bar.note } : {}),
        }))}
      />
      <p className="text-sm text-text-soft">
        <Link href="/dossier?tab=facts" className="underline underline-offset-2 hover:text-text">
          {factCount} {factCount === 1 ? "fact" : "facts"} captured
        </Link>
        {count > 0 ? ` · ${count} ${count === 1 ? "story" : "stories"}` : ""}
      </p>
    </>
  );
}
