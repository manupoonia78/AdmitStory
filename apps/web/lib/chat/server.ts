import "server-only";

import type { TaskInput } from "@admitstory/ai";
import {
  addChatMessage,
  consumeEntitlement,
  createDraftVersion,
  getChatMessage,
  getCurrentDraft,
  getDb,
  getLorBrief,
  getResume,
  isPaidUser,
  listChatMessages,
  markChatUndone,
  releaseEntitlement,
  restoreDraftVersion,
  saveLorBrief,
  saveResume,
  setFormEdit,
  type ChatMessageRow,
  type ChatUndo,
  type KitContext,
} from "@admitstory/db";
import type { LorBrief, VideoPlan } from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";
import { ai } from "@/lib/ai";
import { entryKey } from "@/lib/forms/advise";
import { strictestPageLimit } from "@/lib/forms/resume";
import { loadFormView } from "@/lib/forms/view";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import { deliverableContext, draftContext, refineDraft } from "@/lib/workspace/server";
import type { ChatThreadView, ChatTurn } from "./types";

// The chat beside every school deliverable and the résumé (school workspace redesign). One
// message is one change: essays go through the Reviser's paragraph patches (draft.revise), so
// locked and hand-edited paragraphs stay safe; form entries, video talking points and brief
// points go through chat.revise; the résumé through resume.write. Each coach turn that changed
// something keeps what it replaced, so Undo puts it back exactly.

const HISTORY_TURNS = 8;

/** `deliverable:<uuid>`, `brief:<uuid>:<groupKey>` or `resume`. */
export type Thread =
  | { kind: "deliverable"; id: string }
  | { kind: "brief"; recommenderId: string; groupKey: string }
  | { kind: "resume" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseThread(value: string): Thread | null {
  if (value === "resume") return { kind: "resume" };
  const [kind, id, ...rest] = value.split(":");
  if (!id || !UUID.test(id)) return null;
  if (kind === "deliverable" && rest.length === 0) return { kind, id };
  const groupKey = rest.join(":");
  if (kind === "brief" && /^[A-Za-z0-9_:-]{1,80}$/.test(groupKey))
    return { kind, recommenderId: id, groupKey };
  return null;
}

export function threadKey(thread: Thread): string {
  return thread.kind === "resume"
    ? "resume"
    : thread.kind === "deliverable"
      ? `deliverable:${thread.id}`
      : `brief:${thread.recommenderId}:${thread.groupKey}`;
}

function turnOf(row: ChatMessageRow): ChatTurn {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    at: row.createdAt.toISOString(),
    canUndo: row.role === "coach" && row.undo !== null && !row.undone,
  };
}

/** Checks the caller may use the thread (it 404s on anything that isn't theirs). */
async function authorize(userId: string, thread: Thread): Promise<void> {
  const db = getDb();
  if (thread.kind === "deliverable") {
    await deliverableContext(userId, thread.id);
    return;
  }
  if (thread.kind === "brief") {
    const row = await getLorBrief(db, userId, thread.recommenderId, thread.groupKey);
    if (!row) throw new ApiError(404, "That brief could not be found.");
    return;
  }
  if (!(await isPaidUser(db, userId)))
    throw new ApiError(402, "The résumé builder comes with your first School Kit.");
}

export async function loadThread(userId: string, thread: Thread): Promise<ChatThreadView> {
  await authorize(userId, thread);
  const rows = await listChatMessages(getDb(), userId, threadKey(thread));
  return { thread: threadKey(thread), turns: rows.map(turnOf) };
}

function historyOf(rows: readonly ChatMessageRow[]) {
  return rows.slice(-HISTORY_TURNS).map((r) => ({ role: r.role, text: r.text.slice(0, 2_000) }));
}

/** What one message did: the coach's reply and, when something changed, how to undo it. */
interface Outcome {
  reply: string;
  undo: ChatUndo | null;
}

/** Sends one message: runs the change, stores both turns, returns the thread as it now stands. */
export async function sendMessage(
  userId: string,
  thread: Thread,
  message: string,
): Promise<ChatThreadView> {
  await authorize(userId, thread);
  const db = getDb();
  const key = threadKey(thread);
  const earlier = await listChatMessages(db, userId, key, HISTORY_TURNS);
  const outcome =
    thread.kind === "deliverable"
      ? await onDeliverable(userId, thread.id, message, earlier)
      : thread.kind === "brief"
        ? await onBrief(userId, thread, message, earlier)
        : await onResume(userId, message, earlier);
  await addChatMessage(db, userId, { thread: key, role: "you", text: message });
  await addChatMessage(db, userId, {
    thread: key,
    role: "coach",
    text: outcome.reply,
    undo: outcome.undo,
  });
  return loadThread(userId, thread);
}

/** Puts back what one coach turn replaced. */
export async function undoMessage(
  userId: string,
  thread: Thread,
  messageId: string,
): Promise<ChatThreadView> {
  await authorize(userId, thread);
  const db = getDb();
  const row = await getChatMessage(db, userId, messageId);
  if (!row || row.thread !== threadKey(thread) || !row.undo || row.undone)
    throw new ApiError(404, "There's nothing to undo there.");
  const undo = row.undo;
  if (undo.kind === "draft") {
    const { draft } = await draftContext(userId, undo.draftId);
    await restoreDraftVersion(db, userId, draft.id);
  } else if (undo.kind === "form") {
    for (const [entry, text] of Object.entries(undo.edits))
      await setFormEdit(db, userId, undo.kitId, entry, text);
  } else if (undo.kind === "brief") {
    if (thread.kind !== "brief") throw new ApiError(404, "There's nothing to undo there.");
    const brief = await getLorBrief(db, userId, thread.recommenderId, thread.groupKey);
    if (!brief?.meta || brief.id !== undo.briefId)
      throw new ApiError(409, "That brief was rebuilt since, so this change can't be undone.");
    await saveLorBrief(db, userId, thread.recommenderId, thread.groupKey, {
      content: undo.content as LorBrief,
      meta: brief.meta,
      planVersion: brief.planVersion,
      dossierSnapshotVersion: brief.dossierSnapshotVersion ?? 0,
    });
  } else {
    await saveResume(db, userId, { content: undo.content });
  }
  await markChatUndone(db, userId, row.id);
  await addChatMessage(db, userId, {
    thread: row.thread,
    role: "coach",
    text: "Undone. It's back to how it was before that change.",
  });
  return loadThread(userId, thread);
}

/* Deliverables: essays, short answers, goal fields, video plans, form sections ----------------- */

async function spendRefinement(userId: string, kit: KitContext): Promise<() => Promise<void>> {
  const db = getDb();
  const used = await consumeEntitlement(db, userId, {
    refId: kit.schoolCycleId,
    counter: "revisions",
  });
  if (!used.ok)
    throw new ApiError(
      402,
      used.reason === "limit_reached"
        ? `You've used all ${used.limit} refinements for this kit.`
        : `Your access to the ${kit.school.name} kit has ended.`,
    );
  return async () => {
    await releaseEntitlement(db, userId, { refId: kit.schoolCycleId, counter: "revisions" });
  };
}

async function onDeliverable(
  userId: string,
  deliverableId: string,
  message: string,
  earlier: readonly ChatMessageRow[],
): Promise<Outcome> {
  const db = getDb();
  const { deliverable, kit } = await deliverableContext(userId, deliverableId);
  if (deliverable.type === "form_section") return onForm(userId, deliverableId, message, earlier);

  const current = await getCurrentDraft(db, userId, deliverable.id);
  if (!current) throw new ApiError(409, "This one isn't drafted yet. It appears as soon as it is.");
  const video = current.content.video as VideoPlan | null | undefined;
  if (video && video.questions.length > 0)
    return onVideo(userId, kit, deliverable.id, current.id, video, message, earlier);
  if (current.content.paragraphs.length === 0)
    throw new ApiError(
      409,
      `${kit.school.shortName || kit.school.name} asks you to write this one yourself. Use the coaching beats beside it, and ask me anything about them in Coach.`,
    );

  const ctx = await draftContext(userId, current.id);
  const result = await refineDraft(userId, ctx, { instruction: message });
  const over =
    result.over > 0 ? ` It's ${result.over} over the limit now, so say what to cut next.` : "";
  return {
    reply: `${result.summary}${over}`,
    undo: { kind: "draft", draftId: current.id },
  };
}

async function onVideo(
  userId: string,
  kit: KitContext,
  deliverableId: string,
  draftId: string,
  video: VideoPlan,
  message: string,
  earlier: readonly ChatMessageRow[],
): Promise<Outcome> {
  const db = getDb();
  const fields = video.questions.flatMap((q, qi) =>
    q.points.map((p, pi) => ({
      id: `q${qi + 1}:p${pi + 1}`,
      label: q.question.slice(0, 400),
      text: p.text,
      limit_chars: null,
    })),
  );
  if (fields.length === 0) throw new ApiError(409, "There are no talking points to change yet.");
  const release = await spendRefinement(userId, kit);
  let revision;
  try {
    const snapshot = await ensureSnapshot(userId);
    revision = await ai().run(
      "chat.revise",
      {
        kind: "video_points",
        title: `${kit.school.shortName || kit.school.name} video essay`,
        context: `Timing: ${video.structure.seconds} seconds in all. Talking points, said in the applicant's own words on camera.`,
        fields,
        instruction: message,
        history: historyOf(earlier),
      },
      { userId, kitId: kit.kit.id, dossier: snapshot.compactText },
    );
  } catch (error) {
    await release();
    throw error;
  }
  if (revision.edits.length === 0) {
    await release();
    return { reply: revision.reply, undo: null };
  }
  const edits = new Map(revision.edits.map((e) => [e.id, e.text]));
  const next: VideoPlan = {
    ...video,
    questions: video.questions.map((q, qi) => ({
      ...q,
      points: q.points.map((p, pi) => ({
        ...p,
        text: edits.get(`q${qi + 1}:p${pi + 1}`) ?? p.text,
      })),
    })),
  };
  const current = await getCurrentDraft(db, userId, deliverableId);
  if (!current) throw new ApiError(409, "This one isn't drafted yet.");
  await createDraftVersion(db, userId, deliverableId, {
    author: "ai",
    content: { ...current.content, video: next } as never,
    plainText: next.questions
      .map((q) => [q.question, ...q.points.map((p) => `- ${p.text}`)].join("\n"))
      .join("\n\n"),
    note: revision.reply.slice(0, 300),
  });
  return { reply: revision.reply, undo: { kind: "draft", draftId } };
}

async function onForm(
  userId: string,
  deliverableId: string,
  message: string,
  earlier: readonly ChatMessageRow[],
): Promise<Outcome> {
  const db = getDb();
  const view = await loadFormView(userId, deliverableId);
  const { kit } = await deliverableContext(userId, deliverableId);
  const section = view.section;
  const items = section.items.filter((i) => i.entry !== null || i.userText !== null);
  if (items.length === 0)
    throw new ApiError(
      409,
      view.mode === "coach"
        ? `${view.school} asks you to write these entries yourself. Ask me about any of them in Coach.`
        : "There are no entries in this section to change yet.",
    );
  const chars = section.rule?.unit === "characters" ? section.rule.limit : null;
  const fields = items.map((i) => ({
    id: i.id,
    label: `${i.candidate} (${i.recommendation.replace(/_/g, " ")})`,
    text: i.userText ?? i.entry?.text ?? "",
    limit_chars: chars,
  }));
  const release = await spendRefinement(userId, kit);
  let revision;
  try {
    const snapshot = await ensureSnapshot(userId);
    revision = await ai().run(
      "chat.revise",
      {
        kind: "form_entries",
        title: `${view.school} application form: ${section.label}`,
        context: [
          section.rule
            ? `Each entry: at most ${section.rule.limit} ${section.rule.unit}.`
            : "No limit per entry.",
          section.itemCountMax ? `At most ${section.itemCountMax} entries.` : "",
          view.mode === "coach"
            ? "Coach mode: this school doesn't allow AI-written form text. Give pointers, not entries."
            : "",
          ...section.guidance.map((g) => g.text),
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 3_000),
        fields,
        instruction: message,
        history: historyOf(earlier),
      },
      { userId, kitId: kit.kit.id, dossier: snapshot.compactText },
    );
  } catch (error) {
    await release();
    throw error;
  }
  if (revision.edits.length === 0 || view.mode === "coach") {
    await release();
    return { reply: revision.reply, undo: null };
  }
  const before: Record<string, string | null> = {};
  for (const edit of revision.edits) {
    const item = items.find((i) => i.id === edit.id);
    if (!item) continue;
    const entry = entryKey(section.key, item.id);
    before[entry] = item.userText;
    await setFormEdit(db, userId, view.kitId, entry, edit.text);
  }
  return { reply: revision.reply, undo: { kind: "form", kitId: view.kitId, edits: before } };
}

/* Recommender briefs ---------------------------------------------------------------------------- */

async function onBrief(
  userId: string,
  thread: Extract<Thread, { kind: "brief" }>,
  message: string,
  earlier: readonly ChatMessageRow[],
): Promise<Outcome> {
  const db = getDb();
  const row = await getLorBrief(db, userId, thread.recommenderId, thread.groupKey);
  if (!row?.content || !row.meta)
    throw new ApiError(409, "This brief isn't built yet. Build it first, then shape it here.");
  const brief = row.content;
  const meta = row.meta;
  const fields: TaskInput<"chat.revise">["fields"] = [
    { id: "cover_note", label: "Cover note to the recommender", text: brief.cover_note },
  ];
  brief.schools.forEach((school, si) =>
    school.questions.forEach((q, qi) =>
      q.talking_points.forEach((p, pi) =>
        fields.push({
          id: `s${si + 1}:q${qi + 1}:p${pi + 1}`,
          label:
            `${meta.schools.find((s) => s.schoolCycleId === school.school_cycle_id)?.school ?? "School"}: ${q.question_verbatim}`.slice(
              0,
              400,
            ),
          text: `${p.point}${p.evidence ? ` | Evidence: ${p.evidence}` : ""}`,
        }),
      ),
    ),
  );
  const snapshot = await ensureSnapshot(userId);
  const revision = await ai().run(
    "chat.revise",
    {
      kind: "brief_points",
      title: `Brief for ${meta.recommender.name}`,
      context:
        'Each talking point is "point | Evidence: what the recommender saw". Keep that shape. A point is at most 35 words and two sentences; never letter prose.',
      fields: fields.slice(0, 80),
      instruction: message,
      history: historyOf(earlier),
    },
    { userId, dossier: snapshot.compactText },
  );
  if (revision.edits.length === 0) return { reply: revision.reply, undo: null };
  const edits = new Map(revision.edits.map((e) => [e.id, e.text]));
  const next: LorBrief = {
    ...brief,
    cover_note: edits.get("cover_note") ?? brief.cover_note,
    schools: brief.schools.map((school, si) => ({
      ...school,
      questions: school.questions.map((q, qi) => ({
        ...q,
        talking_points: q.talking_points.map((p, pi) => {
          const edit = edits.get(`s${si + 1}:q${qi + 1}:p${pi + 1}`);
          if (!edit) return p;
          const [point, evidence] = edit.split(/\s*\|\s*Evidence:\s*/);
          return { ...p, point: (point ?? edit).trim(), evidence: evidence?.trim() ?? p.evidence };
        }),
      })),
    })),
  };
  const saved = await saveLorBrief(db, userId, thread.recommenderId, thread.groupKey, {
    content: next,
    meta,
    planVersion: row.planVersion,
    dossierSnapshotVersion: row.dossierSnapshotVersion ?? snapshot.version,
  });
  return {
    reply: revision.reply,
    undo: saved ? { kind: "brief", briefId: saved.id, content: brief } : null,
  };
}

/* The résumé ------------------------------------------------------------------------------------ */

async function onResume(
  userId: string,
  message: string,
  earlier: readonly ChatMessageRow[],
): Promise<Outcome> {
  const db = getDb();
  const row = await getResume(db, userId);
  if (!row?.content)
    throw new ApiError(409, "Build your résumé first, then shape it here in the chat.");
  const [snapshot, limit] = await Promise.all([
    ensureSnapshot(userId),
    strictestPageLimit(db, userId),
  ]);
  const written = await ai().run(
    "resume.write",
    {
      narrative: row.narrative,
      current: row.content,
      instruction: message,
      history: historyOf(earlier),
      page_limit: limit?.pages ?? null,
    },
    { userId, dossier: snapshot.compactText },
  );
  await saveResume(db, userId, { content: written.resume, asks: written.asks });
  return { reply: written.reply, undo: { kind: "resume", content: row.content } };
}
