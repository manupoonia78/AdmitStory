// The chat beside each school deliverable and the working résumé (the school workspace redesign,
// 2026-11-04).
//
// - `chat_messages`: one row per turn. `thread` names what the chat is about:
//   `deliverable:<id>`, `brief:<recommenderId>:<groupKey>` or `resume`. A coach turn that changed
//   the document keeps what it replaced in `undo`, so "Undo" puts it back exactly.
// - `resumes`: the applicant's working résumé, one per applicant (the Résumé Pass is per
//   applicant, Phase 5 decision 2), with the narrative it tells.

import type { ResumeDoc, ResumeNarrative } from "@admitstory/shared/kit";
import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const chatRoles = ["you", "coach"] as const;
export type ChatRole = (typeof chatRoles)[number];

/** What a coach turn replaced. `draft`: the previous draft id; the others: the content before. */
export type ChatUndo =
  | { kind: "draft"; draftId: string }
  | { kind: "form"; kitId: string; edits: Record<string, string | null> }
  | { kind: "brief"; briefId: string; content: unknown }
  | { kind: "resume"; content: ResumeDoc | null };

export const chatMessages = pgTable(
  "chat_messages",
  {
    ...baseColumns(),
    userId: owner(),
    thread: text("thread").notNull(),
    role: text("role").$type<ChatRole>().notNull(),
    text: text("text").notNull(),
    undo: jsonb("undo").$type<ChatUndo>(),
    /** Set once the change was undone, so the button goes away. */
    undone: boolean("undone").notNull().default(false),
  },
  (t) => [index("chat_messages_user_thread_idx").on(t.userId, t.thread, t.createdAt)],
);

export const resumes = pgTable(
  "resumes",
  {
    ...baseColumns(),
    userId: owner(),
    narrative: jsonb("narrative").$type<ResumeNarrative>().notNull(),
    content: jsonb("content").$type<ResumeDoc>(),
    /** What the last build started from: the dossier, a pasted CV or the reviewed upload. */
    origin: text("origin").$type<"dossier" | "pasted" | "review">(),
    asks: text("asks").array().notNull().default([]),
    version: integer("version").notNull().default(0),
  },
  (t) => [unique("resumes_user_unique").on(t.userId)],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type ResumeRow = typeof resumes.$inferSelect;
