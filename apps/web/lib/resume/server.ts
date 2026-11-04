import "server-only";

import {
  addChatMessage,
  getDb,
  getResume,
  isPaidUser,
  latestResumeSource,
  saveResume,
} from "@admitstory/db";
import type { ResumeNarrative } from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";
import { ai } from "@/lib/ai";
import { strictestPageLimit } from "@/lib/forms/resume";
import { ensureSnapshot } from "@/lib/strategy/jobs";

// Builds the applicant's résumé (school workspace redesign): from the dossier alone, from a CV
// they paste, or from the résumé they uploaded, always telling the narrative they set. The chat
// then reshapes it (lib/chat/server.ts).

const CV_CHARS = 24_000;

export type BuildFrom = "dossier" | "pasted" | "upload";

export async function buildResume(
  userId: string,
  input: { narrative: ResumeNarrative; from: BuildFrom; pasted?: string },
): Promise<void> {
  const db = getDb();
  if (!(await isPaidUser(db, userId)))
    throw new ApiError(402, "The résumé builder comes with your first School Kit.");
  let cv: string | null = null;
  if (input.from === "pasted") {
    cv = input.pasted?.trim().slice(0, CV_CHARS) ?? "";
    if (!cv) throw new ApiError(400, "Paste your CV first.");
  } else if (input.from === "upload") {
    const source = await latestResumeSource(db, userId);
    if (!source?.text.trim()) throw new ApiError(409, "Upload a résumé first.");
    cv = source.text.slice(0, CV_CHARS);
  }
  const [snapshot, limit, existing] = await Promise.all([
    ensureSnapshot(userId),
    strictestPageLimit(db, userId),
    getResume(db, userId),
  ]);
  await saveResume(db, userId, { narrative: input.narrative });
  const written = await ai().run(
    "resume.write",
    {
      narrative: input.narrative,
      current: null,
      pasted_cv: cv,
      instruction: null,
      page_limit: limit?.pages ?? null,
    },
    { userId, dossier: snapshot.compactText },
  );
  await saveResume(db, userId, {
    content: written.resume,
    origin: input.from === "upload" ? "review" : input.from,
    asks: written.asks,
  });
  await addChatMessage(db, userId, {
    thread: "resume",
    role: "coach",
    text: written.reply,
    undo: existing?.content ? { kind: "resume", content: existing.content } : null,
  });
}

export async function saveNarrative(userId: string, narrative: ResumeNarrative): Promise<void> {
  const db = getDb();
  if (!(await isPaidUser(db, userId)))
    throw new ApiError(402, "The résumé builder comes with your first School Kit.");
  await saveResume(db, userId, { narrative });
}
