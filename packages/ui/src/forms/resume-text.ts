// The Résumé Pass's words and navigation (spec §5.10, §6.9). Pure and server-safe.

import { orderedSections } from "@admitstory/linters";
import type { BulletDecision, ResumeBullet, ResumeReview } from "@admitstory/shared/kit";

/** "1 page", "1.3 pages", "0.8 pages". */
export function formatPages(pages: number): string {
  const rounded = Math.round(pages * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? "page" : "pages"}`;
}

/** "Darden asks for 1", "Darden and Foster ask for 1", "Your schools ask for 1". */
export function limitAsk(limit: { pages: number; schools: readonly string[] }): string {
  const { schools, pages } = limit;
  if (schools.length === 1) return `${schools[0]} asks for ${pages}`;
  if (schools.length === 2) return `${schools[0]} and ${schools[1]} ask for ${pages}`;
  return `Your schools ask for ${pages}`;
}

export interface PageSummary {
  /** "About 1.3 pages". An estimate, and labelled as one. */
  estimate: string;
  /** "Your schools ask for 1", or null without a limit. */
  ask: string | null;
  over: boolean;
}

export function pageSummary(
  pages: number,
  limit: { pages: number; schools: readonly string[] } | null,
): PageSummary {
  return {
    estimate: `About ${formatPages(pages)}`,
    ask: limit ? limitAsk(limit) : null,
    over: limit !== null && pages > limit.pages,
  };
}

/** Every bullet in the order the sheet shows them. */
export function bulletsInOrder(review: ResumeReview, useSuggestedOrder: boolean): ResumeBullet[] {
  return orderedSections(review, useSuggestedOrder).flatMap((section) =>
    section.roles.flatMap((role) => role.bullets),
  );
}

/** The bullet J (+1) or K (−1) moves to, stopping at the ends. */
export function stepBullet(
  order: readonly Pick<ResumeBullet, "id">[],
  current: string | null,
  step: 1 | -1,
): string | null {
  if (order.length === 0) return null;
  const at = order.findIndex((b) => b.id === current);
  if (at < 0) return (step === 1 ? order[0] : order.at(-1))?.id ?? null;
  return order[Math.min(order.length - 1, Math.max(0, at + step))]?.id ?? null;
}

/** The next bullet with a rewrite still to decide, after `current` first, then from the top. */
export function nextUndecided(
  order: readonly ResumeBullet[],
  decisions: Readonly<Record<string, BulletDecision>>,
  current: string | null,
): string | null {
  const open = (b: ResumeBullet) => b.rewrite !== null && !decisions[b.id] && b.id !== current;
  const at = order.findIndex((b) => b.id === current);
  return (order.slice(at + 1).find(open) ?? order.slice(0, Math.max(0, at)).find(open))?.id ?? null;
}

export type BulletState = "suggestion" | "accepted" | "rejected" | "edited" | "strong";

export function bulletState(
  bullet: ResumeBullet,
  decision: BulletDecision | undefined,
): BulletState {
  if (decision) return decision.status;
  return bullet.rewrite ? "suggestion" : "strong";
}

/** The state in words, for the sheet's screen reader text and the review plane. */
export const BULLET_STATE_WORDS: Record<BulletState, string> = {
  suggestion: "Suggestion to review",
  accepted: "Rewrite kept",
  rejected: "Kept yours",
  edited: "Your edit",
  strong: "Already strong",
};

/** "Use the suggested order" lists the sections by their headings: "Education, Experience". */
export function suggestedOrderText(review: ResumeReview): string {
  return orderedSections(review, true)
    .map((s) => s.heading)
    .join(", ");
}
