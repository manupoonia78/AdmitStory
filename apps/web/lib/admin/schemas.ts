import "server-only";

import { z } from "zod";

// Request bodies of the /api/admin routes. The repositories validate again (packages/db); these
// only give a form its field errors and keep unexpected keys out.

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const SchoolDetailsBody = z.strictObject({
  country: nullableText(2),
  city: nullableText(120),
  website: nullableText(500),
});

export const CycleCreateBody = z.strictObject({
  cycle: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Write the cycle like "2026-27".'),
});

export const RoundBody = z.strictObject({
  name: z.string().trim().min(1, "Name the round.").max(40),
  deadline: z.iso.date("Give the deadline as a date.").nullable(),
  decisionDate: z.iso.date().nullable().optional(),
  interviewInvitesWindow: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const CyclePatchBody = z.strictObject({
  status: z.enum(["draft", "live", "archived"]).optional(),
  rounds: z.array(RoundBody).max(12).optional(),
});

const sourceType = z.enum([
  "official",
  "adcom",
  "insider",
  "interview_reports",
  "coach_notes",
  "third_party_reference",
  "press",
]);

/** The fields every source carries (§9.1): school, cycle, type, trust and rights note. */
export const SourceTags = z.strictObject({
  schoolId: z.uuid("Choose a school."),
  cycle: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Write the cycle like "2026-27".')
    .nullable()
    .optional(),
  type: sourceType,
  title: z.string().trim().min(1, "Give the source a title.").max(300),
  trust: z.coerce.number().int().min(1).max(5).optional(),
  rightsNote: nullableText(2000),
});

export const PasteSourceBody = SourceTags.extend({
  mode: z.literal("paste"),
  text: z.string().trim().min(40, "Paste at least a few sentences.").max(2_000_000),
});

export const UrlSourceBody = SourceTags.extend({
  mode: z.literal("url"),
  url: z.url({ protocol: /^https$/, error: "Enter an https:// address." }).max(2000),
});

export const SourceBody = z.discriminatedUnion("mode", [PasteSourceBody, UrlSourceBody]);

export const SourcePatchBody = z.strictObject({
  type: sourceType.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  trust: z.coerce.number().int().min(1).max(5).optional(),
  cycle: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  rightsNote: nullableText(2000),
});

export const ReviewBody = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("accepted"),
    override: z.boolean().optional(),
    reason: z.string().max(2000).optional(),
  }),
  z.strictObject({
    decision: z.literal("edited"),
    edited: z.unknown().refine((value) => value !== undefined, "Give the edited value."),
    override: z.boolean().optional(),
    reason: z.string().max(2000).optional(),
  }),
  z.strictObject({ decision: z.literal("rejected"), reason: z.string().max(2000).optional() }),
]);

export const DraftJsonBody = z.strictObject({ data: z.record(z.string(), z.unknown()) });

export const CanonCreateBody = z.strictObject({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  content: z.string().min(1).max(400_000),
});

export const PromptCreateBody = z.strictObject({
  agent: z
    .string()
    .trim()
    .regex(/^[a-z_]+(\.[a-z_]+)+$/),
  version: z
    .string()
    .trim()
    .regex(/^v[1-9]\d*$/, "Use a version like v3."),
  template: z.string().min(1).max(200_000),
  /** A model key (opus, sonnet, haiku), never a model ID. Empty means the routing table. */
  model: nullableText(20),
});

export const PromptSplitBody = z.strictObject({
  agent: z
    .string()
    .trim()
    .regex(/^[a-z_]+(\.[a-z_]+)+$/),
  split: z
    .array(
      z.strictObject({
        promptVersionId: z.uuid(),
        weight: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(5),
});
