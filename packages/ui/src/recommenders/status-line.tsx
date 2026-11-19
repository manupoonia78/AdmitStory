// A recommender's status as the Voiceline (SPEC §6.13): a flat rule with a tick for each of the
// five stops, a run in --text from the first to where they are, and the peak standing on the
// current stop. Under it, the status in words with its date ("Opened 13 Oct"). Server-safe. The
// draw-in is CSS (`.rec-line`, recommenders.css in the app), once, under data-motion="on".

import { RECOMMENDER_STATUSES, type RecommenderStatus } from "@admitstory/shared/kit";
import type { CSSProperties } from "react";
import { Peak } from "../components/peak";
import { cx } from "../lib/cx";

export interface StatusLineProps {
  status: RecommenderStatus;
  /** "Invited 12 Oct", "Opened 13 Oct"… */
  line: string;
  /** Order in a list, for the staggered draw (0, 1, 2…). */
  index?: number;
  className?: string;
}

/** The current stop as a share of the line, 0 to 1. */
export function statusShare(status: RecommenderStatus): number {
  const at = RECOMMENDER_STATUSES.indexOf(status);
  return at <= 0 ? 0 : at / (RECOMMENDER_STATUSES.length - 1);
}

/** Shrinking gaps between rows: 0, 70, 120, 160, 190, 210 ms, the rest with the sixth. */
const STARTS = [0, 70, 120, 160, 190, 210] as const;

export function StatusLine({ status, line, index = 0, className }: StatusLineProps) {
  const share = statusShare(status);
  const at = RECOMMENDER_STATUSES.indexOf(status);
  const style = {
    "--share": share,
    "--d": `${STARTS[Math.min(index, STARTS.length - 1)]}ms`,
  } as CSSProperties;
  return (
    <span className={cx("rec-line flex min-w-0 flex-col gap-2.5", className)} style={style}>
      <span aria-hidden className="relative mx-1.5 block h-[18px]">
        <span className="absolute inset-x-0 bottom-0 h-[1.25px] bg-edge-strong" />
        <span
          className="rec-line-run absolute bottom-0 left-0 h-[1.25px] origin-left bg-text"
          style={{ width: `${share * 100}%` }}
        />
        {RECOMMENDER_STATUSES.map((stop, i) => (
          <span
            key={stop}
            className={cx(
              "absolute bottom-[-2px] h-[5px] w-px -translate-x-1/2",
              i <= at ? "bg-text" : "bg-text-faint",
            )}
            style={{ left: `${(i / (RECOMMENDER_STATUSES.length - 1)) * 100}%` }}
          />
        ))}
        <span
          className="rec-line-peak absolute bottom-0 -translate-x-1/2 text-text"
          style={{ left: `${share * 100}%` }}
        >
          <Peak className="block h-[17px] w-3" strokeWidth={1.25} />
        </span>
      </span>
      <span className="font-mono text-[11px] leading-4 tracking-[0.06em] text-text-80 uppercase">
        {line}
      </span>
    </span>
  );
}
