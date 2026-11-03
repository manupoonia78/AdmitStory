import type { ReactNode } from "react";
import { cx } from "../lib/cx";

/**
 * "start" (the default) left-aligns the empty state like all other text. "center" is only for a
 * description that fits on one line: spec §6.5 allows no centred paragraphs except single-line
 * empty states.
 */
export type EmptyStateAlign = "start" | "center";

export interface EmptyStateProps {
  /** Short headline, e.g. "No stories yet". */
  title: string;
  /** What to do next (spec §6.9). Keep it to one line if you centre it. */
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

/** A blank sheet above an empty state: the page that is waiting to be written. */
function Sheet() {
  return (
    <span
      aria-hidden
      className="mb-5 flex h-14 w-11 flex-col gap-1.5 rounded-[4px] border border-edge bg-depth px-2 pt-3 shadow-paper"
    >
      <span className="h-px w-full bg-edge" />
      <span className="h-px w-full bg-edge" />
      <span className="h-px w-2/3 bg-edge" />
      <span className="mt-auto mb-2 h-px w-3 self-end bg-accent" />
    </span>
  );
}

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
      className={cx(
        "flex flex-col gap-2 rounded-plane border border-dashed border-edge px-8 py-12",
        ALIGN[align],
        className,
      )}
    >
      <Sheet />
      <Heading className="font-display text-[1.5rem] leading-tight text-text">{title}</Heading>
      <p className="max-w-[52ch] text-text-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
