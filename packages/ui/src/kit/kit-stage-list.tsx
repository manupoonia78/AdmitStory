"use client";

import { CheckCircleIcon, CircleHalfIcon, CircleIcon, type Icon } from "@phosphor-icons/react";
import { cx } from "../lib/cx";
import type { KitStage, KitStageStatus } from "./types";

const STATUS: Record<KitStageStatus, { icon: Icon; word: string; className: string }> = {
  done: { icon: CheckCircleIcon, word: "Done", className: "text-verified" },
  active: { icon: CircleHalfIcon, word: "In progress", className: "text-text" },
  waiting: { icon: CircleIcon, word: "Waiting", className: "text-text-soft" },
};

export interface KitStageListProps {
  stages: readonly KitStage[];
  /** A done stage's action ("Read it now") was pressed. */
  onAction?: (stageId: string) => void;
  className?: string;
}

/**
 * The kit's stages as text (spec §6.10 screen F): ✓ done, ◐ in progress, ○ waiting, each with
 * an icon and a word so status is never colour alone. Done stages offer their output straight
 * away ("Read it now"), so reading can start while essays still draft (spec §5.7).
 */
export function KitStageList({ stages, onAction, className }: KitStageListProps) {
  return (
    <ol className={cx("flex flex-col border-t border-edge", className)}>
      {stages.map((stage) => {
        const { icon: StatusIcon, word, className: tone } = STATUS[stage.status];
        return (
          <li
            key={stage.id}
            data-status={stage.status}
            className="grid min-h-14 grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-b border-edge py-3 sm:grid-cols-[1.25rem_minmax(8rem,10rem)_minmax(0,1fr)]"
          >
            <StatusIcon size={20} aria-hidden className={cx("self-center", tone)} />
            <span
              className={cx(
                "font-medium",
                stage.status === "waiting" ? "text-text-soft" : "text-text",
              )}
            >
              <span className="sr-only">{word}:</span> {stage.label}
            </span>
            <span className="col-start-2 min-w-0 text-text-soft sm:col-start-3">
              {stage.status === "done" && stage.actionLabel && onAction ? (
                <button
                  type="button"
                  onClick={() => onAction(stage.id)}
                  className="relative rounded-control text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2 before:absolute before:-inset-x-1 before:top-1/2 before:h-11 before:-translate-y-1/2"
                  aria-label={`${stage.actionLabel}: ${stage.label}`}
                >
                  {stage.actionLabel}
                </button>
              ) : (
                stage.detail
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
