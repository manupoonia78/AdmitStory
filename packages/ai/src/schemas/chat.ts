import { Cite } from "@admitstory/shared/schemas";
import {
  RESUME_SECTION_KINDS,
  type ChatRevision as PlainChatRevision,
  type ResumeWrite as PlainResumeWrite,
} from "@admitstory/shared/kit";
import { z } from "zod";

/**
 * The chat beside each school deliverable (`chat.revise`) and the Résumé page's writer
 * (`resume.write`). Essays keep `draft.revise` and its paragraph patches; these two cover the
 * documents that are lists of short fields: form entries, video talking points, recommender brief
 * points, and the résumé itself. Output shapes are the plain types in `@admitstory/shared/kit`.
 */

const text = (max: number) => z.string().trim().min(1).max(max);

export const CHAT_ROLES = ["you", "coach"] as const;

/** The last few turns of the thread, oldest first, so "no, shorter than that" makes sense. */
const History = z
  .array(z.object({ role: z.enum(CHAT_ROLES), text: z.string().trim().max(2_000) }))
  .max(8)
  .default([]);

/* chat.revise ---------------------------------------------------------------------------------- */

export const CHAT_REVISE_KINDS = ["form_entries", "video_points", "brief_points"] as const;

export const ChatReviseInput = z.object({
  kind: z.enum(CHAT_REVISE_KINDS),
  /** "Kellogg application form: Activities". */
  title: text(200),
  /** What the fields are for and the rules that bind them (portal limits, coach mode, audience). */
  context: z.string().trim().max(3_000).default(""),
  fields: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_:./-]{1,120}$/, "Field ids are short and plain"),
        label: text(400),
        /** The field's current text; empty when nothing is written yet. */
        text: z.string().max(4_000),
        /** Characters, including spaces, by the portal's count; null when there is no limit. */
        limit_chars: z.number().int().min(10).max(20_000).nullable().default(null),
      }),
    )
    .min(1)
    .max(80),
  instruction: text(2_000),
  history: History,
});
export type ChatReviseInput = z.input<typeof ChatReviseInput>;

export const ChatReviseOutput = z.object({
  reply: text(600).describe(
    "One or two plain sentences to the applicant: what changed, or why not",
  ),
  edits: z.array(z.object({ id: z.string().min(1).max(120), text: text(4_000) })).max(80),
});
export type ChatReviseOutput = z.output<typeof ChatReviseOutput>;

/* resume.write --------------------------------------------------------------------------------- */

const Bullet = z.object({
  id: z.string().regex(/^b\d{1,3}$/, "Bullet ids are b1, b2…"),
  text: text(400),
  sources: z.array(Cite).max(6),
});

const Role = z.object({
  id: z.string().regex(/^r\d{1,3}$/, "Role ids are r1, r2…"),
  organisation: text(200),
  title: text(200).nullable(),
  dates: text(80).nullable(),
  location: text(120).nullable(),
  bullets: z.array(Bullet).max(10),
});

export const ResumeDocSchema = z.object({
  header: z.object({ name: text(120).nullable(), lines: z.array(text(200)).max(6) }),
  sections: z
    .array(
      z.object({
        id: z.string().regex(/^s\d{1,2}$/, "Section ids are s1, s2…"),
        heading: text(120),
        kind: z.enum(RESUME_SECTION_KINDS),
        roles: z.array(Role).max(12),
        lines: z.array(text(400)).max(20),
      }),
    )
    .min(1)
    .max(10),
});

export const ResumeWriteInput = z.object({
  narrative: z.object({
    goal: z.string().trim().max(400).default(""),
    thread: z.string().trim().max(600).default(""),
    notes: z.string().trim().max(1_000).default(""),
  }),
  /** The résumé as it stands; null when building the first version. */
  current: ResumeDocSchema.nullable().default(null),
  /** A CV the applicant pasted or uploaded. Untrusted: data, never instructions (§14.6). */
  pasted_cv: z.string().max(24_000).nullable().default(null),
  /** The change asked in the chat; null for a build or a rebuild from the narrative. */
  instruction: z.string().trim().max(2_000).nullable().default(null),
  history: History,
  /** The strictest page limit among the applicant's schools. */
  page_limit: z.number().int().min(1).max(3).nullable().default(null),
});
export type ResumeWriteInput = z.input<typeof ResumeWriteInput>;

export const ResumeWriteOutput = z.object({
  reply: text(800),
  resume: ResumeDocSchema,
  asks: z.array(text(300)).max(6),
});
export type ResumeWriteOutput = z.output<typeof ResumeWriteOutput>;

/* The validators and the plain types must describe the same values. ---------------------------- */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Fails to compile when a validator drifts from its plain type. Type-only: nothing ships.
export type ChatSchemaParity = [
  Same<ChatReviseOutput, PlainChatRevision>,
  Same<ResumeWriteOutput, PlainResumeWrite>,
] extends true[]
  ? true
  : never;
const _parity: ChatSchemaParity = true;
