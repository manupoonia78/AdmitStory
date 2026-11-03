// A display heading (plan §3.3). Author-set line breaks: one text node per line with <br>
// between, so a screen reader hears one sentence. `phoneBreaks` are extra breaks that apply on
// phones only (direction §4.2: "Say one / thing about / yourself.").
//
// Sizes map to the §6.4 display scale: sm 32–40, md 40–64, lg 48–96, xl 64–144 px. Server-safe.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

export type DisplaySize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<DisplaySize, string> = {
  sm: "text-display-sm",
  md: "text-display",
  lg: "text-display-lg",
  xl: "text-display-xl",
};

export interface DisplayHeadingProps {
  level: 1 | 2 | 3;
  size: DisplaySize;
  id?: string;
  /** Author-set lines, joined with <br> (and a space for anything that reads the text). */
  lines: readonly string[];
  /**
   * Phone-only breaks, as the phone's own lines. Each must be a run of the same words: the
   * heading renders these lines on phones and `lines` from 640 px.
   */
  phoneLines?: readonly string[];
  className?: string;
}

function withBreaks(lines: readonly string[], breakClass?: string): ReactNode[] {
  return lines.flatMap((line, index) =>
    index === 0
      ? [line]
      : [
          // The space keeps words apart in textContent; the <br> sets the visual line.
          " ",
          <br key={`br-${index}`} className={breakClass} aria-hidden="true" />,
          line,
        ],
  );
}

export function DisplayHeading({
  level,
  size,
  id,
  lines,
  phoneLines,
  className,
}: DisplayHeadingProps) {
  const Tag = `h${level}` as const;
  const classes = cx(
    SIZE[size],
    "font-ui text-text [text-wrap:balance] [font-kerning:normal]",
    className,
  );
  if (!phoneLines) {
    return (
      <Tag id={id} className={classes}>
        {withBreaks(lines)}
      </Tag>
    );
  }
  // Two renderings of the same sentence; only one is ever displayed, and the hidden one is
  // display:none (so it is out of the accessibility tree too).
  return (
    <Tag id={id} className={classes}>
      <span className="sm:hidden">{withBreaks(phoneLines)}</span>
      <span className="hidden sm:inline">{withBreaks(lines)}</span>
    </Tag>
  );
}
