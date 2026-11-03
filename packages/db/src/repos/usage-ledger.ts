import { eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { aiModes, attemptKinds, usageLedger } from "../schema";
import type { LedgerSink, UsageEntry, VoiceUsageEntry } from "../types";
import { isPaidUser } from "./commerce";
import { assertId } from "./ids";

const count = z.int().nonnegative();
const label = z.string().trim().min(1).max(200);

// Mirrors UsageEntry; guards the ledger against NaN costs or negative counts
// from a pricing or usage-parsing bug, which would silently skew budgets (§12.4).
const UsageEntrySchema = z.strictObject({
  runId: z.guid(),
  userId: z.guid().nullable(),
  kitId: z.guid().nullable(),
  schoolPackId: z.guid().nullable(),
  task: label,
  model: label,
  servedModel: label,
  effort: label.nullable(),
  attemptKind: z.enum(attemptKinds),
  aiMode: z.enum(aiModes),
  inputTokens: count,
  cacheReadTokens: count,
  cacheWrite5mTokens: count,
  cacheWrite1hTokens: count,
  outputTokens: count,
  webSearches: count,
  costUsd: z.number().finite().nonnegative(),
  latencyMs: count,
  promptVersion: label,
  traceId: z.string().max(200).nullable(),
  stopReason: z.string().max(100).nullable(),
}) satisfies z.ZodType<UsageEntry>;

export async function recordUsage(db: DbExecutor, entry: UsageEntry): Promise<void> {
  await db.insert(usageLedger).values(UsageEntrySchema.parse(entry));
}

const VoiceUsageEntrySchema = z.strictObject({
  runId: z.guid(),
  userId: z.guid(),
  task: z.enum(["voice.stt", "voice.tts"]),
  model: label,
  sttSeconds: z.number().finite().nonnegative(),
  ttsChars: count,
  costUsd: z.number().finite().nonnegative(),
  latencyMs: count,
  aiMode: z.enum(aiModes),
}) satisfies z.ZodType<VoiceUsageEntry>;

/** One voice row: STT seconds or TTS characters. They count toward costForUser like any other. */
export async function recordVoiceUsage(db: DbExecutor, entry: VoiceUsageEntry): Promise<void> {
  const value = VoiceUsageEntrySchema.parse(entry);
  await db.insert(usageLedger).values({
    ...value,
    servedModel: value.model,
    attemptKind: "primary",
    promptVersion: value.task,
  });
}

async function sumCost(db: DbExecutor, where: SQL): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${usageLedger.costUsd}), 0)` })
    .from(usageLedger)
    .where(where);
  return Number(row?.total ?? 0);
}

/** Lifetime AI cost for a user in USD (free-user cap, spec §12.4). */
export async function costForUser(db: DbExecutor, userId: string): Promise<number> {
  return sumCost(db, eq(usageLedger.userId, assertId(userId, "userId")));
}

/** Lifetime AI cost for a kit in USD (kit soft/hard caps, spec §12.4). */
export async function costForKit(db: DbExecutor, kitId: string): Promise<number> {
  return sumCost(db, eq(usageLedger.kitId, assertId(kitId, "kitId")));
}

/** Adapts the ledger to packages/ai's LedgerSink, as wired up in apps/web. */
export function createUsageLedgerSink(db: DbExecutor): LedgerSink {
  return {
    write: (entry) => recordUsage(db, entry),
    spentByUser: (userId) => costForUser(db, userId),
    spentByKit: (kitId) => costForKit(db, kitId),
    isPaidUser: (userId) => isPaidUser(db, userId),
  };
}
