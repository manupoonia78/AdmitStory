"use client";

// A voice notice in the Studio (spec §5.2 states, §6.9 copy): the microphone permission request,
// a blocked or missing microphone, a lost transcription connection, voice minutes running out.
// One line of plain text with an icon (status colour never stands alone, spec §6.3) and up to two
// actions under it, e.g. "Allow microphone" / "Write instead".
//
// The message sits in a polite live region that stays mounted while empty, so a notice that
// appears is announced (WCAG 4.1.3). The actions sit outside it: a screen reader hears the
// message, not the button labels, each time it changes.

import { InfoIcon, WarningCircleIcon, WarningIcon, type Icon } from "@phosphor-icons/react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";

export type VoiceNoticeTone = "info" | "warning" | "problem";

export interface VoiceNoticeAction {
  label: string;
  onClick: () => void;
  /** The one action most people want; at most one per notice. */
  primary?: boolean;
}

export interface VoiceNoticeProps {
  notice: { tone: VoiceNoticeTone; message: string } | null;
  actions?: readonly VoiceNoticeAction[];
  className?: string;
}

const ICONS: Record<VoiceNoticeTone, { icon: Icon; className: string }> = {
  info: { icon: InfoIcon, className: "text-signal" },
  warning: { icon: WarningIcon, className: "text-needs" },
  problem: { icon: WarningCircleIcon, className: "text-risk" },
};

export function VoiceNotice({ notice, actions = [], className }: VoiceNoticeProps) {
  const tone = notice ? ICONS[notice.tone] : null;
  const ToneIcon = tone?.icon;
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div role="status" aria-live="polite" aria-atomic="true">
        {notice && ToneIcon ? (
          <p data-tone={notice.tone} className="flex items-start gap-2 text-sm text-text">
            <ToneIcon size={20} aria-hidden className={cx("shrink-0", tone.className)} />
            <span>{notice.message}</span>
          </p>
        ) : null}
      </div>
      {notice && actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.primary ? "primary" : "secondary"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
