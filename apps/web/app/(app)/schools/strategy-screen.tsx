"use client";

import {
  ComparisonTable,
  HorizonPlaceholder,
  type HorizonSchool,
  type MatrixColumn,
  type MatrixGroup,
} from "@admitstory/ui";
import dynamic from "next/dynamic";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { StrategyRow } from "@/lib/strategy/types";
import { AddSchools } from "./add-schools";

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
    <div className="schools-frame">
      <header className="flex flex-col">
        <p className="eyebrow enter mb-3" style={{ "--i": 0 } as CSSProperties}>
          Where you will apply
        </p>
        <h1 className="enter text-display-2 text-text" style={{ "--i": 0.8 } as CSSProperties}>
          Your <span className="serif-accent text-text-soft">schools.</span>
        </h1>
        <p
          className="enter mt-4 max-w-[60ch] text-lg text-text-soft"
          style={{ "--i": 1.45 } as CSSProperties}
        >
          {headline(rows)}
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-16">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-3">
            <span aria-hidden className="h-[1.25px] w-60 bg-edge-strong" />
            <p className="text-title text-text">No schools on your list yet.</p>
          </div>
        ) : (
          cards
        )}

        <AddSchools inputRef={searchRef} autoFocus={rows.length === 0} />
      </div>

      <div className="mt-20 flex flex-col gap-12 border-t border-edge pt-12">
        <section aria-labelledby="horizon-heading" className="flex flex-col">
          <p className="label mb-3">Plan your rounds</p>
          <h2 id="horizon-heading" className="text-display-3 text-text">
            Your deadlines
          </h2>
          <p className="mt-3 mb-6 max-w-[60ch] text-sm text-text-soft">
            {selected.length < 2 && rows.length > 1
              ? "Pick two schools on the timeline to compare them side by side."
              : "Deadlines in your time zone and honest flags. Choose a school's round on its preview page."}
          </p>
          {rows.length === 0 ? (
            <div className="flex flex-col gap-3">
              <span aria-hidden className="h-[1.25px] w-60 bg-edge-strong" />
              <p className="text-sm text-text-soft">
                No schools yet. Search for one to see its rounds and what it asks for.
              </p>
            </div>
          ) : (
            <div className="card p-5 sm:p-7">
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
      </div>
    </div>
  );
}
