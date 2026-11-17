import { SkipLink, Wordmark, cx } from "@admitstory/ui";
import type { CSSProperties, ReactNode } from "react";
import "./entry.css";

/**
 * The entry room (SPEC §5): sign-in, welcome, first-run, goodbye and the not-found page. Walking
 * in should feel like a quiet room: the instrument's dark (always Night, whatever the theme
 * cookie says, because the room is part of the casing), the wordmark, one thing to do, and the
 * horizon across the foot. No client code, and nothing from Radix or `Button`: the root
 * not-found page renders it, so it must not add to every route's first load.
 *
 * `width`: "narrow" is a 400px column (sign-in, goodbye, not-found); "wide" is the room's width
 * (welcome, first-run). `aside` sits to the right of a narrow column from 1024px (sign-in's sheet).
 * `gap` breaks the horizon under the column: the line with a gap, for goodbye and not-found.
 */
export function AuthShell({
  children,
  width = "narrow",
  aside,
  gap = false,
  footnote = "Free to start · no card needed",
}: {
  children: ReactNode;
  width?: "narrow" | "wide";
  aside?: ReactNode;
  gap?: boolean;
  footnote?: string | null;
}) {
  return (
    <div data-theme="night" className={cx("room", gap && "room-gap")}>
      <SkipLink targetId="main" />
      <header className="room-top enter" style={{ "--i": 0 } as CSSProperties}>
        {/* A plain anchor: next/link would add its client chunk to /sign-in's first load. */}
        <a href="/" className="room-home" aria-label="AdmitStories home">
          <Wordmark size={24} />
        </a>
      </header>
      <main id="main" tabIndex={-1} className="room-main">
        <div className={cx("room-col", width === "wide" && "room-col-wide")}>{children}</div>
        {aside ? (
          <div
            aria-hidden="true"
            className="room-aside enter"
            style={{ "--i": 4 } as CSSProperties}
          >
            {aside}
          </div>
        ) : null}
      </main>
      <div className="room-horizon" aria-hidden="true">
        <span className="room-line" />
        <span className="room-line-brass" />
        <svg className="room-peak" viewBox="0 0 30 44" fill="none">
          <path d="M0 43 L15 1 L30 43" pathLength="1" />
        </svg>
      </div>
      {footnote ? <p className="room-foot label">{footnote}</p> : null}
    </div>
  );
}
