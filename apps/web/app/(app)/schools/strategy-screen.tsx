"use client";

import {
  ComparisonTable,
  HorizonPlaceholder,
  type HorizonSchool,
  type MatrixColumn,
  type MatrixGroup,
} from "@admitstory/ui";
import dynamic from "next/dynamic";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { StrategyRow } from "@/lib/strategy/types";
import { AddSchools } from "./add-schools";
import { SchoolList } from "./school-list";

// Screen E (spec §5.5, §6.10 E; school workspace redesign). From top to bottom: the headline,
// add schools, your schools as cards (a paid school opens into its tabs; the rest offer Unlock
// and a free preview), then planning: the horizon (selecting two morphs the lanes into columns
// with the comparison beneath), honest flags, the round planner, and each school's round and
// reapplicant details. The horizon carries Motion, so it loads on its own behind a placeholder of
// its exact shape.

/** How many lanes the horizon will have, so its placeholder holds the exact shape. */
const HorizonLanes = createContext(0);

function HorizonLoading() {
  return <HorizonPlaceholder count={useContext(HorizonLanes)} />;
}

/** Loads after first paint; until then its placeholder holds the exact shape. */
const HorizonTimeline = dynamic(() => import("./horizon-view").then((mod) => mod.HorizonTimeline), {
  ssr: false,
  loading: () => <HorizonLoading />,
});

export interface StrategyScreenProps {
  rows: StrategyRow[];
  horizon: HorizonSchool[];
  comparison: { columns: MatrixColumn[]; groups: MatrixGroup[] };
  /** The school cards, already rendered on the server. */
  cards: ReactNode;
  /** The honest flags and the round planner, already rendered on the server. */
  details: ReactNode;
  now: string;
  timeZone: string;
}

function headline(rows: readonly StrategyRow[]): string {
  if (rows.length === 0) return "Add your first school to see its rounds and what it asks for.";
  if (rows.some((r) => r.kit?.status === "ready"))
    return "Open a school to work on its essays, forms, briefs and résumé.";
  return "Unlock a school and we draft everything it asks for from your stories.";
}

export function StrategyScreen({
  rows,
  horizon,
  comparison,
  cards,
  details,
  now,
  timeZone,
}: StrategyScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const keep = new Set(selected);
    return {
      columns: comparison.columns.filter((c) => keep.has(c.id)),
      groups: comparison.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({
          ...row,
          cells: Object.fromEntries(Object.entries(row.cells).filter(([id]) => keep.has(id))),
        })),
      })),
    };
  }, [comparison, selected]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4 border-b border-edge pb-8">
        <p className="eyebrow">Where you will apply</p>
        <h1 className="text-display text-text">
          Your <em>schools</em>
        </h1>
        <p className="max-w-essay text-lg text-text-soft">{headline(rows)}</p>
      </header>

      {cards}

      <AddSchools inputRef={searchRef} autoFocus={rows.length === 0} />

      <div className="flex flex-col gap-2 border-t border-edge pt-10">
        <p className="eyebrow">Plan your rounds</p>
        <p className="max-w-essay text-text-soft">
          {selected.length < 2 && rows.length > 1
            ? "Pick two schools on the timeline to compare them side by side."
            : "Deadlines in your time zone, honest flags, and the round you plan for each school."}
        </p>
      </div>

      <section aria-labelledby="horizon-heading" className="flex flex-col gap-4">
        <h2
          id="horizon-heading"
          className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
        >
          Your deadlines
        </h2>
        {rows.length === 0 ? (
          <p className="placeholder">
            No schools yet. Search for one to see its rounds and what it asks for.
          </p>
        ) : (
          <div className="rounded-plane border border-edge bg-depth p-4 sm:p-6">
            <HorizonLanes value={horizon.length}>
              <HorizonTimeline
                schools={horizon}
                now={now}
                timeZone={timeZone}
                selectedIds={selected}
                onSelectionChange={setSelected}
                comparison={
                  <ComparisonTable
                    caption="Your schools side by side"
                    columns={visible.columns}
                    groups={visible.groups}
                  />
                }
              />
            </HorizonLanes>
          </div>
        )}
      </section>

      {/* Rendered on the server and passed in, so their code never ships (spec §6.11). */}
      {details}

      <SchoolList rows={rows} />
    </div>
  );
}
