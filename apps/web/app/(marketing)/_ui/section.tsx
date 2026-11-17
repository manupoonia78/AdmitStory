// The marketing section (plan §3.3): the 12-column grid (4 on phones, 8 on tablets), 16 px phone
// gutters, a 1440 px maximum and the vertical rhythm. Server-safe.
//
// The marketing site is dark only (SPEC §4): a section is transparent over the page's one dark
// field. theme "paper" turns a section into a Day island for a scene about reading.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

export interface SectionProps {
  id?: string;
  /** The id of the section's heading (every section is labelled by its heading). */
  labelledBy: string;
  theme?: "night" | "page" | "paper";
  /** Vertical rhythm: "default" for scenes, "none" for those that set their own. */
  spacing?: "default" | "compact" | "none";
  className?: string;
  /** Class for the inner grid. */
  gridClassName?: string;
  children: ReactNode;
}

/** Scene padding (SPEC §2.5): 80, 112, 160 px. */
const SPACING = {
  default: "py-20 sm:py-28 lg:py-40",
  compact: "py-16 sm:py-20 lg:py-24",
  none: "",
} as const;

/** The grid every section's content sits on. Use it inside full-bleed stages too. */
export const SECTION_GRID =
  "mx-auto grid w-full max-w-[1440px] grid-cols-4 gap-x-4 px-4 sm:grid-cols-8 sm:gap-x-6 sm:px-8 lg:grid-cols-12 lg:px-12";

export function Section({
  id,
  labelledBy,
  theme = "page",
  spacing = "default",
  className,
  gridClassName,
  children,
}: SectionProps) {
  const paper = theme === "paper";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-theme={paper ? "day" : undefined}
      className={cx("relative", paper && "bg-space text-text", SPACING[spacing], className)}
    >
      <div className={cx(SECTION_GRID, gridClassName)}>{children}</div>
    </section>
  );
}
