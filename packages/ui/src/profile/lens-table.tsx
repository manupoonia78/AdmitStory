// The four lenses as a small table on hairlines (SPEC §6.12): the lens, its level in words, a thin
// track with a run to the level (none, a third, two thirds, full), and the stories behind it as
// buttons that open the evidence drawer. It replaces the dial on the Profile Read; the dial
// (LensInstrument) stays in the package. Server-safe; the run draws in with CSS
// (`.lens-run`, profile-read.css in the app).

import type { CSSProperties } from "react";
import { cx } from "../lib/cx";
import { LENS_LEVEL_WORDS, layoutLensDial, lensFraction, lensSummary } from "./lens-geometry";
import type { LensReading } from "./types";

export interface LensTableProps {
  readings: readonly LensReading[];
  onOpenStory?: (storyId: string) => void;
  className?: string;
}

export function LensTable({ readings, onOpenStory, className }: LensTableProps) {
  return (
    <ul className={cx("flex flex-col border-t border-edge", className)}>
      {layoutLensDial(readings).map((arc, index) => (
        <li
          key={arc.lens}
          data-lens={arc.lens}
          aria-label={lensSummary(arc)}
          className="grid gap-x-6 gap-y-2 border-b border-edge py-4 sm:grid-cols-[9.5rem_10rem_minmax(0,1fr)] sm:items-baseline"
        >
          <span className="flex items-baseline justify-between gap-3 sm:block">
            <span className="font-ui text-ui text-text">{arc.label}</span>
            <span className="label sm:hidden">{LENS_LEVEL_WORDS[arc.level]}</span>
          </span>
          <span className="flex flex-col gap-2 sm:pt-1">
            <span className="label hidden sm:block">{LENS_LEVEL_WORDS[arc.level]}</span>
            <span aria-hidden className="relative block h-[1.25px] w-full bg-edge-strong">
              <span
                className="lens-run absolute inset-y-0 left-0 origin-left bg-text"
                style={
                  {
                    width: `${lensFraction(arc.level) * 100}%`,
                    "--d": `${index * 70}ms`,
                  } as CSSProperties
                }
              />
            </span>
          </span>
          <span className="font-ui text-sm text-text-soft">
            {arc.stories.length === 0 ? (
              "No stories yet"
            ) : (
              <span className="flex flex-wrap gap-x-1">
                {arc.stories.map((story, i) => (
                  <span key={story.id}>
                    {onOpenStory ? (
                      <button
                        type="button"
                        onClick={() => onOpenStory(story.id)}
                        className="relative underline decoration-text-faint decoration-dotted underline-offset-[0.25em] before:absolute before:-inset-x-1 before:top-1/2 before:h-6 before:-translate-y-1/2 hover:text-text"
                      >
                        {story.title}
                      </button>
                    ) : (
                      story.title
                    )}
                    {i < arc.stories.length - 1 ? "," : ""}
                  </span>
                ))}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
