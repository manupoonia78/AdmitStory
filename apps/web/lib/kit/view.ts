import "server-only";

import {
  getCurrentDraft,
  getDb,
  getKitContext,
  listDeliverables,
  listKitStages,
  listNeedItems,
  listStories,
  type KitStageKey,
} from "@admitstory/db";
import type { FileMap } from "@admitstory/shared/kit";
import type { DraftsOutput } from "./pipeline";

// What screen F and GET /api/kits/:id show (spec §5.7, §6.10 F): the stage list, the deliverables
// with the story the file map gave each and the first line of its draft, and the blocking gap
// questions. Plain JSON, so the progress stream can send it as is.

export const STAGE_LABELS: Record<KitStageKey, string> = {
  context: "Reading your file",
  positioning: "Positioning",
  file_map: "File map",
  gaps: "Questions for you",
  angles: "Angles",
  drafts: "Essays",
  short_form: "Short answers",
  checks: "Checks",
  forms: "Form advisor and résumé pass",
  verify: "Verify list",
};

export interface KitView {
  id: string;
  status: "pending" | "running" | "ready" | "failed" | "preview";
  error: string | null;
  school: string;
  stages: { key: KitStageKey; label: string; status: string }[];
  deliverables: {
    id: string;
    title: string;
    prompt: string;
    /** "500 words", or "" when the portal sets none. */
    limit: string;
    type: string;
    status: string;
    mode: string;
    story: string | null;
    firstLine: string | null;
  }[];
  stories: { code: string; title: string }[];
  gaps: { id: string; question: string; approxWords: number | null; deliverable: string }[];
  failed: DraftsOutput["failed"];
}

const ORDER: KitStageKey[] = [
  "context",
  "positioning",
  "file_map",
  "gaps",
  "angles",
  "drafts",
  "short_form",
  "checks",
  "forms",
  "verify",
];

export async function loadKitView(userId: string, kitId: string): Promise<KitView | null> {
  const db = getDb();
  const ctx = await getKitContext(db, userId, kitId);
  if (!ctx) return null;
  const [stages, rows, stories, needs] = await Promise.all([
    listKitStages(db, userId, kitId),
    listDeliverables(db, userId, kitId),
    listStories(db, userId),
    listNeedItems(db, userId, { kitId, status: "open" }),
  ]);
  const byKey = new Map(stages.map((s) => [s.stage, s]));
  const fileMap = (ctx.kit.fileMap ?? {}) as Partial<FileMap>;
  const storyOf = new Map((fileMap.items ?? []).map((i) => [i.deliverable_key, i.primary_story]));
  const deliverables = await Promise.all(
    (rows ?? [])
      .filter((d) => d.type !== "lor_question" && d.type !== "interview_question")
      .map(async (d) => {
        const draft = await getCurrentDraft(db, userId, d.id);
        const first = draft?.content.paragraphs[0]?.sentences[0]?.text ?? null;
        return {
          id: d.id,
          title: d.title ?? d.packKey,
          prompt: d.promptText,
          limit:
            d.limitKind && d.limitValue
              ? `${d.limitValue} ${d.limitKind === "words" ? "words" : "characters"}`
              : "",
          type: d.type,
          status: d.status,
          mode: d.authorshipMode,
          story: storyOf.get(d.packKey) ?? null,
          firstLine: first,
        };
      }),
  );
  const titleOf = new Map((rows ?? []).map((d) => [d.id, d.title ?? d.packKey]));
  const drafts = byKey.get("drafts")?.output as DraftsOutput | undefined;
  return {
    id: kitId,
    status: ctx.kit.status,
    error: ctx.kit.error ?? null,
    school: ctx.school.shortName || ctx.school.name,
    stages: ORDER.map((key) => ({
      key,
      label: STAGE_LABELS[key],
      status: byKey.get(key)?.status ?? "pending",
    })),
    deliverables,
    stories: stories
      .filter((s) => s.mergedInto === null)
      .map((s) => ({ code: s.code, title: s.nickname })),
    gaps: needs
      .filter((n) => n.blocking)
      .map((n) => ({
        id: n.id,
        question: n.question,
        approxWords: n.approxWords,
        deliverable: titleOf.get(n.deliverableId) ?? "",
      })),
    failed: drafts?.failed ?? [],
  };
}
