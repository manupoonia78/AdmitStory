import "server-only";

import {
  getDb,
  getFormAdvice,
  getKitContext,
  getLatestSnapshot,
  listDeliverables,
  listFacts,
  listStories,
  type Deliverable,
  type FormAdviceRow,
  type KitContext,
} from "@admitstory/db";
import type { FormSection, SchoolPack } from "@admitstory/kb/types";
import type { ConsistencyFinding } from "@admitstory/linters";
import type { CouldStillDo, FormItem } from "@admitstory/shared/kit";
import type { CountRule, FileEntry } from "@admitstory/ui";
import { ApiError } from "@/lib/api";
import { ai } from "@/lib/ai";
import { load } from "@/lib/kit/pipeline";
import { asPack } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";
import { kitFiles } from "@/lib/workspace/view";
import { deliverableContext, requireKitAccess } from "@/lib/workspace/server";
import { adviseForms, entryKey, formSections, sectionRule } from "./advise";
import { consistencyReport, findingsFor, formDocId } from "./consistency";

// The Form Advisor view (spec §5.10, §6.10 G): one form section of one kit, as plain JSON for the
// Workspace page and GET /api/kits/:id/forms. Kits built before Phase 5 have no advice yet; it is
// written the first time a form view is opened (one `forms.advise` call for the whole school).

export interface FormItemView extends FormItem {
  citations: { code: string; label: string; excerpt: string }[];
  userText: string | null;
}

export interface FormSectionView {
  key: string;
  label: string;
  rule: CountRule | null;
  itemCountMax: number | null;
  guidance: {
    text: string;
    source: { id: string; label: string; verifiedAt: string } | null;
  }[];
  items: FormItemView[];
  /** The Workspace deliverable for this section, for links between form views. */
  deliverableId: string | null;
}

export interface FormView {
  kitId: string;
  school: string;
  heading: string;
  files: FileEntry[];
  mode: "draft" | "coach";
  policyNote: string | null;
  section: FormSectionView;
  couldStillDo: CouldStillDo[];
  consistency: ConsistencyFinding[];
  /** Every mismatch across this kit's file and the résumé, for the plane beside the form. */
  kitConsistency: ConsistencyFinding[];
  stale: boolean;
  version: number;
  /** move_to_essay targets: pack key → the deliverable's title and id. */
  deliverables: Record<string, { title: string; id: string }>;
}

/** The pack key a form section's deliverable carries (lib/strategy/deliverables.ts). */
export const formPackKey = (sectionKey: string) => `form-${sectionKey}`.slice(0, 70);

export function sectionForDeliverable(
  pack: SchoolPack,
  deliverable: Pick<Deliverable, "packKey">,
): FormSection | null {
  return formSections(pack).find((s) => formPackKey(s.key) === deliverable.packKey) ?? null;
}

/** The advice for a kit, written now if the kit was built before the Form Advisor existed. */
export async function ensureFormAdvice(userId: string, kit: KitContext): Promise<FormAdviceRow> {
  const db = getDb();
  const existing = await getFormAdvice(db, userId, kit.kit.id);
  if (existing) return existing;
  if (kit.kit.status === "preview" || kit.kit.status === "pending" || kit.kit.status === "running")
    throw new ApiError(409, "Your kit is still being built. The form advice comes with it.");
  const deps = { ai: ai(), db };
  const ref = { kitId: kit.kit.id, userId };
  const { row } = await adviseForms(deps, ref, await load(deps, ref));
  if (!row) throw new ApiError(404, "This school's form has no sections we've verified yet.");
  return row;
}

/** The live counter's rule for a field, from the portal's counting rule. */
export function countRule(
  section: Pick<FormSection, "char_limit" | "limit_kind">,
): CountRule | null {
  const rule = sectionRule(section);
  if (!rule) return null;
  return rule.kind === "words"
    ? { unit: "words", limit: rule.value }
    : { unit: "characters", limit: rule.value, spaces: rule.kind === "chars_incl_spaces" };
}

/** True when the Dossier has moved on since the advice was written. */
async function isStale(userId: string, advice: FormAdviceRow): Promise<boolean> {
  const latest = await getLatestSnapshot(getDb(), userId);
  return latest !== null && latest.version > advice.dossierSnapshotVersion;
}

function guidanceOf(pack: SchoolPack, section: FormSection): FormSectionView["guidance"] {
  const sources = new Map(pack.sources.map((s) => [s.id, s]));
  return section.guidance
    .filter((g) => g.verified_at)
    .map((g) => {
      const source = g.source_ids.map((id) => sources.get(id)).find(Boolean);
      return {
        text: g.text,
        source:
          source && g.verified_at
            ? { id: source.id, label: source.title, verifiedAt: g.verified_at }
            : null,
      };
    });
}

export async function loadFormView(userId: string, deliverableId: string): Promise<FormView> {
  const { deliverable, kit } = await deliverableContext(userId, deliverableId);
  if (deliverable.type !== "form_section") throw new ApiError(404, "That form could not be found.");
  return formViewFor(userId, kit, deliverable);
}

/** The view for one section of a kit the applicant can open. */
export async function formViewFor(
  userId: string,
  kit: KitContext,
  deliverable: Deliverable,
): Promise<FormView> {
  const db = getDb();
  await requireKitAccess(userId, kit);
  const published = await latestPack(db, kit.schoolCycleId);
  if (!published) throw new ApiError(409, `${kit.school.name}'s pack isn't published.`);
  const pack = asPack(published.data);
  const section = sectionForDeliverable(pack, deliverable);
  if (!section) throw new ApiError(404, "That form could not be found.");

  const advice = await ensureFormAdvice(userId, kit);
  const [rows, facts, stories, files, report, stale] = await Promise.all([
    listDeliverables(db, userId, kit.kit.id),
    listFacts(db, userId),
    listStories(db, userId),
    kitFiles(userId, kit.kit.id),
    consistencyReport(db, userId, { kitId: kit.kit.id }),
    isStale(userId, advice),
  ]);

  const cite = new Map<string, { label: string; excerpt: string }>();
  for (const f of facts)
    cite.set(f.code, { label: f.key.replace(/_/g, " "), excerpt: f.approvedPhrasing ?? f.value });
  for (const s of stories)
    cite.set(s.code, { label: s.nickname, excerpt: s.result ?? s.situation ?? s.nickname });

  const sectionAdvice = advice.content.sections.find((s) => s.section_key === section.key);
  const items: FormItemView[] = (sectionAdvice?.items ?? []).map((item) => ({
    ...item,
    citations: item.cites.flatMap((code) => {
      const c = cite.get(code);
      return c ? [{ code, ...c }] : [];
    }),
    userText: advice.edits[entryKey(section.key, item.id)] ?? null,
  }));

  const school = kit.school.shortName || kit.school.name;
  const deliverables: FormView["deliverables"] = {};
  for (const d of rows ?? []) deliverables[d.packKey] = { title: d.title ?? d.packKey, id: d.id };

  return {
    kitId: kit.kit.id,
    school,
    heading: `${school} ${kit.cycle}`,
    files,
    mode: advice.mode,
    policyNote:
      advice.mode === "coach"
        ? `${school} doesn't allow AI-written application text, so you write these entries yourself.`
        : null,
    section: {
      key: section.key,
      label: section.label,
      rule: countRule(section),
      itemCountMax: section.item_count_max ?? null,
      guidance: guidanceOf(pack, section),
      items,
      deliverableId: deliverable.id,
    },
    couldStillDo: advice.content.could_still_do,
    consistency: findingsFor(report, new Set([formDocId(kit.kit.id, section.key)])),
    kitConsistency: report.findings,
    stale,
    version: advice.version,
    deliverables,
  };
}

/** A kit the applicant owns, has access to (not refunded) and that is past its preview. */
export async function formKitContext(userId: string, kitId: string): Promise<KitContext> {
  const kit = await getKitContext(getDb(), userId, kitId);
  if (!kit || kit.kit.status === "preview") throw new ApiError(404, "That kit could not be found.");
  await requireKitAccess(userId, kit);
  return kit;
}
