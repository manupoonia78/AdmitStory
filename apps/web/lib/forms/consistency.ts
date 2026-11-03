import "server-only";

import {
  getCurrentDraft,
  getFormAdvice,
  getKitContext,
  latestResumeReview,
  listDeliverables,
  listDismissedFindings,
  listFacts,
  listKits,
  type DbExecutor,
  type FormAdviceRow,
  type ResumeReviewRow,
} from "@admitstory/db";
import {
  bulletText,
  checkConsistency,
  type ConsistencyDoc,
  type ConsistencyFinding,
  type ConsistencyRole,
  type FactRef,
} from "@admitstory/linters";
import type { Paragraph } from "@admitstory/shared/kit";
import { asPack } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";
import { entryKey, formSections } from "./advise";

// The consistency check across the résumé, the form entries, the essays and short answers and,
// from Phase 6, the recommender briefs (spec §5.10, canon FORM-01). Pure code over what is stored,
// recomputed on every read — there is nothing to go stale. Within one kit it covers that school's
// file and the résumé (which every school receives); without a kit, every kit's file.

/** Document ids: the résumé, a form section of a kit, a deliverable. */
export const RESUME_DOC = "resume";
export const formDocId = (kitId: string, sectionKey: string) => `form:${kitId}:${sectionKey}`;

const DRAFTED = new Set(["essay", "short_answer", "goal_field"]);

export function factRefs(
  facts: readonly { code: string; key: string; value: string; approvedPhrasing: string | null }[],
): FactRef[] {
  return facts.map((f) => ({
    code: f.code,
    key: f.key,
    value: f.value,
    approvedPhrasing: f.approvedPhrasing,
  }));
}

/** The résumé as the applicant will send it: each bullet's current text after their decision. */
export function resumeDoc(review: ResumeReviewRow): {
  doc: ConsistencyDoc;
  roles: ConsistencyRole[];
} {
  const roles: ConsistencyRole[] = [];
  const segments: ConsistencyDoc["segments"] = [];
  for (const section of review.content.sections) {
    for (const role of section.roles) {
      roles.push({
        ref: role.id,
        organisation: role.organisation,
        title: role.title,
        dates: role.dates,
      });
      for (const bullet of role.bullets)
        segments.push({ ref: bullet.id, text: bulletText(bullet, review.decisions[bullet.id]) });
    }
    section.lines.forEach((line, i) =>
      segments.push({ ref: `${section.id}.line${i + 1}`, text: line }),
    );
  }
  return { doc: { id: RESUME_DOC, kind: "resume", label: "Resume", segments }, roles };
}

/** One doc per form section: the applicant's own text where they edited, else the advice. */
export function formDocs(
  kitId: string,
  school: string,
  advice: FormAdviceRow,
  labels: ReadonlyMap<string, string> = new Map(),
): ConsistencyDoc[] {
  return advice.content.sections.map((section) => ({
    id: formDocId(kitId, section.section_key),
    kind: "form" as const,
    label: `${school} form: ${labels.get(section.section_key) ?? section.section_key}`,
    segments: section.items.flatMap((item) => {
      const text = advice.edits[entryKey(section.section_key, item.id)] ?? item.entry?.text;
      return text ? [{ ref: entryKey(section.section_key, item.id), text }] : [];
    }),
  }));
}

async function kitDocs(db: DbExecutor, userId: string, kitId: string): Promise<ConsistencyDoc[]> {
  const [ctx, deliverables, advice] = await Promise.all([
    getKitContext(db, userId, kitId),
    listDeliverables(db, userId, kitId),
    getFormAdvice(db, userId, kitId),
  ]);
  if (!ctx) return [];
  const school = ctx.school.shortName || ctx.school.name;
  const pack = advice ? await latestPack(db, ctx.schoolCycleId) : null;
  const labels = new Map(
    pack ? formSections(asPack(pack.data)).map((s) => [s.key, s.label] as const) : [],
  );
  const drafts = await Promise.all(
    (deliverables ?? [])
      .filter((d) => DRAFTED.has(d.type))
      .map(async (d) => {
        const draft = await getCurrentDraft(db, userId, d.id);
        const paragraphs = (draft?.content.paragraphs ?? []) as Paragraph[];
        return {
          id: d.id,
          kind: "essay" as const,
          label: `${school} ${d.title ?? d.packKey}`,
          segments: paragraphs.map((p) => ({
            ref: p.id,
            text: p.sentences.map((s) => s.text).join(" "),
          })),
        };
      }),
  );
  return [
    ...(advice ? formDocs(kitId, school, advice, labels) : []),
    ...drafts.filter((d) => d.segments.length > 0),
  ];
}

export interface ConsistencyReport {
  findings: ConsistencyFinding[];
  /** Ids of the documents that were compared, for "Everything matches across…". */
  compared: { id: string; kind: ConsistencyDoc["kind"]; label: string }[];
}

/** Every mismatch for one kit's file plus the résumé, or for all of the applicant's kits. */
export async function consistencyReport(
  db: DbExecutor,
  userId: string,
  scope: { kitId?: string } = {},
): Promise<ConsistencyReport> {
  const [facts, review, dismissed, kits] = await Promise.all([
    listFacts(db, userId),
    latestResumeReview(db, userId),
    listDismissedFindings(db, userId),
    scope.kitId ? Promise.resolve([{ id: scope.kitId }]) : listKits(db, userId),
  ]);
  const docs: ConsistencyDoc[] = [];
  let roles: ConsistencyRole[] = [];
  if (review) {
    const resume = resumeDoc(review);
    docs.push(resume.doc);
    roles = resume.roles;
  }
  for (const kit of kits) docs.push(...(await kitDocs(db, userId, kit.id)));
  // Recommender briefs join in Phase 6 (kind "brief").
  const findings = checkConsistency({ facts: factRefs(facts), roles, docs, dismissed });
  return {
    findings,
    compared: docs.map((d) => ({ id: d.id, kind: d.kind, label: d.label })),
  };
}

/** Findings that involve one document (the Checks tab, the form view, the résumé page). */
export function findingsFor(report: ConsistencyReport, docIds: ReadonlySet<string>) {
  return report.findings.filter((f) => f.values.some((v) => docIds.has(v.docId)));
}
