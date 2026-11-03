// What a school's application asks for, as the Strategist's deliverable list (spec §8.5.5) and as
// the kit preview's locked rows (§5.5). Pure: read from a published pack.

import type { SchoolPack } from "@admitstory/kb/types";
import type { ArchetypeId } from "@admitstory/shared";
import { limitText, writtenPrompts } from "./pack";

export type DeliverableKind =
  | "essay"
  | "short_answer"
  | "goal_field"
  | "video"
  | "optional_essay"
  | "reapplicant_essay"
  | "form_section"
  | "recommendation_question"
  | "interview_question";

export interface PackDeliverable {
  key: string;
  kind: DeliverableKind;
  prompt: string;
  limit: string | null;
  required: boolean;
  /** "Essay 1", "Short answer 2", "Video essay". */
  title: string;
  /** Drafted by the kit (shown locked in the preview), rather than planned only. */
  drafted: boolean;
  /** The portal's counting rule, for the writers and the live count (§5.8). */
  rule?: { kind: "words" | "chars_incl_spaces" | "chars_excl_spaces"; value: number } | null;
  parts?: string[];
  archetypes?: ArchetypeId[];
  /** A list prompt's N ("8 things about you"). */
  listCount?: number;
}

/** The Strategist takes at most 40 deliverables (KitPositioningInput). */
const MAX_DELIVERABLES = 40;

export function packDeliverables(pack: SchoolPack, isReapplicant: boolean): PackDeliverable[] {
  const out: PackDeliverable[] = [];
  const verified = new Set(writtenPrompts(pack).map((p) => p.id));
  const used = new Set<string>();
  const key = (raw: string) => {
    let candidate = raw.slice(0, 70);
    for (let n = 2; used.has(candidate); n += 1) candidate = `${raw.slice(0, 66)}-${n}`;
    used.add(candidate);
    return candidate;
  };

  const app = pack.application;
  const written = [
    { list: app.essays, kind: "essay" as const, name: "Essay" },
    { list: app.short_answers, kind: "short_answer" as const, name: "Short answer" },
    { list: app.goal_fields, kind: "goal_field" as const, name: "Goals field" },
  ];
  for (const { list, kind, name } of written)
    list
      .filter((p) => verified.has(p.id) && p.prompt_verbatim)
      .forEach((p, index, all) =>
        out.push({
          key: key(p.key),
          kind,
          prompt: p.prompt_verbatim ?? "",
          limit: limitText(p.limit, p.list_count),
          required: p.required,
          title: all.length === 1 ? name : `${name} ${index + 1}`,
          drafted: true,
          rule: p.limit,
          parts: p.parts,
          archetypes: p.archetypes,
          ...(p.list_count ? { listCount: p.list_count } : {}),
        }),
      );

  const optional = app.optional_essay;
  if (optional?.verified_at && optional.prompt_verbatim)
    out.push({
      key: key("optional"),
      kind: "optional_essay",
      prompt: optional.prompt_verbatim,
      limit: limitText(optional.limit),
      required: false,
      title: "Optional essay",
      drafted: true,
      rule: optional.limit,
      parts: optional.parts,
      archetypes: optional.archetypes,
    });

  const reapp = app.reapplicant?.essay;
  if (isReapplicant && reapp?.verified_at && reapp.prompt_verbatim)
    out.push({
      key: key("reapplicant"),
      kind: "reapplicant_essay",
      prompt: reapp.prompt_verbatim,
      limit: limitText(reapp.limit),
      required: true,
      title: "Reapplicant essay",
      drafted: true,
      rule: reapp.limit,
      parts: reapp.parts,
      archetypes: reapp.archetypes,
    });

  app.video
    .filter((v) => v.verified_at && v.format !== "none")
    .forEach((v, index, all) =>
      out.push({
        key: key(`video-${index + 1}`),
        kind: "video",
        prompt:
          v.question_types.map((q) => q.text).join(" ") ||
          "Recorded video answers to questions shown on screen.",
        limit: v.answer_time_s ? `${v.answer_time_s} seconds` : null,
        required: true,
        title: all.length === 1 ? "Video essay" : `Video essay ${index + 1}`,
        drafted: true,
      }),
    );

  for (const section of app.form_sections.filter((s) => s.verified_at))
    out.push({
      key: key(`form-${section.key}`),
      kind: "form_section",
      prompt: section.label,
      limit: section.char_limit ? `${section.char_limit} characters` : null,
      required: true,
      title: `Form: ${section.label}`,
      drafted: false,
    });

  const recs = app.recommendations;
  if (recs?.verified_at)
    recs.questions.forEach((q, index) =>
      out.push({
        key: key(`recommendation-${index + 1}`),
        kind: "recommendation_question",
        prompt: q.text_verbatim,
        limit: q.limit ? limitText(q.limit) : null,
        required: true,
        title: `Recommender question ${index + 1}`,
        drafted: false,
      }),
    );

  const questions = [...(pack.interview?.common_questions ?? [])]
    .filter((q) => q.verified_at)
    .sort((a, b) => b.frequency_weight - a.frequency_weight)
    .slice(0, 3);
  questions.forEach((q, index) =>
    out.push({
      key: key(`interview-${index + 1}`),
      kind: "interview_question",
      prompt: q.text,
      limit: null,
      required: false,
      title: `Interview question ${index + 1}`,
      drafted: false,
    }),
  );

  return out.slice(0, MAX_DELIVERABLES);
}
