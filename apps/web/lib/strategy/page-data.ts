import "server-only";

import { getDb } from "@admitstory/db";
import type { HorizonSchool } from "@admitstory/ui";
import type { RateLimit } from "@/lib/api";
import type { StrategyApplicant } from "./applicant";
import { comparisonModel, uncitedFigures, type ComparisonModel } from "./comparison";
import { honestFlags, plannerItems } from "./flags";
import { packRounds, shortDate } from "./pack";
import { loadApplicant, loadUserSchools, type StrategySchool } from "./server";
import type { StrategyRow } from "./types";

// Everything screen E renders on first paint (spec §5.5, §6.10 E), read once on the server. The
// comparison covers every school on the list; the page shows the columns the applicant selects, so
// the horizon's morph needs no request.

export const STRATEGY_LIMITS = {
  search: { limit: 60, windowMs: 60_000 },
  writes: { limit: 30, windowMs: 60_000 },
  /** Opus runs behind each preview; the free cap is the real limit, this stops a runaway client. */
  previewStart: { limit: 6, windowMs: 10 * 60_000 },
  /** §5.4: "unless the user asks" — and asking is cheap to repeat, so it is limited. */
  profileReadRefresh: { limit: 3, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimit>;

export interface StrategyData {
  applicant: StrategyApplicant;
  rows: StrategyRow[];
  horizon: HorizonSchool[];
  comparison: ComparisonModel;
  flags: ReturnType<typeof honestFlags>;
  planner: ReturnType<typeof plannerItems>;
  now: string;
}

/** The comparison model with any uncited figure removed (never expected; logged if it happens). */
export function safeComparison(model: ComparisonModel): ComparisonModel {
  const bad = new Set(uncitedFigures(model.groups));
  if (bad.size === 0) return model;
  console.error("[strategy] uncited figures removed:", [...bad].join(", "));
  return {
    ...model,
    groups: model.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).map(([column, cell]) => [
            column,
            bad.has(`${group.id}/${row.id}/${column}`) ? { kind: "empty" as const } : cell,
          ]),
        ),
      })),
    })),
  };
}

export function strategyModel(
  schools: readonly StrategySchool[],
  applicant: StrategyApplicant,
  now: Date,
): Omit<StrategyData, "applicant" | "now"> {
  const timeZone = applicant.timeZone;
  const rows: StrategyRow[] = schools.map((s) => {
    const rounds = s.pack ? packRounds(s.pack, timeZone) : [];
    return {
      userSchoolId: s.row.id,
      schoolId: s.row.school.id,
      name: s.row.school.name,
      shortName: s.row.school.shortName,
      cycle: s.row.cycle.cycle,
      pack: s.published ? "published" : "coming_soon",
      round: s.row.round,
      isReapplicant: s.row.isReapplicant,
      previousOutcome: s.row.previousOutcome,
      status: s.row.status,
      verified: s.published ? `Verified ${shortDate(s.published.publishedAt.toISOString())}` : null,
      roundOptions: rounds.map((r) => ({ value: r.short, label: r.label })),
    };
  });

  const horizon: HorizonSchool[] = schools.map((s) => {
    const rounds = s.pack ? packRounds(s.pack, timeZone) : [];
    const first = rounds[0];
    if (!s.published || !first)
      return { id: s.row.id, name: s.row.school.shortName, pack: "coming_soon" };
    const planned = rounds.find((r) => r.short === s.row.round);
    return {
      id: s.row.id,
      name: s.row.school.shortName,
      pack: "published",
      rounds: rounds.map(({ id, label, short, deadline }) => ({ id, label, short, deadline })),
      citation: first.citation,
      plannedRoundId: planned?.id ?? null,
    };
  });

  const columns = schools.map((s) => ({
    id: s.row.id,
    name: s.row.school.shortName,
    pack: s.pack,
    fit: s.fit,
    ...(s.published
      ? { meta: `Verified ${shortDate(s.published.publishedAt.toISOString())}` }
      : {}),
  }));

  return {
    rows,
    horizon,
    comparison: safeComparison(comparisonModel(columns, applicant)),
    flags: honestFlags(columns, applicant),
    planner: plannerItems(
      schools.map((s) => ({
        id: s.row.id,
        name: s.row.school.shortName,
        pack: s.pack,
        round: s.row.round,
      })),
      now,
      timeZone,
    ),
  };
}

export async function loadStrategy(userId: string, now = new Date()): Promise<StrategyData> {
  const [applicant, schools] = await Promise.all([
    loadApplicant(userId),
    loadUserSchools(getDb(), userId),
  ]);
  return { applicant, now: now.toISOString(), ...strategyModel(schools, applicant, now) };
}
