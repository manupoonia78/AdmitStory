// The lens instrument as a plain list (spec §6.12: an accessible list equivalent for the Lens
// instrument). Same data and the same words as the dial, for a list view, a print view and anyone
// who would rather read than point. Server-safe.

import { cx } from "../lib/cx";
import { layoutLensDial, lensSummary } from "./lens-geometry";
import type { LensReading } from "./types";

export interface LensListProps {
  readings: readonly LensReading[];
  headingLevel?: 3 | 4;
  className?: string;
}

export function LensList({ readings, headingLevel = 3, className }: LensListProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <ul className={cx("flex flex-col gap-4", className)}>
      {layoutLensDial(readings).map((arc) => (
        <li key={arc.lens} data-lens={arc.lens} className="flex flex-col gap-1">
          <Heading className="text-base font-medium text-text">{lensSummary(arc)}</Heading>
          {arc.stories.length > 0 ? (
            <ul className="flex flex-col text-text-soft">
              {arc.stories.map((story) => (
                <li key={story.id}>
                  {story.title}
                  {story.context ? <span className="text-sm">, {story.context}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
