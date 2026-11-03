import "server-only";

import {
  getDeliverable,
  getDraft,
  getKitContext,
  markDraftsStale,
  replaceChecks,
  type DbExecutor,
} from "@admitstory/db";
import type { Paragraph } from "@admitstory/shared/kit";
import { lint, toCheck } from "./pipeline";

// Spec §5.3 AC: "Editing a fact marks drafts that used it as stale and re-runs their checks." The
// stale flag shows the Workspace banner ("This draft used the old team size. Update it?"); the
// deterministic checks run again at once, with no model call. The Critic runs on the next refine.

export async function rerunChecksAfterEdit(
  db: DbExecutor,
  input: { userId: string; factCodes?: string[]; storyCodes?: string[]; reason: string },
): Promise<{ stale: number }> {
  const ids = await markDraftsStale(db, {
    userId: input.userId,
    ...(input.factCodes ? { factCodes: input.factCodes } : {}),
    ...(input.storyCodes ? { storyCodes: input.storyCodes } : {}),
    reason: input.reason,
  });
  for (const id of ids) {
    const draft = await getDraft(db, input.userId, id);
    if (!draft || draft.content.paragraphs.length === 0) continue;
    const deliverable = await getDeliverable(db, input.userId, draft.deliverableId);
    if (!deliverable) continue;
    const kit = await getKitContext(db, input.userId, deliverable.kitId);
    const findings = lint(
      { paragraphs: draft.content.paragraphs as Paragraph[] },
      deliverable,
      kit?.cycle ?? "",
    );
    await replaceChecks(
      db,
      input.userId,
      draft.id,
      findings.map((f) => toCheck("linter", f)),
      { sources: ["linter"] },
    );
  }
  return { stale: ids.length };
}

/** Fact fields whose change makes a draft that used the fact out of date. */
export const FACT_CONTENT_FIELDS = ["key", "value", "approvedPhrasing", "consentToUse"] as const;
/** Story fields whose change does; the nickname, era and filing don't change what a draft says. */
export const STORY_CONTENT_FIELDS = [
  "situation",
  "stakes",
  "actions",
  "result",
  "reflection",
  "numbers",
  "consentToUse",
] as const;

export function touchesContent(patch: object, fields: readonly string[]): boolean {
  return fields.some((field) => Object.hasOwn(patch, field));
}
