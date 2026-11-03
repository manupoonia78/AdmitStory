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

// Screen E (spec §5.5, §6.10 E; docs/design/phase-3-4-direction.md). From top to bottom: the next
// step as the headline, add schools, the horizon (the hero: selecting two morphs the lanes into
// columns with the comparison beneath), honest flags, the round planner, and the list with each
// school's round and "Preview kit". The horizon carries Motion, so it loads on its own behind a
// placeholder of its exact shape.

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
  /** The honest flags and the round planner, already rendered on the server. */
  details: ReactNode;
  now: string;
  timeZone: string;
}

function headline(rows: readonly StrategyRow[], selected: number): string {
  if (rows.length === 0) return "Add your first school to see its rounds and what it asks for";
  if (rows.length === 1) return "Add a second school to compare them side by side";
  if (selected < 2) return "Pick two schools to compare side by side";
  return "Read down each column, then plan your rounds";
}

export function StrategyScreen({
  rows,
  horizon,
  comparison,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">School Strategy</h1>
        <p className="max-w-essay font-reading text-read-lg text-text">
          {headline(rows, selected.length)}
        </p>
      </header>

      <AddSchools inputRef={searchRef} autoFocus={rows.length === 0} />

      <section aria-labelledby="horizon-heading" className="flex flex-col gap-4">
        <h2 id="horizon-heading" className="text-lg font-semibold text-text">
          Your deadlines
        </h2>
        {rows.length === 0 ? (
          <p className="text-text-soft">
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
