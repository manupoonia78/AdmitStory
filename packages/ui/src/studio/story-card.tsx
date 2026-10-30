"use client";

// A story on the shelf (spec §5.2, §6.8): an applicant-flavoured nickname, era and context, up to
// three trait tags, and a status in words. Compact on the shelf, expanded when opened. It is a
// Motion layout element, so a shared layoutId lets the same card travel between places (shelf to
// Dossier) instead of one card vanishing and another appearing.

import { motion } from "motion/react";
import { cx } from "../lib/cx";
import { StatusLabel, type StatusTone } from "../components/status-label";
import { useMotionToken } from "../motion";

export interface StoryCardData {
  id: string;
  /** Short and in the applicant's own flavour: "The night-shift fix". */
  nickname: string;
  /** When it happened: "2024", "2019–2021". */
  era: string;
  /** Where it happened: "Work", "Beyond work". */
  context: string;
  /** Trait tags from the taxonomy (Appendix D); the card shows the first three. */
  traits: readonly string[];
  status: { tone: StatusTone; label: string };
  /** One line, shown when expanded. */
  summary?: string;
}

export const MAX_CARD_TRAITS = 3;

export interface StoryCardProps {
  story: StoryCardData;
  variant?: "compact" | "expanded";
  /** Shared-element id for Motion flights between two places that show the same story. */
  layoutId?: string;
  /** Animate size and position changes on re-render (off for copies that are moved by hand). */
  layout?: boolean;
  /** Makes the nickname a disclosure button that opens or closes the card. */
  onToggle?: () => void;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

export function StoryCard({
  story,
  variant = "compact",
  layoutId,
  layout = true,
  onToggle,
  headingLevel = 3,
  className,
}: StoryCardProps) {
  const transition = useMotionToken("glide");
  const expanded = variant === "expanded";
  const Heading = `h${headingLevel}` as const;
  const traits = story.traits.slice(0, MAX_CARD_TRAITS);

  return (
    <motion.article
      layout={layout}
      layoutId={layoutId}
      transition={transition}
      data-variant={variant}
      className={cx(
        "relative flex flex-col border border-edge bg-depth text-left shadow-plane",
        expanded ? "gap-3 rounded-plane p-5" : "gap-1.5 rounded-control px-4 py-3",
        onToggle && "hover:border-control",
        className,
      )}
    >
      <Heading
        className={cx(
          "text-text",
          expanded ? "font-reading text-read-lg" : "text-base font-medium",
        )}
      >
        {onToggle ? (
          // The pseudo-element stretches the button over the whole card: one large target.
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-left after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-signal"
          >
            {story.nickname}
          </button>
        ) : (
          story.nickname
        )}
      </Heading>

      <p className="flex flex-wrap gap-x-3 text-sm text-text-soft">
        <span>{story.context}</span>
        <span className="tabular-nums">{story.era}</span>
      </p>

      {expanded && story.summary ? <p className="text-base text-text">{story.summary}</p> : null}

      {traits.length > 0 ? (
        <ul aria-label="Traits" className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-soft">
          {traits.map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
      ) : null}

      <StatusLabel tone={story.status.tone}>{story.status.label}</StatusLabel>
    </motion.article>
  );
}
