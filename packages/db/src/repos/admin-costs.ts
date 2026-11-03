// The admin Costs page and the hourly spend watch (spec §5.18, §8.4, §12.4), read from
// usage_ledger. Replay rows (AI_MODE=replay) cost what live calls would, so they are hidden by
// default: the page is about money actually spent.

import type { CostsView, SpendSnapshot } from "@admitstory/shared";
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { kits, purchases, schoolCycles, schools, usageLedger, userSchools, users } from "../schema";
import { adminDb, type AdminContext } from "./admin";

/** Per-kit caps (§12.4); packages/ai's budget.ts enforces them, this only reports. */
export const KIT_SOFT_CAP_USD = 15;
export const KIT_HARD_CAP_USD = 25;
/** A day is "high" when it is more than this multiple of the range's mean. */
const ANOMALY_FACTOR = 1.5;

const VOICE_TASKS = ["voice.stt", "voice.tts"];

function rangeWhere(from: Date, to: Date, includeReplay: boolean): SQL {
  const conditions = [gte(usageLedger.createdAt, from), lt(usageLedger.createdAt, to)];
  if (!includeReplay) conditions.push(eq(usageLedger.aiMode, "live"));
  return and(...conditions) as SQL;
}

const usd = sql<number>`coalesce(sum(${usageLedger.costUsd}), 0)::float8`;
const calls = sql<number>`count(distinct ${usageLedger.runId})::int`;

export async function costsOverview(
  admin: AdminContext,
  opts: { from: Date; to: Date; includeReplay: boolean },
): Promise<CostsView> {
  const db = adminDb(admin);
  const where = rangeWhere(opts.from, opts.to, opts.includeReplay);
  const day = sql<string>`to_char(date_trunc('day', ${usageLedger.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;

  const [byDayRows, byTaskRows, byModelRows, kitRows, userRows, voiceRows] = await Promise.all([
    db.select({ day, usd }).from(usageLedger).where(where).groupBy(day).orderBy(day),
    db
      .select({
        task: usageLedger.task,
        calls,
        usd,
        cacheRead: sql<number>`coalesce(sum(${usageLedger.cacheReadTokens}), 0)::float8`,
        inputAll: sql<number>`coalesce(sum(${usageLedger.inputTokens} + ${usageLedger.cacheReadTokens} + ${usageLedger.cacheWrite5mTokens} + ${usageLedger.cacheWrite1hTokens}), 0)::float8`,
        primaries: sql<number>`count(*) filter (where ${usageLedger.attemptKind} = 'primary')::int`,
        repairs: sql<number>`count(*) filter (where ${usageLedger.attemptKind} = 'repair')::int`,
        p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${usageLedger.latencyMs}), 0)::float8`,
      })
      .from(usageLedger)
      .where(and(where, sql`${usageLedger.task} not in ('voice.stt', 'voice.tts')`))
      .groupBy(usageLedger.task)
      .orderBy(desc(usd)),
    db
      .select({ model: usageLedger.servedModel, calls, usd })
      .from(usageLedger)
      .where(and(where, sql`${usageLedger.task} not in ('voice.stt', 'voice.tts')`))
      .groupBy(usageLedger.servedModel)
      .orderBy(desc(usd)),
    db
      .select({ kitId: usageLedger.kitId, usd })
      .from(usageLedger)
      .where(and(where, sql`${usageLedger.kitId} is not null`))
      .groupBy(usageLedger.kitId)
      .orderBy(desc(usd))
      .limit(20),
    db
      .select({ userId: usageLedger.userId, usd })
      .from(usageLedger)
      .where(and(where, sql`${usageLedger.userId} is not null`))
      .groupBy(usageLedger.userId)
      .orderBy(desc(usd))
      .limit(20),
    db
      .select({
        sttSeconds: sql<number>`coalesce(sum(${usageLedger.sttSeconds}), 0)::float8`,
        ttsChars: sql<number>`coalesce(sum(${usageLedger.ttsChars}), 0)::float8`,
        usd,
      })
      .from(usageLedger)
      .where(and(where, inArray(usageLedger.task, VOICE_TASKS))),
  ]);

  const kitIds = kitRows.map((row) => row.kitId).filter((id): id is string => id !== null);
  const userIds = userRows.map((row) => row.userId).filter((id): id is string => id !== null);
  const [kitInfo, userInfo, paidRows] = await Promise.all([
    kitIds.length === 0
      ? []
      : db
          .select({ kitId: kits.id, school: schools.shortName, email: users.email })
          .from(kits)
          .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
          .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
          .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
          .leftJoin(users, eq(users.id, kits.userId))
          .where(inArray(kits.id, kitIds)),
    userIds.length === 0
      ? []
      : db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.id, userIds)),
    userIds.length === 0
      ? []
      : db
          .selectDistinct({ userId: purchases.userId })
          .from(purchases)
          .where(and(inArray(purchases.userId, userIds), eq(purchases.status, "completed"))),
  ]);
  const kitById = new Map(kitInfo.map((row) => [row.kitId, row]));
  const emailById = new Map(userInfo.map((row) => [row.id, row.email]));
  const paid = new Set(paidRows.map((row) => row.userId));

  const dayMean =
    byDayRows.length === 0
      ? 0
      : byDayRows.reduce((sum, row) => sum + row.usd, 0) / byDayRows.length;
  const voice = voiceRows[0] ?? { sttSeconds: 0, ttsChars: 0, usd: 0 };

  return {
    range: { from: opts.from.toISOString(), to: opts.to.toISOString() },
    includeReplay: opts.includeReplay,
    totalUsd: byDayRows.reduce((sum, row) => sum + row.usd, 0),
    byDay: byDayRows.map((row) => ({
      day: row.day,
      usd: row.usd,
      anomaly: byDayRows.length >= 3 && dayMean > 0 && row.usd > dayMean * ANOMALY_FACTOR,
    })),
    byTask: byTaskRows.map((row) => ({
      task: row.task,
      calls: row.calls,
      usd: row.usd,
      cacheHitRate: row.inputAll > 0 ? row.cacheRead / row.inputAll : 0,
      repairRate: row.primaries > 0 ? row.repairs / row.primaries : 0,
      p50LatencyMs: Math.round(row.p50),
    })),
    byModel: byModelRows.map((row) => ({ model: row.model, calls: row.calls, usd: row.usd })),
    topKits: kitRows
      .filter((row): row is { kitId: string; usd: number } => row.kitId !== null)
      .map((row) => ({
        kitId: row.kitId,
        school: kitById.get(row.kitId)?.school ?? "(kit removed)",
        userEmail: kitById.get(row.kitId)?.email ?? null,
        usd: row.usd,
        overSoft: row.usd >= KIT_SOFT_CAP_USD,
        overHard: row.usd >= KIT_HARD_CAP_USD,
      })),
    topUsers: userRows
      .filter((row): row is { userId: string; usd: number } => row.userId !== null)
      .map((row) => ({
        userId: row.userId,
        email: emailById.get(row.userId) ?? "(deleted)",
        paid: paid.has(row.userId),
        usd: row.usd,
      })),
    voice: { sttMinutes: voice.sttSeconds / 60, ttsChars: voice.ttsChars, usd: voice.usd },
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  // Neutralise spreadsheet formulas as well as quoting.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per (day, task, model): enough to rebuild every table on the page. */
export async function costsCsv(
  admin: AdminContext,
  opts: { from: Date; to: Date; includeReplay: boolean },
): Promise<string> {
  const db = adminDb(admin);
  const day = sql<string>`to_char(date_trunc('day', ${usageLedger.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      task: usageLedger.task,
      model: usageLedger.servedModel,
      mode: usageLedger.aiMode,
      calls,
      attempts: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${usageLedger.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${usageLedger.outputTokens}), 0)::int`,
      usd,
    })
    .from(usageLedger)
    .where(rangeWhere(opts.from, opts.to, opts.includeReplay))
    .groupBy(day, usageLedger.task, usageLedger.servedModel, usageLedger.aiMode)
    .orderBy(day, usageLedger.task);
  const header = "day,task,model,mode,calls,attempts,input_tokens,output_tokens,usd";
  const lines = rows.map((row) =>
    [
      row.day,
      row.task,
      row.model,
      row.mode,
      row.calls,
      row.attempts,
      row.inputTokens,
      row.outputTokens,
      row.usd.toFixed(5),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

/** The hourly spend watch's numbers (§12.4): live spend only. */
export async function spendSnapshot(ctx: AdminContext, now: Date): Promise<SpendSnapshot> {
  const db = adminDb(ctx);
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(startOfDay.getTime() - 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const live = eq(usageLedger.aiMode, "live");

  const [today, trailing, kitTotals, repairs] = await Promise.all([
    db
      .select({ usd })
      .from(usageLedger)
      .where(and(live, gte(usageLedger.createdAt, startOfDay))),
    db
      .select({ usd })
      .from(usageLedger)
      .where(and(live, gte(usageLedger.createdAt, weekAgo), lt(usageLedger.createdAt, startOfDay))),
    // Kits that spent anything in the last day, with their all-time total.
    db
      .select({
        kitId: usageLedger.kitId,
        userId: sql<string | null>`max(${usageLedger.userId}::text)`,
        usd,
      })
      .from(usageLedger)
      .where(
        and(
          live,
          sql`${usageLedger.kitId} in (select distinct kit_id from usage_ledger where kit_id is not null and created_at >= ${dayAgo})`,
        ),
      )
      .groupBy(usageLedger.kitId)
      .having(sql`sum(${usageLedger.costUsd}) >= ${KIT_SOFT_CAP_USD}`),
    db
      .select({
        task: usageLedger.task,
        primaries: sql<number>`count(*) filter (where ${usageLedger.attemptKind} = 'primary')::int`,
        repairs: sql<number>`count(*) filter (where ${usageLedger.attemptKind} = 'repair')::int`,
      })
      .from(usageLedger)
      .where(and(live, gte(usageLedger.createdAt, dayAgo)))
      .groupBy(usageLedger.task),
  ]);

  const withKit = kitTotals.filter(
    (row): row is { kitId: string; userId: string | null; usd: number } => row.kitId !== null,
  );
  return {
    todayUsd: today[0]?.usd ?? 0,
    trailingDailyMeanUsd: (trailing[0]?.usd ?? 0) / 7,
    kitsOverSoft: withKit
      .filter((row) => row.usd < KIT_HARD_CAP_USD)
      .map((row) => ({ kitId: row.kitId, usd: row.usd })),
    kitsOverHard: withKit
      .filter((row) => row.usd >= KIT_HARD_CAP_USD)
      .map((row) => ({ kitId: row.kitId, userId: row.userId, usd: row.usd })),
    repairRates: repairs,
  };
}
