// Story Studio sessions, turns and slot state (spec §10, §11). Progress is saved after every
// answer (§5.2), so a session can always be resumed and a dropped connection never loses an answer.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  chapters,
  interviewerMoves,
  slotsState,
  studioSessions,
  studioSessionStatuses,
  studioTurns,
  type InterviewerMove,
} from "../schema";
import { studioModes } from "../schema/profiles";
import { assertId } from "./ids";

export type StudioSession = typeof studioSessions.$inferSelect;
export type StudioTurn = typeof studioTurns.$inferSelect;
export type SlotStateRow = typeof slotsState.$inferSelect;

/* Sessions ----------------------------------------------------------------------------------- */

export const NewStudioSession = z.strictObject({
  mode: z.enum(studioModes),
  currentChapter: z.enum(chapters).optional(),
});

export type NewStudioSession = z.input<typeof NewStudioSession>;

export async function createStudioSession(
  db: DbExecutor,
  userId: string,
  input: NewStudioSession,
): Promise<StudioSession> {
  const values = NewStudioSession.parse(input);
  const [row] = await db
    .insert(studioSessions)
    .values({
      userId: assertId(userId, "userId"),
      mode: values.mode,
      currentChapter: values.currentChapter ?? "roots",
    })
    .returning();
  if (!row) throw new Error("Failed to create studio session");
  return row;
}

export async function getStudioSession(
  db: DbExecutor,
  userId: string,
  sessionId: string,
): Promise<StudioSession | null> {
  const [row] = await db
    .select()
    .from(studioSessions)
    .where(
      and(
        eq(studioSessions.userId, assertId(userId, "userId")),
        eq(studioSessions.id, assertId(sessionId, "sessionId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The session to resume: the most recent one still open (spec §5.2 "session resumed"). */
export async function getResumableSession(
  db: DbExecutor,
  userId: string,
): Promise<StudioSession | null> {
  const [row] = await db
    .select()
    .from(studioSessions)
    .where(
      and(
        eq(studioSessions.userId, assertId(userId, "userId")),
        inArray(studioSessions.status, ["active", "paused"]),
      ),
    )
    .orderBy(desc(studioSessions.startedAt))
    .limit(1);
  return row ?? null;
}

export const StudioSessionPatch = z
  .strictObject({
    /** Set when the applicant says "I'm short on time" mid-session (spec §5.2 hurry mode). */
    mode: z.enum(studioModes),
    currentChapter: z.enum(chapters),
    status: z.enum(studioSessionStatuses),
    openersAsked: z.int().min(0).max(20),
    voiceSeconds: z.int().min(0),
  })
  .partial();

export type StudioSessionPatch = z.input<typeof StudioSessionPatch>;

export async function updateStudioSession(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  patch: StudioSessionPatch,
): Promise<StudioSession | null> {
  const values = StudioSessionPatch.parse(patch);
  if (Object.keys(values).length === 0) return getStudioSession(db, userId, sessionId);
  const [row] = await db
    .update(studioSessions)
    .set(values)
    .where(
      and(
        eq(studioSessions.userId, assertId(userId, "userId")),
        eq(studioSessions.id, assertId(sessionId, "sessionId")),
      ),
    )
    .returning();
  return row ?? null;
}

export async function endStudioSession(
  db: DbExecutor,
  userId: string,
  sessionId: string,
): Promise<StudioSession | null> {
  const [row] = await db
    .update(studioSessions)
    .set({ status: "ended", endedAt: sql`now()` })
    .where(
      and(
        eq(studioSessions.userId, assertId(userId, "userId")),
        eq(studioSessions.id, assertId(sessionId, "sessionId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Turns -------------------------------------------------------------------------------------- */

export const NewStudioTurn = z.strictObject({
  sessionId: z.guid(),
  role: z.enum(["ai", "user"]),
  text: z.string().max(100_000).nullable().optional(),
  move: z.enum(interviewerMoves).nullable().optional(),
  slot: z.string().max(80).nullable().optional(),
  storyRef: z.string().max(16).nullable().optional(),
  sourceId: z.guid().nullable().optional(),
  latencyMs: z.int().min(0).nullable().optional(),
  clientTurnId: z.string().trim().min(1).max(100).nullable().optional(),
});

export type NewStudioTurn = z.input<typeof NewStudioTurn>;

/**
 * Appends a turn. `clientTurnId` makes POST /studio/turns idempotent (spec §11): sending the same
 * one twice returns the first row rather than recording the answer again.
 */
export async function appendStudioTurn(
  db: DbExecutor,
  userId: string,
  input: NewStudioTurn,
): Promise<{ turn: StudioTurn; created: boolean }> {
  const ownerId = assertId(userId, "userId");
  const values = NewStudioTurn.parse(input);

  if (values.clientTurnId) {
    const existing = await findTurnByClientId(db, ownerId, values.clientTurnId);
    if (existing) return { turn: existing, created: false };
  }

  const [row] = await db
    .insert(studioTurns)
    .values({
      userId: ownerId,
      sessionId: values.sessionId,
      role: values.role,
      text: values.text ?? null,
      move: (values.move ?? null) as InterviewerMove | null,
      slot: values.slot ?? null,
      storyRef: values.storyRef ?? null,
      sourceId: values.sourceId ?? null,
      latencyMs: values.latencyMs ?? null,
      clientTurnId: values.clientTurnId ?? null,
    })
    .onConflictDoNothing({ target: [studioTurns.userId, studioTurns.clientTurnId] })
    .returning();

  if (row) return { turn: row, created: true };

  // Lost the race against a concurrent identical request; the winner's row is the answer.
  const existing = values.clientTurnId
    ? await findTurnByClientId(db, ownerId, values.clientTurnId)
    : null;
  if (!existing) throw new Error("Failed to append studio turn");
  return { turn: existing, created: false };
}

async function findTurnByClientId(
  db: DbExecutor,
  ownerId: string,
  clientTurnId: string,
): Promise<StudioTurn | null> {
  const [row] = await db
    .select()
    .from(studioTurns)
    .where(and(eq(studioTurns.userId, ownerId), eq(studioTurns.clientTurnId, clientTurnId)))
    .limit(1);
  return row ?? null;
}

export async function listStudioTurns(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  options: { limit?: number } = {},
): Promise<StudioTurn[]> {
  return db
    .select()
    .from(studioTurns)
    .where(
      and(
        eq(studioTurns.userId, assertId(userId, "userId")),
        eq(studioTurns.sessionId, assertId(sessionId, "sessionId")),
      ),
    )
    .orderBy(asc(studioTurns.createdAt))
    .limit(options.limit ?? 500);
}

/** The last few turns, oldest first, for the Interviewer's short history (spec §8.5.1). */
export async function recentTurns(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  count = 6,
): Promise<StudioTurn[]> {
  const rows = await db
    .select()
    .from(studioTurns)
    .where(
      and(
        eq(studioTurns.userId, assertId(userId, "userId")),
        eq(studioTurns.sessionId, assertId(sessionId, "sessionId")),
      ),
    )
    .orderBy(desc(studioTurns.createdAt))
    .limit(count);
  return rows.reverse();
}

export async function countUserTurns(
  db: DbExecutor,
  userId: string,
  sessionId?: string,
): Promise<number> {
  const ownerId = assertId(userId, "userId");
  const where = sessionId
    ? and(
        eq(studioTurns.userId, ownerId),
        eq(studioTurns.sessionId, assertId(sessionId, "sessionId")),
        eq(studioTurns.role, "user"),
      )
    : and(eq(studioTurns.userId, ownerId), eq(studioTurns.role, "user"));
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studioTurns)
    .where(where);
  return row?.count ?? 0;
}

/* Slot state --------------------------------------------------------------------------------- */

export async function listSlotStates(db: DbExecutor, userId: string): Promise<SlotStateRow[]> {
  return db
    .select()
    .from(slotsState)
    .where(eq(slotsState.userId, assertId(userId, "userId")));
}

export const SlotStatePatch = z.strictObject({
  slotKey: z.string().trim().min(1).max(80),
  state: z.enum(["empty", "partial", "filled"]).optional(),
  evidenceStoryIds: z.array(z.guid()).max(50).optional(),
  asked: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export type SlotStatePatch = z.input<typeof SlotStatePatch>;

/**
 * Records what happened to a slot. `asked` stamps `last_asked_at` and `skipped` increments the
 * skip count; both feed the selector's fatigue term, so the Studio never nags.
 */
export async function upsertSlotState(
  db: DbExecutor,
  userId: string,
  patch: SlotStatePatch,
): Promise<SlotStateRow> {
  const ownerId = assertId(userId, "userId");
  const values = SlotStatePatch.parse(patch);
  const [row] = await db
    .insert(slotsState)
    .values({
      userId: ownerId,
      slotKey: values.slotKey,
      state: values.state ?? "empty",
      evidenceStoryIds: values.evidenceStoryIds ?? [],
      lastAskedAt: values.asked ? new Date() : null,
      skippedCount: values.skipped ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [slotsState.userId, slotsState.slotKey],
      set: {
        ...(values.state ? { state: values.state } : {}),
        ...(values.evidenceStoryIds ? { evidenceStoryIds: values.evidenceStoryIds } : {}),
        ...(values.asked ? { lastAskedAt: sql`now()` } : {}),
        ...(values.skipped ? { skippedCount: sql`${slotsState.skippedCount} + 1` } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert slot state");
  return row;
}

/** Replaces the derived part of every slot's state in one statement, keeping asked/skip history. */
export async function replaceDerivedSlotStates(
  db: DbExecutor,
  userId: string,
  derived: readonly {
    slotKey: string;
    state: "empty" | "partial" | "filled";
    evidenceStoryIds: string[];
  }[],
): Promise<void> {
  const ownerId = assertId(userId, "userId");
  if (derived.length === 0) return;
  await db
    .insert(slotsState)
    .values(
      derived.map((entry) => ({
        userId: ownerId,
        slotKey: entry.slotKey,
        state: entry.state,
        evidenceStoryIds: entry.evidenceStoryIds,
      })),
    )
    .onConflictDoUpdate({
      target: [slotsState.userId, slotsState.slotKey],
      set: {
        state: sql`excluded.state`,
        evidenceStoryIds: sql`excluded.evidence_story_ids`,
        updatedAt: sql`now()`,
      },
    });
}
