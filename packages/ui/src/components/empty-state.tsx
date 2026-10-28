import type { ReactNode } from "react";
import { cx } from "../lib/cx";

/**
 * "start" (the default) left-aligns the empty state like all other text. "center" is only for a
 * description that fits on one line: spec §6.4 allows no centred paragraphs except single-line
 * empty states.
 */
export type EmptyStateAlign = "start" | "center";

export interface EmptyStateProps {
  /** Short headline, e.g. "No stories yet". */
  title: string;
  /** What to do next (spec §6.7). Keep it to one line if you centre it. */
  description: string;
  /** A single action, usually a <Button>. */
  action?: ReactNode;
  /** Defaults to "start". Use "center" only when the description is a single line. */
  align?: EmptyStateAlign;
  headingLevel?: 2 | 3;
  className?: string;
}

const ALIGN: Record<EmptyStateAlign, string> = {
  start: "items-start text-left",
  center: "items-center text-center",
};

export function EmptyState({
  title,
  description,
  action,
  align = "start",
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      data-align={align}
      className={cx("flex flex-col gap-2 px-4 py-12", ALIGN[align], className)}
    >
      <Heading className="text-lg font-bold text-graphite">{title}</Heading>
      <p className="text-slate">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
