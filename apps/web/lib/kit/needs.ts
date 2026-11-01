import "server-only";

import { answerNeedItem, createSource, getDb, listNeedItems, type NeedItem } from "@admitstory/db";

// A NEED or gap answer (spec §5.7 stage 4, §5.8 NEED chips) is the applicant's own material: it is
// saved to the dossier as a `need_answer` source first, then the item points at it.

export async function answerNeed(
  userId: string,
  needId: string,
  text: string,
  meta: { via: "voice" | "text"; question?: string },
): Promise<{ need: NeedItem; sourceId: string } | null> {
  const db = getDb();
  const source = await createSource(db, userId, {
    kind: "need_answer",
    text,
    meta: { needId, via: meta.via, ...(meta.question ? { question: meta.question } : {}) },
  });
  const need = await answerNeedItem(db, userId, needId, source.id);
  return need ? { need, sourceId: source.id } : null;
}

/** Blocking gap questions still open on a kit. */
export async function openBlockingGaps(userId: string, kitId: string): Promise<NeedItem[]> {
  const open = await listNeedItems(getDb(), userId, { kitId, status: "open" });
  return open.filter((n) => n.blocking);
}
