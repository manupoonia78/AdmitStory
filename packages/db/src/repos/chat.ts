// The chat beside each school deliverable and the working résumé (school workspace redesign).
// Every statement is scoped to the owner.

import type { ResumeDoc, ResumeNarrative } from "@admitstory/shared/kit";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import {
  chatMessages,
  resumes,
  type ChatMessageRow,
  type ChatRole,
  type ChatUndo,
  type ResumeRow,
} from "../schema";
import { assertId } from "./ids";

export type { ChatMessageRow, ChatRole, ChatUndo, ResumeRow };

/** A thread's turns, oldest first: the newest `limit` of them. */
export async function listChatMessages(
  db: DbExecutor,
  userId: string,
  thread: string,
  limit = 60,
): Promise<ChatMessageRow[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(eq(chatMessages.userId, assertId(userId, "userId")), eq(chatMessages.thread, thread)),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function addChatMessage(
  db: DbExecutor,
  userId: string,
  input: { thread: string; role: ChatRole; text: string; undo?: ChatUndo | null },
): Promise<ChatMessageRow> {
  const [row] = await db
    .insert(chatMessages)
    .values({
      userId: assertId(userId, "userId"),
      thread: input.thread,
      role: input.role,
      text: input.text,
      undo: input.undo ?? null,
    })
    .returning();
  if (!row) throw new Error("chat message insert returned nothing");
  return row;
}

export async function getChatMessage(
  db: DbExecutor,
  userId: string,
  id: string,
): Promise<ChatMessageRow | null> {
  const [row] = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, assertId(userId, "userId")),
        eq(chatMessages.id, assertId(id, "id")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function markChatUndone(db: DbExecutor, userId: string, id: string): Promise<void> {
  await db
    .update(chatMessages)
    .set({ undone: true, updatedAt: sql`now()` })
    .where(
      and(
        eq(chatMessages.userId, assertId(userId, "userId")),
        eq(chatMessages.id, assertId(id, "id")),
      ),
    );
}

/* The working résumé --------------------------------------------------------------------------- */

export async function getResume(db: DbExecutor, userId: string): Promise<ResumeRow | null> {
  const [row] = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

/** Creates or updates the applicant's résumé. A new `content` bumps the version. */
export async function saveResume(
  db: DbExecutor,
  userId: string,
  input: {
    narrative?: ResumeNarrative;
    content?: ResumeDoc | null;
    origin?: "dossier" | "pasted" | "review";
    asks?: string[];
  },
): Promise<ResumeRow> {
  const ownerId = assertId(userId, "userId");
  const bump = input.content !== undefined;
  const [row] = await db
    .insert(resumes)
    .values({
      userId: ownerId,
      narrative: input.narrative ?? { goal: "", thread: "", notes: "" },
      content: input.content ?? null,
      origin: input.origin ?? null,
      asks: input.asks ?? [],
      version: bump ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: resumes.userId,
      set: {
        ...(input.narrative ? { narrative: input.narrative } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.origin ? { origin: input.origin } : {}),
        ...(input.asks ? { asks: input.asks } : {}),
        ...(bump ? { version: sql`${resumes.version} + 1` } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!row) throw new Error("résumé upsert returned nothing");
  return row;
}
