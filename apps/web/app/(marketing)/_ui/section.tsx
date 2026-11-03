// The marketing section (plan §3.3): the 12-column grid (4 on phones, 8 on tablets), 16 px phone
// gutters, a 1440 px maximum and the vertical rhythm. Server-safe.
//
// theme "night" pins the section to Night (with grain) in either site theme, as the hero, the
// pinned sequence, "What it won't do" and the final call are. "page" follows the visitor's theme.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

export interface SectionProps {
  id?: string;
  /** The id of the section's heading (every section is labelled by its heading). */
  labelledBy: string;
  theme?: "night" | "page";
  /** Film grain (Night only; it is a no-op in Day). Defaults to on for Night sections. */
  grain?: boolean;
  /** Vertical rhythm: "default" for ordinary sections, "none" for stages that set their own. */
  spacing?: "default" | "compact" | "none";
  className?: string;
  /** Class for the inner grid. */
  gridClassName?: string;
  children: ReactNode;
}

const SPACING = {
  default: "py-24 sm:py-32 lg:py-40",
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
  grain,
  spacing = "default",
  className,
  gridClassName,
  children,
}: SectionProps) {
  const night = theme === "night";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-theme={night ? "night" : undefined}
      className={cx(
        "relative",
        night && "bg-space text-text",
        night && (grain ?? true) && "grain",
        SPACING[spacing],
        className,
      )}
    >
      <div className={cx(SECTION_GRID, gridClassName)}>{children}</div>
    </section>
  );
}
