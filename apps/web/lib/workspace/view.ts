import "server-only";

import {
  getCurrentDraft,
  getDb,
  getDraft,
  listAngles,
  listChecks,
  listDeliverables,
  listDraftVersions,
  listFacts,
  listGoldenLines,
  listNeedItems,
  listStories,
  listVerifyItems,
  type Deliverable,
  type DraftRow,
  type KitContext,
} from "@admitstory/db";
import { countAfterNormalize } from "@admitstory/linters";
import type {
  CheckFinding,
  CountRule,
  DraftParagraph,
  DraftVersion,
  FileEntry,
  FileGroupId,
  FileStatus,
  OptionSummary,
  SourceExcerpts,
  VerifyEntry,
} from "@admitstory/ui";
import type { CoachBeats, FileMap, VideoPlan } from "@admitstory/shared/kit";
import { deliverableContext, policyFor } from "./server";

// Everything screen G shows for one deliverable (spec §5.8, §6.10 G), as plain JSON for the page
// and GET /api/deliverables/:id. Provenance resolves to the applicant's own material, so the
// your-words view can show "the moment you said it" for every highlighted sentence.

const GROUP_OF: Record<string, FileGroupId> = {
  essay: "essays",
  short_answer: "short_answers",
  goal_field: "short_answers",
  video: "video",
  form_section: "form",
  lor_question: "recommenders",
  interview_question: "interview",
};

const VERSION_LIMIT = 30;

export function countRuleOf(d: Pick<Deliverable, "limitKind" | "limitValue">): CountRule | null {
  if (!d.limitKind || !d.limitValue) return null;
  return d.limitKind === "words"
    ? { unit: "words", limit: d.limitValue }
    : { unit: "characters", limit: d.limitValue, spaces: d.limitKind === "chars_incl_spaces" };
}

function fileStatus(d: Deliverable, failed: boolean): FileStatus {
  if (failed) return "failed";
  return d.status === "pending" ? "waiting" : d.status;
}

export interface WorkspaceView {
  kitId: string;
  school: string;
  heading: string;
  files: FileEntry[];
  deliverable: {
    id: string;
    title: string;
    prompt: string;
    type: string;
    mode: "draft" | "coach" | "talking_points";
    rule: CountRule | null;
    final: boolean;
  };
  draft: {
    id: string;
    paragraphs: DraftParagraph[];
    stale: boolean;
    staleReason: string | null;
    coach: CoachBeats | null;
    video: VideoPlan | null;
    isFinal: boolean;
    text: string;
  } | null;
  needs: {
    id: string;
    paragraphId: string | null;
    afterSentence: number | null;
    question: string;
    approxWords: number;
  }[];
  sources: SourceExcerpts;
  versions: DraftVersion[];
  options: (OptionSummary & { angleId: string; draftId: string | null })[];
  checks: (CheckFinding & { id: string })[];
  verify: VerifyEntry[];
  why: {
    story: { id: string; title: string } | null;
    whyThisStory: string;
    whatItProves: string;
    shows: string[];
    promptParts: { part: string; paragraphs: number[] }[];
    schoolFit: { text: string; sources: { id: string; label: string; verifiedAt: string }[] }[];
  };
  policy: {
    stance: string;
    url: string | null;
    verifiedAt: string | null;
    disclosure: string | null;
  } | null;
}

async function versionsOf(userId: string, deliverableId: string): Promise<DraftVersion[]> {
  const db = getDb();
  const rows = (await listDraftVersions(db, userId, deliverableId)).slice(-VERSION_LIMIT);
  const full = await Promise.all(rows.map((r) => getDraft(db, userId, r.id)));
  return full.flatMap((d) =>
    d
      ? [
          {
            id: d.id,
            number: d.version,
            author: d.author,
            createdAt: d.createdAt.toISOString(),
            ...(d.note ? { label: d.note } : {}),
            text: d.plainText,
          },
        ]
      : [],
  );
}

export async function loadWorkspaceView(
  userId: string,
  deliverableId: string,
): Promise<WorkspaceView> {
  const db = getDb();
  const { deliverable, kit } = await deliverableContext(userId, deliverableId);
  const [all, draft, angles, lines, facts, stories, needs, verify, policy, versions] =
    await Promise.all([
      listDeliverables(db, userId, kit.kit.id),
      getCurrentDraft(db, userId, deliverable.id),
      listAngles(db, userId, deliverable.id),
      listGoldenLines(db, userId),
      listFacts(db, userId),
      listStories(db, userId),
      listNeedItems(db, userId, { kitId: kit.kit.id }),
      listVerifyItems(db, userId, kit.kit.id),
      policyFor(kit),
      versionsOf(userId, deliverable.id),
    ]);
  const checks = draft ? await listChecks(db, userId, draft.id) : [];
  const allVersions = await listDraftVersions(db, userId, deliverable.id);

  const openNeeds = needs.filter((n) => n.status === "open");
  const files: FileEntry[] = await Promise.all(
    (all ?? []).map(async (d) => {
      const rule = countRuleOf(d);
      const current = d.id === deliverable.id ? draft : await getCurrentDraft(db, userId, d.id);
      const open =
        openNeeds.filter((n) => n.deliverableId === d.id).length +
        verify.filter((v) => v.deliverableId === d.id && v.status === "open").length;
      return {
        key: d.id,
        title: d.title ?? d.packKey,
        group: GROUP_OF[d.type] ?? "essays",
        status: fileStatus(d, false),
        ...(open > 0 ? { openQuestions: open } : {}),
        ...(rule && current
          ? {
              progress: {
                count: countAfterNormalize(current.plainText, d.limitKind ?? "words"),
                limit: rule.limit,
                unit: rule.unit,
              },
            }
          : {}),
      };
    }),
  );

  const sources: Record<string, { label: string; quote: string }> = {};
  for (const line of lines) sources[line.code] = { label: "Your words", quote: line.text };
  for (const fact of facts)
    sources[fact.code] = {
      label: "Fact Sheet",
      quote: `${fact.key.replace(/_/g, " ")}: ${fact.value}`,
    };
  for (const story of stories)
    sources[story.code] = {
      label: `Your story "${story.nickname}"`,
      quote: story.situation ?? story.nickname,
    };

  const content = (draft?.content ?? {}) as DraftRow["content"] & {
    coach?: CoachBeats;
    video?: VideoPlan | null;
    notes?: {
      why_this_story: string;
      what_it_proves: string;
      school_fit_points: { text: string; k_ids: string[] }[];
    };
    prompt_parts_answered?: { part: string; paragraph_ids: string[] }[];
  };
  const paragraphIds = (draft?.content.paragraphs ?? []).map((p) => p.id);
  const fileMap = (kit.kit.fileMap ?? {}) as Partial<FileMap>;
  const mapItem = fileMap.items?.find((i) => i.deliverable_key === deliverable.packKey);
  const story = mapItem?.primary_story
    ? stories.find((s) => s.code === mapItem.primary_story)
    : undefined;
  const verifiedOn = kit.kit.updatedAt.toISOString().slice(0, 10);

  return {
    kitId: kit.kit.id,
    school: kit.school.shortName || kit.school.name,
    heading: `${kit.school.shortName || kit.school.name} ${kit.cycle}`,
    files,
    deliverable: {
      id: deliverable.id,
      title: deliverable.title ?? deliverable.packKey,
      prompt: deliverable.promptText,
      type: deliverable.type,
      mode: deliverable.authorshipMode,
      rule: countRuleOf(deliverable),
      final: deliverable.status === "final",
    },
    draft: draft
      ? {
          id: draft.id,
          paragraphs: draft.content.paragraphs.map((p) => ({
            id: p.id,
            sentences: p.sentences,
            ...(draft.lockedParagraphs.includes(p.id) ? { locked: true } : {}),
          })),
          stale: draft.stale,
          staleReason: draft.staleReason,
          coach: content.coach ?? null,
          video: content.video ?? null,
          isFinal: draft.isFinal,
          text: draft.plainText,
        }
      : null,
    needs: openNeeds
      .filter((n) => n.deliverableId === deliverable.id && (!n.draftId || n.draftId === draft?.id))
      .map((n) => ({
        id: n.id,
        paragraphId: n.paragraphId,
        afterSentence: n.afterSentence,
        question: n.question,
        approxWords: n.approxWords ?? 20,
      })),
    sources,
    versions,
    options: angles.map((a) => {
      const optionDraft = allVersions.findLast((v) => v.angleId === a.id) ?? null;
      return {
        angleId: a.id,
        draftId: optionDraft?.id ?? null,
        label: a.label,
        pitch: a.pitch,
        openingLine: a.opening,
        stories: (a.stories ?? []).map(
          (code) => stories.find((s) => s.code === code)?.nickname ?? code,
        ),
        risks: a.tradeoffs ?? [],
        recommended: a.recommended,
        reason: a.reason ?? "",
        drafted: optionDraft !== null,
        inUse: draft?.angleId === a.id,
      };
    }),
    checks: checks
      .filter((c) => c.status === "open")
      .map((c) => ({
        id: c.id,
        rule_id: c.ruleId,
        severity: c.severity,
        location: c.location,
        explanation: c.explanation,
        fix_hint: c.fixHint,
        ...(c.patch ? { patch: c.patch as CheckFinding["patch"] } : {}),
      })),
    verify: verify
      .filter((v) => v.deliverableId === deliverable.id || v.deliverableId === null)
      .map((v) => ({
        id: v.id,
        text: v.text,
        reason: v.reason,
        status: v.status,
        correction: v.correction,
      })),
    why: {
      story: story ? { id: story.code, title: story.nickname } : null,
      whyThisStory: content.notes?.why_this_story ?? mapItem?.why ?? "",
      whatItProves: content.notes?.what_it_proves ?? "",
      shows: [...(mapItem?.traits_shown ?? []), ...(mapItem?.lenses ?? [])].map((t) =>
        t.replace(/_/g, " "),
      ),
      promptParts: (content.prompt_parts_answered ?? []).map((p) => ({
        part: p.part,
        paragraphs: p.paragraph_ids.map((id) => paragraphIds.indexOf(id) + 1).filter((n) => n > 0),
      })),
      schoolFit: (content.notes?.school_fit_points ?? []).map((p) => ({
        text: p.text,
        sources: p.k_ids.map((id) => ({
          id,
          label: `${kit.school.name} pack`,
          verifiedAt: verifiedOn,
        })),
      })),
    },
    policy,
  };
}

export type { KitContext };
