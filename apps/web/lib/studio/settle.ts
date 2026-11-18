import "server-only";

import { getDb, getSource, recentTurns } from "@admitstory/db";

// "Finish for now" right after an answer: that answer's extraction runs in the turn's `after()`
// (about 6 s on Haiku), so a summary built at once would leave it out, and the applicant would
// finish on numbers that don't include what they just said (Manu's testing round, 18 Nov 2026).
// The end route waits here, briefly, for the last answer to be extracted. The turn route marks
// each answer's source `extractedAt` once extraction has finished, whether or not it succeeded.

/** Answers older than this are long done (or stuck); there is nothing worth waiting for. */
const RECENT_MS = 30_000;
/** The longest "Finish for now" waits before showing the summary anyway. */
const MAX_WAIT_MS = 12_000;
const POLL_MS = 500;

export async function settleLastAnswer(userId: string, sessionId: string): Promise<void> {
  const db = getDb();
  const turns = await recentTurns(db, userId, sessionId, 4);
  const last = [...turns].reverse().find((turn) => turn.role === "user" && turn.sourceId !== null);
  if (!last?.sourceId) return;
  if (Date.now() - last.createdAt.getTime() > RECENT_MS) return;

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const source = await getSource(db, userId, last.sourceId);
    if (!source || source.meta?.extractedAt) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
