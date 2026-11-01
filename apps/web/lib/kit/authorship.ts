import type { AuthorshipMode, DeliverableType } from "@admitstory/db";

// Authorship per deliverable (spec §14.2, §8.10): the school's verified AI policy decides the
// strictest the kit may be. No verified policy is treated as "unknown" (draft, with the disclosure
// helper); `limited` and `prohibited` coach; video is always talking points, never a script.

export type AiStance =
  "permitted" | "permitted_with_disclosure" | "limited" | "prohibited" | "unknown";

export function authorshipFor(type: DeliverableType, stance: AiStance): AuthorshipMode {
  if (type === "video") return "talking_points";
  if (stance === "limited" || stance === "prohibited") return "coach";
  return "draft";
}

const STRICTNESS: Record<AuthorshipMode, number> = { draft: 0, coach: 1, talking_points: 1 };

/** §14.2: the applicant may choose a stricter mode than the school's policy, never a looser one. */
export function allowedMode(policyMode: AuthorshipMode, wanted: AuthorshipMode): boolean {
  if (policyMode === "talking_points") return wanted === "talking_points";
  return STRICTNESS[wanted] >= STRICTNESS[policyMode] && wanted !== "talking_points";
}

export const DELIVERABLE_TYPE_OF = {
  essay: "essay",
  optional_essay: "essay",
  reapplicant_essay: "essay",
  short_answer: "short_answer",
  goal_field: "goal_field",
  video: "video",
  form_section: "form_section",
  recommendation_question: "lor_question",
  interview_question: "interview_question",
} as const satisfies Record<string, DeliverableType>;
