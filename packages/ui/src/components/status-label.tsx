import type { Icon } from "@phosphor-icons/react";
import { CheckCircleIcon, CircleIcon, QuestionIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type StatusTone = "verified" | "needs" | "risk" | "neutral";

// Every status carries an icon and text; colour is never the only signal (spec §6.2).
// Status colours sit on --paper or --mist only, never on --ink-soft.
const TONES: Record<StatusTone, { icon: Icon; className: string }> = {
  verified: { icon: CheckCircleIcon, className: "text-verified" },
  needs: { icon: QuestionIcon, className: "text-needs" },
  risk: { icon: WarningIcon, className: "text-risk" },
  neutral: { icon: CircleIcon, className: "text-slate" },
};

export interface StatusLabelProps {
  tone: StatusTone;
  /** The status in words, e.g. "Confirmed", "Needs you", "Must fix". */
  children: ReactNode;
  className?: string;
}

export function StatusLabel({ tone, children, className }: StatusLabelProps) {
  const { icon: ToneIcon, className: toneClass } = TONES[tone];
  return (
    <span
      className={cx("inline-flex items-center gap-1 text-sm font-medium", toneClass, className)}
    >
      <ToneIcon size={16} aria-hidden className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
