// The Form Advisor's words and counts (spec §5.10, §6.9). Pure and server-safe: no React, no
// Motion. Counting goes through `@admitstory/linters`, so the live count beside an entry is the
// number the limit check and "Copy for portal" use, on exactly the text that will be pasted.

import { countAfterNormalize, type LimitKind } from "@admitstory/linters";
import {
  FORM_ENTRY_RECOMMENDATIONS,
  FORM_RECOMMENDATION_LABELS,
  FORM_RECOMMENDATIONS,
  type FormItem,
  type FormRecommendation,
} from "@admitstory/shared/kit";
import type { CountRule } from "../workspace/portal-text";

/** The linters' counting rule for a pack limit. */
export function limitKind(rule: CountRule): LimitKind {
  if (rule.unit === "words") return "words";
  return rule.spaces === false ? "chars_excl_spaces" : "chars_incl_spaces";
}

/** The count of an entry by the school's rule, on the text "Copy for portal" puts on the clipboard. */
export function entryCount(text: string, rule: CountRule): number {
  return countAfterNormalize(text, limitKind(rule));
}

/** "300 characters", "50 words", "300 characters, not counting spaces". */
function perEntry(rule: CountRule): string {
  const unit = rule.unit === "words" ? "words" : "characters";
  const amount = `${rule.limit} ${rule.limit === 1 ? unit.replace(/s$/u, "") : unit}`;
  return rule.unit === "characters" && rule.spaces === false
    ? `${amount}, not counting spaces`
    : amount;
}

/**
 * The section's limits in one line: "Up to 3 entries, 300 characters each", "One entry, up to
 * 50 words", "Up to 3 entries", "Up to 300 characters an entry". Null when the pack gives none.
 */
export function limitDescription(
  itemCountMax: number | null,
  rule: CountRule | null,
): string | null {
  if (itemCountMax === 1) return rule ? `One entry, up to ${perEntry(rule)}` : "One entry";
  if (itemCountMax && rule) return `Up to ${itemCountMax} entries, ${perEntry(rule)} each`;
  if (itemCountMax) return `Up to ${itemCountMax} entries`;
  if (rule) return `Up to ${perEntry(rule)} an entry`;
  return null;
}

/** True when the recommendation puts an entry in the form (and counts against the maximum). */
export function isEntryLane(recommendation: FormRecommendation): boolean {
  return FORM_ENTRY_RECOMMENDATIONS.includes(recommendation);
}

/** How many entries the advice puts in the form. */
export function entryTally(items: readonly Pick<FormItem, "recommendation">[]): number {
  return items.filter((item) => isEntryLane(item.recommendation)).length;
}

/** "4 entries; the form takes 3." Null when the advice fits. */
export function overCountNote(entries: number, itemCountMax: number | null): string | null {
  if (itemCountMax === null || entries <= itemCountMax) return null;
  return `${entries} entries; the form takes ${itemCountMax}.`;
}

export interface FormLane<T extends Pick<FormItem, "recommendation">> {
  recommendation: FormRecommendation;
  /** Sentence case (§6.9): "Lead with", "Move to an essay". */
  label: string;
  items: T[];
}

/** The items grouped by recommendation, in FORM_RECOMMENDATIONS order, empty lanes left out. */
export function formLanes<T extends Pick<FormItem, "recommendation">>(
  items: readonly T[],
): FormLane<T>[] {
  return FORM_RECOMMENDATIONS.map((recommendation) => ({
    recommendation,
    label: FORM_RECOMMENDATION_LABELS[recommendation],
    items: items.filter((item) => item.recommendation === recommendation),
  })).filter((lane) => lane.items.length > 0);
}

/** What the toast says after "Copy for portal", repeating the button's verb (§6.9). */
export function copiedEntryMessage(candidate: string): string {
  return `Copied ${candidate} entry`;
}

/** The default one-line reason a coach-mode section has no written entries. */
export const COACH_POLICY_NOTE =
  "This school doesn't allow AI-written answers, so you write these entries yourself.";
