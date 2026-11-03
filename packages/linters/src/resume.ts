// The Résumé Pass's pure helpers (spec §5.10, canon RES-01): the text a bullet ends up with after
// the applicant's decision, the section order, and a one-page-fit estimate. Shared by the live
// sheet in the browser and the DOCX export on the server, so the hairline on screen and the
// exported file agree.

import type {
  BulletDecision,
  ResumeBullet,
  ResumeReview,
  ResumeSection,
} from "@admitstory/shared/kit";

const PLACEHOLDER = /\[\?(\d{1,2})\]/g;

/** A rewrite with the applicant's answers in its `[?n]` placeholders; null while any is open. */
export function fillPlaceholders(text: string, answers: readonly string[]): string | null {
  let open = false;
  const filled = text.replace(PLACEHOLDER, (_, n: string) => {
    const answer = answers[Number(n) - 1]?.trim();
    if (!answer) open = true;
    return answer ?? "";
  });
  return open ? null : filled.replace(/\s{2,}/g, " ").trim();
}

/** Placeholders `[?n]` in a rewrite, in order. */
export function placeholdersIn(text: string): number[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
}

/**
 * What the bullet says now: the applicant's own edit, an accepted rewrite (with its placeholders
 * answered), or the original. An accepted rewrite with an unanswered placeholder keeps the
 * original, so nothing half-written is ever exported.
 */
export function bulletText(bullet: ResumeBullet, decision: BulletDecision | undefined): string {
  if (!decision || decision.status === "rejected") return bullet.original;
  if (decision.status === "edited") return decision.text.trim() || bullet.original;
  if (!bullet.rewrite) return bullet.original;
  return fillPlaceholders(bullet.rewrite.text, decision.answers) ?? bullet.original;
}

/** The sections in the suggested order (unknown ids keep their place at the end). */
export function orderedSections(review: ResumeReview, useSuggested = true): ResumeSection[] {
  if (!useSuggested) return review.sections;
  const rank = new Map(review.section_order.order.map((id, i) => [id, i]));
  return [...review.sections].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * Layout constants for the export template: US Letter / A4 at 10.5 pt Calibri-like text with
 * 0.6 in margins holds about 100 characters a line and 54 lines a page. An estimate, labelled as
 * one on screen ("About 1.2 pages").
 */
export const RESUME_LAYOUT = { charsPerLine: 100, linesPerPage: 54, bulletIndent: 4 } as const;

const linesFor = (text: string, indent = 0) =>
  Math.max(1, Math.ceil((text.length + indent) / RESUME_LAYOUT.charsPerLine));

export interface ResumeLine {
  /** "header", a section id, a role id or a bullet id. */
  ref: string;
  kind: "header" | "heading" | "role" | "bullet" | "line";
  text: string;
  /** Printed lines it takes. */
  lines: number;
}

/** The résumé as printed lines, in export order, with each bullet's current text. */
export function resumeLines(
  review: ResumeReview,
  decisions: Readonly<Record<string, BulletDecision>>,
  useSuggestedOrder = true,
): ResumeLine[] {
  const out: ResumeLine[] = [];
  if (review.header.name)
    out.push({ ref: "header", kind: "header", text: review.header.name, lines: 2 });
  if (review.header.lines.length > 0)
    out.push({ ref: "header", kind: "header", text: review.header.lines.join(" | "), lines: 1 });
  for (const section of orderedSections(review, useSuggestedOrder)) {
    // A heading has a rule under it and space above: two lines.
    out.push({ ref: section.id, kind: "heading", text: section.heading, lines: 2 });
    for (const role of section.roles) {
      const head = [role.organisation, role.title, role.dates].filter(Boolean).join(", ");
      out.push({ ref: role.id, kind: "role", text: head, lines: linesFor(head) });
      for (const bullet of role.bullets) {
        const text = bulletText(bullet, decisions[bullet.id]);
        out.push({
          ref: bullet.id,
          kind: "bullet",
          text,
          lines: linesFor(text, RESUME_LAYOUT.bulletIndent),
        });
      }
    }
    for (const line of section.lines)
      out.push({ ref: section.id, kind: "line", text: line, lines: linesFor(line) });
  }
  return out;
}

/** Estimated printed pages, to one decimal ("1.2"). */
export function estimatePages(lines: readonly ResumeLine[]): number {
  const total = lines.reduce((sum, l) => sum + l.lines, 0);
  return Math.round((total / RESUME_LAYOUT.linesPerPage) * 10) / 10;
}

/** The index of the first line that falls past `pages` pages, or -1 when everything fits. */
export function overflowIndex(lines: readonly ResumeLine[], pages: number): number {
  const budget = pages * RESUME_LAYOUT.linesPerPage;
  let used = 0;
  for (let i = 0; i < lines.length; i += 1) {
    used += lines[i]?.lines ?? 0;
    if (used > budget) return i;
  }
  return -1;
}
