"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { cx } from "../lib/cx";

export const COACH_TABS = [
  { id: "why", label: "Why this" },
  { id: "options", label: "Options" },
  { id: "refine", label: "Refine" },
  { id: "checks", label: "Checks" },
  { id: "verify", label: "Verify" },
] as const;

export type CoachTab = (typeof COACH_TABS)[number]["id"];

export interface CoachSheetProps {
  value: CoachTab;
  onValueChange: (tab: CoachTab) => void;
  /** Each tab's content: WhyThisDraft, OptionsTab, RefineTab, CheckList, VerifyList. */
  why: ReactNode;
  options: ReactNode;
  refine: ReactNode;
  checks: ReactNode;
  verify: ReactNode;
  /** Shown beside the tab name: must-fix checks and open Verify items. */
  counts?: Partial<Record<CoachTab, number>>;
  className?: string;
}

/**
 * The Coach (spec §5.8, screen G): five tabs, quiet and typographic. A plane at 400px from 1280px;
 * below that WorkspaceLayout puts it in a sheet (tablet) or a swipe view (phone). Tabs follow the
 * Radix pattern: arrow keys move between them.
 */
export function CoachSheet({
  value,
  onValueChange,
  why,
  options,
  refine,
  checks,
  verify,
  counts = {},
  className,
}: CoachSheetProps) {
  const content: Record<CoachTab, ReactNode> = { why, options, refine, checks, verify };
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as CoachTab)}
      className={cx("flex min-h-0 flex-col", className)}
    >
      <TabsList aria-label="Coach" className="px-3">
        {COACH_TABS.map((tab) => {
          const count = counts[tab.id];
          return (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {count ? <span className="ml-1 tabular-nums text-text-soft">({count})</span> : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {COACH_TABS.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="min-h-0 flex-1 overflow-y-auto p-5">
          {content[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
