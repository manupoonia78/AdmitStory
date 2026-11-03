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

/** A small rendered glass orb above an empty state: something lit is waiting here. */
function Orb() {
  return (
    <span aria-hidden className="relative mb-4 inline-block size-14">
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,rgb(255_255_255/0.9)_0_7%,transparent_22%),radial-gradient(circle_at_65%_75%,color-mix(in_srgb,var(--voice)_70%,transparent),transparent_60%),radial-gradient(circle_at_45%_40%,color-mix(in_srgb,var(--signal)_75%,white),color-mix(in_srgb,var(--signal)_35%,black)_85%)] shadow-[inset_0_-6px_12px_rgb(0_0_0/0.35),inset_0_2px_2px_rgb(255_255_255/0.5),0_0_36px_-4px_color-mix(in_srgb,var(--signal)_70%,transparent)] motion-safe:animate-[orb-float_6s_ease-in-out_infinite]" />
      <span className="absolute -inset-x-3 top-1/2 h-4 -translate-y-1/2 -rotate-12 rounded-[50%] border border-[color-mix(in_srgb,var(--text)_45%,transparent)]" />
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
      className={cx("flex flex-col gap-2 px-4 py-12", ALIGN[align], className)}
    >
      <Orb />
      <Heading className="text-lg font-semibold text-text">{title}</Heading>
      <p className="text-text-soft">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
