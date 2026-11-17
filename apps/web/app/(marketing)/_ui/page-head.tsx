// The head of a marketing page other than "/" (SPEC §4.2): an eyebrow, the h1 broken by hand
// with its last line in the italic accent, and a paragraph (and an action) on the heading's last
// baseline from 1024 px. It enters once on load, in shrinking steps (0, 70, 130, 180 ms; the
// choreograph skill's non-uniform stagger), and is fully visible without JavaScript. Server-safe.

import { cx } from "@admitstory/ui";
import type { CSSProperties, ReactNode } from "react";
import { SECTION_GRID } from "./section";

export interface PageHeadProps {
  id: string;
  eyebrow: ReactNode;
  /** Author-set lines; the last is set in the accent. */
  lines: readonly ReactNode[];
  paragraph?: ReactNode;
  /** An action under the paragraph. */
  action?: ReactNode;
  /** Classes for the h1, replacing the display-1 size. */
  headingClassName?: string;
  className?: string;
}

const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function PageHead({
  id,
  eyebrow,
  lines,
  paragraph,
  action,
  headingClassName,
  className,
}: PageHeadProps) {
  const last = lines.length - 1;
  return (
    <header className={cx(SECTION_GRID, "pt-14 lg:pt-24", className)}>
      <div className="col-span-4 sm:col-span-8 lg:col-span-8">
        <p className="eyebrow enter mb-6" style={step(0)}>
          {eyebrow}
        </p>
        <h1
          id={id}
          className={cx(
            "font-display text-text [font-kerning:normal]",
            headingClassName ?? "text-display-1",
          )}
        >
          {lines.map((line, index) => (
            <span
              key={index}
              className="enter block"
              style={step(index === 0 ? 0.8 : 0.8 + index * 0.65)}
            >
              {index === last && last > 0 ? <em>{line}</em> : line}
              {index < last ? " " : null}
            </span>
          ))}
        </h1>
      </div>
      {paragraph || action ? (
        <div
          className="enter col-span-4 mt-6 sm:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-auto"
          style={step(2)}
        >
          {paragraph ? <p className="max-w-[440px] text-lg text-text-soft">{paragraph}</p> : null}
          {action ? <div className="mt-8">{action}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
