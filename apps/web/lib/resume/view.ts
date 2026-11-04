import "server-only";

import {
  getDb,
  getGoals,
  getResume,
  isPaidUser,
  latestResumeReview,
  latestResumeSource,
  listChatMessages,
} from "@admitstory/db";
import type { ResumeDoc, ResumeNarrative } from "@admitstory/shared/kit";
import { strictestPageLimit, type PageLimit } from "@/lib/forms/resume";
import type { ChatTurn } from "@/lib/chat/types";

// The Résumé page (school workspace redesign): the narrative the résumé tells, the document
// itself, and the chat that reshapes it. Per applicant, shared by every school.

export interface ResumeWorkView {
  state: "locked" | "open";
  narrative: ResumeNarrative;
  /** True once the applicant saved a narrative of their own (not just our suggestion). */
  narrativeSet: boolean;
  doc: ResumeDoc | null;
  origin: "dossier" | "pasted" | "review" | null;
  asks: string[];
  version: number;
  pageLimit: PageLimit | null;
  /** An uploaded résumé the builder can start from. */
  upload: { fileName: string | null; reviewed: boolean } | null;
  turns: ChatTurn[];
}

function suggestedNarrative(goals: Awaited<ReturnType<typeof getGoals>>): ResumeNarrative {
  return {
    goal: goals?.shortTerm?.trim() ?? "",
    thread: goals?.longTerm?.trim() ? `On the way to: ${goals.longTerm.trim()}` : "",
    notes: "",
  };
}

export async function loadResumeWork(userId: string): Promise<ResumeWorkView> {
  const db = getDb();
  const paid = await isPaidUser(db, userId);
  const [row, goals, source, review, pageLimit, chat] = await Promise.all([
    getResume(db, userId),
    getGoals(db, userId),
    latestResumeSource(db, userId),
    latestResumeReview(db, userId),
    strictestPageLimit(db, userId),
    listChatMessages(db, userId, "resume"),
  ]);
  return {
    state: paid ? "open" : "locked",
    narrative: row?.narrative ?? suggestedNarrative(goals),
    narrativeSet: row !== null,
    doc: row?.content ?? null,
    origin: row?.origin ?? null,
    asks: row?.asks ?? [],
    version: row?.version ?? 0,
    pageLimit,
    upload: source ? { fileName: source.fileName, reviewed: review?.sourceId === source.id } : null,
    turns: chat.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      at: m.createdAt.toISOString(),
      canUndo: m.role === "coach" && m.undo !== null && !m.undone,
    })),
  };
}
