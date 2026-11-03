"use client";

// "When you've submitted" (Phase 6 plan §8.6): one checkbox per school. This is the one thing the
// recommender tells the applicant, besides having opened the page and started: no notes, no words
// (§14.3). Ticking it also stops the applicant's check-in reminders.

import type { PortalView } from "@admitstory/shared/kit";
import { cx } from "../lib/cx";
import { PORTAL_COPY, portalDay, submittedLabel } from "./portal-text";

export type PortalSchool = PortalView["groups"][number]["schools"][number];

export interface PortalSubmittedProps {
  schools: readonly PortalSchool[];
  busy?: boolean;
  onChange: (schoolCycleId: string, submitted: boolean) => void;
  className?: string;
}

export function PortalSubmitted({
  schools,
  busy = false,
  onChange,
  className,
}: PortalSubmittedProps) {
  if (schools.length === 0) return null;
  return (
    <section id="submitted" className={cx("flex flex-col gap-3", className)}>
      <h2 className="text-display-sm text-text">{PORTAL_COPY.submittedHeading}</h2>
      <ul className="flex flex-col gap-2">
        {schools.map((school) => {
          const day = portalDay(school.submittedAt);
          return (
            <li key={school.schoolCycleId}>
              <label className="flex min-h-11 items-center gap-3 text-base text-text">
                <input
                  type="checkbox"
                  checked={Boolean(school.submittedAt)}
                  disabled={busy}
                  onChange={(event) => onChange(school.schoolCycleId, event.target.checked)}
                  className="size-5 shrink-0 accent-[var(--signal)]"
                />
                <span>{submittedLabel(school.name)}</span>
                {day ? (
                  <span className="text-sm tabular-nums text-text-soft">Marked {day}</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
