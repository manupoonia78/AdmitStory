import { WarningIcon } from "@phosphor-icons/react/ssr";
import { cx } from "../lib/cx";

export type LimitUnit = "words" | "characters";

export interface LimitCounterProps {
  count: number;
  limit: number;
  unit?: LimitUnit;
  className?: string;
}

/** How far over the limit a count is; 0 when it fits. */
export function overLimit(count: number, limit: number): number {
  return Math.max(0, count - limit);
}

/**
 * The live count beside a prompt, "187 / 200 words" (spec §5.8, screen G). Over the limit it
 * says by how much, with an icon, in --risk (spec §6.9 "14 words over"). Tabular figures keep the
 * width steady while the count changes. The count is not announced on every word; the over-limit
 * message is.
 */
export function LimitCounter({ count, limit, unit = "words", className }: LimitCounterProps) {
  const over = overLimit(count, limit);
  return (
    <div className={cx("flex flex-col items-end gap-0.5 text-sm tabular-nums", className)}>
      <p className={over ? "font-medium text-risk" : "text-text-soft"}>
        <span className={over ? undefined : "text-text"}>{count}</span> / {limit} {unit}
      </p>
      <p aria-live="polite" className="min-h-[1lh]">
        {over ? (
          <span className="inline-flex items-center gap-1 font-medium text-risk">
            <WarningIcon size={16} aria-hidden className="shrink-0" />
            {over} {over === 1 ? unit.replace(/s$/, "") : unit} over
          </span>
        ) : null}
      </p>
    </div>
  );
}
