import "server-only";

import {
  getDb,
  getFormAdvice,
  latestResumeReview,
  setBulletDecision,
  setFormEdit,
} from "@admitstory/db";
import { bulletText } from "@admitstory/linters";
import { ApiError } from "@/lib/api";
import { entryKey } from "./advise";
import { consistencyReport, RESUME_DOC } from "./consistency";
import { formKitContext } from "./view";

// "Use “13” here" (spec §5.10): the one-click fix for a consistency finding. It rewrites one value
// in a form entry or a résumé bullet to the Fact Sheet's phrasing, saved as the applicant's own
// edit, so a refresh of the advice never puts the old value back. Essays are opened instead: a
// draft paragraph is the applicant's to change, with its checks and history.

const FORM_DOC = /^form:([0-9a-f-]{36}):(.+)$/;

/**
 * Replaces every standalone occurrence of `said` in `text`, ignoring case; null when it isn't
 * there. Standalone: "15" never matches inside "2015" or "150".
 */
export function replaceValue(text: string, said: string, expected: string): string | null {
  const escaped = said.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return null;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  // A global replace starts from index 0 whatever test() left in lastIndex.
  return pattern.test(text) ? text.replace(pattern, expected) : null;
}

export async function applyExpected(
  userId: string,
  input: { findingId: string; docId: string; ref: string },
): Promise<void> {
  const db = getDb();
  const form = FORM_DOC.exec(input.docId);
  if (form?.[1]) await formKitContext(userId, form[1]);
  const report = await consistencyReport(db, userId, form?.[1] ? { kitId: form[1] } : {});
  const finding = report.findings.find((f) => f.id === input.findingId);
  const value = finding?.values.find((v) => v.docId === input.docId && v.ref === input.ref);
  if (!finding || !value) throw new ApiError(404, "That mismatch is already fixed.");
  if (finding.expected === null)
    throw new ApiError(
      409,
      "Your Fact Sheet doesn't say which is right. Change the one that's wrong.",
    );
  const cannot = () =>
    new ApiError(409, "We can't change that line for you. Edit it where it lives.");

  if (form?.[1] && form[2]) {
    const advice = await getFormAdvice(db, userId, form[1]);
    const [sectionKey, itemId] = [form[2], input.ref.split("/")[1] ?? ""];
    const item = advice?.content.sections
      .find((s) => s.section_key === sectionKey)
      ?.items.find((i) => i.id === itemId);
    const key = entryKey(sectionKey, itemId);
    const current = advice?.edits[key] ?? item?.entry?.text;
    const next = current ? replaceValue(current, value.said, finding.expected) : null;
    if (!next) throw cannot();
    await setFormEdit(db, userId, form[1], key, next);
    return;
  }

  if (input.docId !== RESUME_DOC) throw cannot();
  const review = await latestResumeReview(db, userId);
  const bullet = review?.content.sections
    .flatMap((s) => s.roles.flatMap((r) => r.bullets))
    .find((b) => b.id === input.ref);
  // Role headings and skills lines come from the résumé file itself; those change there.
  if (!review || !bullet) throw cannot();
  const next = replaceValue(
    bulletText(bullet, review.decisions[bullet.id]),
    value.said,
    finding.expected,
  );
  if (!next) throw cannot();
  await setBulletDecision(db, userId, review.id, bullet.id, { status: "edited", text: next });
}
