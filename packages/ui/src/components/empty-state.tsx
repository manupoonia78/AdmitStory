import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { Peak } from "./peak";

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

/**
 * The Voiceline lying flat with one small rise at its end (SPEC §6.10): "here is where it
 * starts". It replaces the old blank-sheet drawing; no illustration, the line does the job.
 */
function StartLine({ align }: { align: EmptyStateAlign }) {
  return (
    <span
      aria-hidden
      className={cx(
        "mb-6 flex w-60 max-w-full items-end text-text-faint",
        align === "center" ? "self-center" : "self-start",
      )}
    >
      <span className="mb-px h-[1.25px] flex-1 bg-edge-strong" />
      <Peak className="h-[17px] w-3" strokeWidth={1.25} />
      <span className="mb-px h-[1.25px] w-4 bg-edge-strong" />
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
    <div data-align={align} className={cx("flex flex-col py-2", ALIGN[align], className)}>
      <StartLine align={align} />
      <Heading className="text-title text-text">{title}</Heading>
      <p className="mt-2 max-w-[52ch] text-base text-text-soft">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
