// Honest flags (spec §5.5): plain sentences under the comparison, each with its status in an icon
// and a word, and the school material it rests on. No banners. Server-safe.

import { StatusLabel } from "../components/status-label";
import { cx } from "../lib/cx";
import { citationText } from "./citation";
import type { HonestFlag, HonestFlagTone } from "./types";

const TONE: Record<HonestFlagTone, { tone: "risk" | "neutral"; word: string }> = {
  risk: { tone: "risk", word: "Risk" },
  note: { tone: "neutral", word: "Worth knowing" },
};

export interface HonestFlagItemProps {
  flag: HonestFlag;
  locale?: string;
  className?: string;
}

/** One flag: status word, the sentence, then its source in the soft colour. */
export function HonestFlagItem({ flag, locale, className }: HonestFlagItemProps) {
  const { tone, word } = TONE[flag.tone];
  return (
    <li
      data-flag={flag.id}
      data-tone={flag.tone}
      className={cx(
        "grid grid-cols-1 gap-x-4 gap-y-1 border-b border-edge py-3 sm:grid-cols-[9rem_minmax(0,1fr)]",
        className,
      )}
    >
      <StatusLabel tone={tone} className="self-start">
        {word}
      </StatusLabel>
      <span className="flex flex-col gap-1">
        <span className="text-text">{flag.text}</span>
        <span className="text-sm text-text-soft">
          Source: {citationText(flag.citation, locale)}
        </span>
      </span>
    </li>
  );
}

export interface HonestFlagListProps {
  flags: readonly HonestFlag[];
  locale?: string;
  className?: string;
}

/** Risks first, then what's worth knowing. */
export function HonestFlagList({ flags, locale, className }: HonestFlagListProps) {
  if (flags.length === 0) {
    return (
      <p className={cx("text-text-soft", className)}>
        Nothing to flag for these schools from their published material.
      </p>
    );
  }
  const sorted = [...flags].sort((a, b) => Number(a.tone !== "risk") - Number(b.tone !== "risk"));
  return (
    <ul className={cx("flex flex-col border-t border-edge", className)}>
      {sorted.map((flag) => (
        <HonestFlagItem key={flag.id} flag={flag} locale={locale} />
      ))}
    </ul>
  );
}
