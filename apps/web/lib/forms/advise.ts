import "server-only";

import {
  getKit,
  getVerifiedAiPolicy,
  listDeliverables,
  saveFormAdvice,
  type Deliverable,
  type FormAdviceRow,
} from "@admitstory/db";
import type { FormSection, SchoolPack } from "@admitstory/kb/types";
import { fitToLimit, type LimitRule } from "@admitstory/linters";
import type { FileMap, FormAdvice } from "@admitstory/shared/kit";
import { authorshipFor, type AiStance } from "@/lib/kit/authorship";
import type { KitDeps, KitRef, Loaded } from "@/lib/kit/pipeline";

// The Form Advisor (spec §5.10, §8.5.12): one `forms.advise` call for every form section of the
// school, run by pipeline stage 9 and on demand for kits built before Phase 5. Entries follow the
// school's essay authorship mode (Phase 5 decision): a `limited` or `prohibited` school gets the
// recommendations, reasons and pointers but no written entries. After the call, every entry is
// fitted to the portal's count (fitToLimit only ever removes text), so the AC "every rewritten
// entry fits its limit by the school's counting rule" holds even when the model overshoots.

/** The form fields the pack has verified, as the advisor and the live count see them. */
export function formSections(pack: SchoolPack): FormSection[] {
  return pack.application.form_sections.filter((s) => s.verified_at);
}

/** A form field's portal counting rule; characters including spaces when the pack doesn't say. */
export function sectionRule(
  section: Pick<FormSection, "char_limit" | "limit_kind">,
): LimitRule | null {
  return section.char_limit
    ? { kind: section.limit_kind ?? "chars_incl_spaces", value: section.char_limit }
    : null;
}

/** The key an entry's edits and trims are stored under. */
export const entryKey = (sectionKey: string, itemId: string) => `${sectionKey}/${itemId}`;

/** Draft or coach, from the essays' authorship (which came from the school's verified policy). */
async function formMode(deps: KitDeps, l: Loaded, rows: readonly Deliverable[]) {
  const essay = rows.find((d) => d.type === "essay");
  if (essay) return essay.authorshipMode === "coach" ? "coach" : "draft";
  const policy = await getVerifiedAiPolicy(deps.db, l.ctx.schoolCycleId);
  const stance = (policy?.stance as AiStance | undefined) ?? "unknown";
  return authorshipFor("essay", stance) === "coach" ? "coach" : "draft";
}

/**
 * Fits every entry to its field and records what was shortened: the entry gets a Verify line so
 * the applicant checks it still says what they mean.
 */
export function fitFormEntries(
  advice: FormAdvice,
  sections: readonly FormSection[],
): { advice: FormAdvice; trimmed: string[] } {
  const rules = new Map(sections.map((s) => [s.key, sectionRule(s)]));
  const trimmed: string[] = [];
  const verify = [...advice.verify];
  const fitted = advice.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const rule = rules.get(section.section_key) ?? null;
      if (!item.entry || !rule) return item;
      const fit = fitToLimit(item.entry.text, rule);
      if (!fit.trimmed) return item;
      trimmed.push(entryKey(section.section_key, item.id));
      verify.push({
        text: fit.text,
        reason: `Shortened to fit the ${rule.value}-character limit. Check it still says what you mean.`,
      });
      return { ...item, entry: { ...item.entry, text: fit.text } };
    }),
  }));
  return { advice: { ...advice, sections: fitted, verify: verify.slice(0, 20) }, trimmed };
}

export async function adviseForms(
  deps: KitDeps,
  ref: KitRef,
  l: Loaded,
): Promise<{ sections: number; mode: "draft" | "coach"; row: FormAdviceRow | null }> {
  const sections = formSections(l.pack);
  const rows = (await listDeliverables(deps.db, ref.userId, ref.kitId)) ?? [];
  const mode = await formMode(deps, l, rows);
  if (sections.length === 0) return { sections: 0, mode, row: null };

  const kit = await getKit(deps.db, ref.userId, ref.kitId);
  const fileMap = (kit?.fileMap ?? {}) as Partial<FileMap>;
  const primary = new Map((fileMap.items ?? []).map((i) => [i.deliverable_key, i.primary_story]));
  const written = rows.filter((d) => ["essay", "short_answer", "goal_field"].includes(d.type));

  const output = await deps.ai.run(
    "forms.advise",
    {
      mode,
      sections: sections.slice(0, 12).map((s) => ({
        key: s.key,
        label: s.label,
        limit: sectionRule(s),
        item_count_max: s.item_count_max ?? null,
      })),
      deliverables: written.slice(0, 40).map((d) => ({
        key: d.packKey,
        title: d.title ?? d.packKey,
        primary_story: primary.get(d.packKey) ?? null,
      })),
    },
    l.run,
  );
  const { advice, trimmed } = fitFormEntries(output, sections);
  const row = await saveFormAdvice(deps.db, ref.userId, ref.kitId, {
    mode,
    content: advice,
    trimmed,
    dossierSnapshotVersion: l.snapshot.version,
    packVersion: l.published.version,
  });
  return { sections: sections.length, mode, row };
}
