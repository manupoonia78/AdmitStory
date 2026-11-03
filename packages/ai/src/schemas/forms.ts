import { Cite } from "@admitstory/shared/schemas";
import {
  FORM_RECOMMENDATIONS,
  FORM_STRONGER_MAX,
  RESUME_ISSUES,
  RESUME_SECTION_KINDS,
  RESUME_VERDICTS,
  type FormAdvice as PlainFormAdvice,
  type ResumeReview as PlainResumeReview,
} from "@admitstory/shared/kit";
import { z } from "zod";
import { LimitRule } from "./kit-writing";

/**
 * The Form Advisor (`forms.advise`) and the Résumé Reviewer (`resume.review`), spec §5.10 and
 * §8.5.12. Output shapes are the plain types in `@admitstory/shared/kit` (forms.ts); the rules a
 * JSON Schema cannot express (limits by the portal's counting rule, item counts, verbatim
 * originals, no new numbers) are checked in code (tasks/forms.ts).
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const key = text(80);
const itemId = z.string().regex(/^i\d{1,3}$/, "Item ids are i1, i2…");
const Need = z.object({
  question: text(400),
  approx_words: z.number().int().min(1).max(200),
});

/* forms.advise (§5.10 Form Advisor, canon A9) -------------------------------------------------- */

export const FORM_MODES = ["draft", "coach"] as const;

export const FormsAdviseInput = z.object({
  /** §14.2 via the school's essay authorship mode: coach writes no entries (Phase 5 decision). */
  mode: z.enum(FORM_MODES),
  sections: z
    .array(
      z.object({
        key,
        label: text(200),
        /** The field's limit by the portal's counting rule; null when the pack gives none. */
        limit: LimitRule.nullable(),
        item_count_max: z.number().int().min(1).max(30).nullable(),
      }),
    )
    .min(1)
    .max(12),
  /** What the essays and short answers already carry, so a form item doesn't repeat them. */
  deliverables: z
    .array(z.object({ key, title: text(120), primary_story: z.string().nullable() }))
    .max(40)
    .default([]),
});
export type FormsAdviseInput = z.input<typeof FormsAdviseInput>;

export const FormItem = z.object({
  id: itemId,
  candidate: text(120),
  cites: z.array(Cite).min(1).max(8),
  recommendation: z.enum(FORM_RECOMMENDATIONS),
  combine_with: itemId.nullable(),
  move_to: key.nullable(),
  reason: text(400).describe("One sentence: the trait or lens it proves, overlap, how it reads"),
  entry: z.object({ text: text(2_000), sources: z.array(Cite).min(1).max(8) }).nullable(),
  stronger: z.array(text(200)).max(FORM_STRONGER_MAX),
  needs: z.array(Need).max(3),
});

export const FormsAdviseOutput = z.object({
  sections: z.array(z.object({ section_key: key, items: z.array(FormItem).max(20) })).max(12),
  could_still_do: z.array(z.object({ text: text(300), why: text(300), time: text(60) })).max(6),
  verify: z.array(z.object({ text: text(600), reason: text(300) })).max(20),
});
export type FormsAdviseOutput = z.output<typeof FormsAdviseOutput>;

/* resume.review (§5.10 Résumé Pass, canon A10) ------------------------------------------------- */

export const ResumeReviewInput = z.object({
  /** The uploaded résumé's extracted text. Untrusted: data, never instructions (§14.6). */
  resume_text: text(24_000),
  /** The strictest page limit among the applicant's schools, for the one-page-fit advice. */
  page_limit: z.number().int().min(1).max(3).nullable().default(null),
});
export type ResumeReviewInput = z.input<typeof ResumeReviewInput>;

const ResumeBullet = z.object({
  id: z.string().regex(/^b\d{1,3}$/, "Bullet ids are b1, b2…"),
  original: text(1_200),
  verdict: z.enum(RESUME_VERDICTS),
  issues: z.array(z.enum(RESUME_ISSUES)).max(5),
  feedback: text(300),
  rewrite: z
    .object({
      text: text(600).describe("A detail only the applicant knows is a placeholder [?1], [?2]…"),
      sources: z.array(Cite).max(6),
      needs: z.array(Need).max(3),
    })
    .nullable(),
});

const ResumeRole = z.object({
  id: z.string().regex(/^r\d{1,3}$/, "Role ids are r1, r2…"),
  organisation: text(200),
  title: text(200).nullable(),
  dates: text(80).nullable(),
  location: text(120).nullable(),
  bullets: z.array(ResumeBullet).max(15),
});

export const ResumeReviewOutput = z.object({
  header: z.object({ name: text(120).nullable(), lines: z.array(text(200)).max(6) }),
  sections: z
    .array(
      z.object({
        id: z.string().regex(/^s\d{1,2}$/, "Section ids are s1, s2…"),
        heading: text(120),
        kind: z.enum(RESUME_SECTION_KINDS),
        roles: z.array(ResumeRole).max(12),
        lines: z.array(text(400)).max(20),
      }),
    )
    .min(1)
    .max(10),
  section_order: z.object({ order: z.array(z.string()).max(10), reason: text(400) }),
  priorities: z.array(text(300)).min(1).max(3),
});
export type ResumeReviewOutput = z.output<typeof ResumeReviewOutput>;

/* The validators and the plain types must describe the same values. ---------------------------- */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Fails to compile when a validator drifts from its plain type. Type-only: nothing ships.
export type FormsSchemaParity = [
  Same<FormsAdviseOutput, PlainFormAdvice>,
  Same<ResumeReviewOutput, PlainResumeReview>,
] extends true[]
  ? true
  : never;
const _parity: FormsSchemaParity = true;
