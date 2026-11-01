import {
  Angle,
  ArchetypeId,
  CoachBeats,
  CriticReport,
  Draft,
  FileMap,
  FileMapItem,
  Finding,
  Gap,
  Paragraph,
  Patch,
  RevisionResult,
  Shortform,
  TraitId,
} from "@admitstory/shared/schemas";
import { isCode } from "@admitstory/shared";
import { z } from "zod";
import { DELIVERABLE_KINDS } from "./kit-positioning";
import { RetrievalChunks } from "./retrieval";

/**
 * The kit pipeline's writing agents (spec §5.7 stages 4–8, §8.5.6–8.5.11, §8.6) and the Workspace's
 * revision calls. Every one reads the compiled pack (L1) and the compact dossier (L2) from the
 * cached prefix; the input carries only what is specific to the call. Output shapes are Appendix I
 * (shared); the rules a JSON Schema cannot express are checked in code (tasks/kit-writing.ts).
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const key = text(80);
const paragraphId = text(20);
const StoryCode = z.string().refine((v) => isCode(v, "story"), "Not a story code (S##)");

/** The pack's counting rule for one prompt (§9.2 `limit`); the linters count with it. */
export const LIMIT_KINDS = ["words", "chars_incl_spaces", "chars_excl_spaces"] as const;
export const LimitRule = z.object({
  kind: z.enum(LIMIT_KINDS),
  value: z.number().int().min(1).max(20_000),
});
export type LimitRule = z.output<typeof LimitRule>;

/** One deliverable as the writers see it: the prompt verbatim, its parts and its counting rule. */
export const WritingDeliverable = z.object({
  key,
  kind: z.enum(DELIVERABLE_KINDS),
  prompt: text(4_000),
  /** The prompt's sub-questions (§9.2 `parts`); every one must be answered. */
  parts: z.array(text(400)).max(8).default([]),
  limit: LimitRule.nullable(),
  /** A list-style prompt's N ("8 things about you"); the limit then applies to each item. */
  list_items: z.number().int().min(2).max(15).nullable().default(null),
  archetypes: z.array(ArchetypeId).max(4).default([]),
  /** The pack item that holds this prompt, for citations ("K09"). */
  pack_code: z
    .string()
    .refine((v) => isCode(v, "pack"), "Not a pack code (K##)")
    .nullable()
    .default(null),
});
export type WritingDeliverable = z.input<typeof WritingDeliverable>;

/** Another deliverable in the same school's file, for the no-repeat rules (§8.5.5, §8.8). */
export const OtherDeliverable = z.object({
  key,
  primary_story: StoryCode.nullable(),
  first_line: text(600).nullable(),
  last_line: text(600).nullable(),
});

const uniqueKeys = <T extends { key: string }>(items: T[]) =>
  new Set(items.map((d) => d.key)).size === items.length;

/* kit.gaps (§8.5.6) ------------------------------------------------------------------------- */

export const KitGapsInput = z.object({
  deliverables: z
    .array(WritingDeliverable)
    .min(1)
    .max(40)
    .refine(uniqueKeys, "Deliverable keys must be unique"),
  file_map: FileMap,
});
export type KitGapsInput = z.input<typeof KitGapsInput>;

export const KitGapsOutput = z.object({ gaps: z.array(Gap).max(24) });
export type KitGapsOutput = z.output<typeof KitGapsOutput>;

/* kit.angles (§8.5.7) ----------------------------------------------------------------------- */

export const KitAnglesInput = z.object({
  /** Every long essay of the school, all in one call (§8.3). */
  essays: z.array(WritingDeliverable).min(1).max(8).refine(uniqueKeys, "Essay keys must be unique"),
  file_map: FileMap,
  /** The Strategist's lead traits for this school. */
  lead_traits: z.array(TraitId).max(3).default([]),
});
export type KitAnglesInput = z.input<typeof KitAnglesInput>;

export const KitAnglesOutput = z.object({
  angles: z.array(Angle).max(24),
  /** "If only one strong angle exists, say so": one entry per essay that has a single angle. */
  single_angle: z.array(z.object({ deliverable_key: key, reason: text(600) })).max(8),
});
export type KitAnglesOutput = z.output<typeof KitAnglesOutput>;

/* kit.draft (§8.5.8, §8.10) ----------------------------------------------------------------- */

/** §8.10: `draft` writes prose with provenance; `coach` returns beats, the applicant's lines and questions. */
export const DRAFT_MODES = ["draft", "coach"] as const;
export type DraftMode = (typeof DRAFT_MODES)[number];

export const KitDraftInput = z.object({
  mode: z.enum(DRAFT_MODES),
  deliverable: WritingDeliverable,
  angle: Angle,
  file_map_item: FileMapItem,
  other_deliverables: z.array(OtherDeliverable).max(40).default([]),
  /** Long-tail school material, only for why-school paragraphs (§8.9). */
  retrieval: RetrievalChunks,
});
export type KitDraftInput = z.input<typeof KitDraftInput>;

/** Exactly one of the two is set, matching the input's mode (checked in code). */
export const KitDraftOutput = z.object({
  draft: Draft.nullable(),
  coach: CoachBeats.nullable(),
});
export type KitDraftOutput = z.output<typeof KitDraftOutput>;

/* kit.shortform (§8.5.9, §5.9) -------------------------------------------------------------- */

export const KitShortformInput = z.object({
  /** Every short item of the school: goal fields, short answers, list prompts, video. */
  items: z.array(WritingDeliverable).min(1).max(20).refine(uniqueKeys, "Item keys must be unique"),
  file_map: FileMap,
  /** Lines already used in the long essays; no short item may repeat one (§5.9). */
  essay_lines: z.array(text(1_200)).max(80).default([]),
  retrieval: RetrievalChunks,
});
export type KitShortformInput = z.input<typeof KitShortformInput>;

export const KitShortformOutput = Shortform;
export type KitShortformOutput = z.output<typeof KitShortformOutput>;

/* kit.critic (§8.5.10) ---------------------------------------------------------------------- */

/** A linter finding as the Critic receives it (packages/linters, same shape as Appendix I). */
export const LinterFinding = Finding.extend({ rule_id: text(40) });

export const KitCriticInput = z.object({
  deliverable: WritingDeliverable,
  draft: Draft,
  file_map_item: FileMapItem,
  other_deliverables: z.array(OtherDeliverable).max(40).default([]),
  linter_findings: z.array(LinterFinding).max(80).default([]),
});
export type KitCriticInput = z.input<typeof KitCriticInput>;

/** Appendix I's Finding plus §8.5.10's optional safe mechanical patch (cuts only). */
export const CriticFinding = Finding.extend({ patch: Patch.nullable() });

export const KitCriticOutput = CriticReport.extend({
  findings: z.array(CriticFinding).max(40),
  /**
   * The first sentence where the story starts moving (§8.8 contextRatio): the linters need the
   * Critic's tag. Null when no sentence does.
   */
  first_action: z
    .object({ paragraph_id: paragraphId, sentence: z.number().int().min(0) })
    .nullable(),
});
export type KitCriticOutput = z.output<typeof KitCriticOutput>;

/* draft.revise (§8.6) ----------------------------------------------------------------------- */

const DraftParagraphs = z.object({ paragraphs: z.array(Paragraph).min(1).max(30) });

export const DraftReviseInput = z
  .object({
    instruction: text(2_000),
    /** Chosen by the user, or by util.classify. */
    target_paragraph_ids: z.array(paragraphId).min(1).max(30),
    /** The whole draft, for coherence (cheap). */
    draft: DraftParagraphs,
    /** Paragraph lock (`L`, §5.8): never patched. */
    locked_paragraph_ids: z.array(paragraphId).max(30).default([]),
    /** Paragraphs the user edited by hand: the AI never overwrites them (§5.8). */
    user_edited_paragraph_ids: z.array(paragraphId).max(30).default([]),
    /** Only the dossier items this revision needs (§8.6), as compact-dossier lines. */
    dossier_items: z.string().max(12_000).default(""),
    limit: LimitRule.nullable().default(null),
    /** The limit loop (§8.6): cut about this many words from these paragraphs. */
    cut: z
      .object({
        words: z.number().int().min(1).max(2_000),
        paragraph_ids: z.array(paragraphId).min(1),
      })
      .nullable()
      .default(null),
  })
  .refine(
    (input) => {
      const ids = new Set(input.draft.paragraphs.map((p) => p.id));
      return input.target_paragraph_ids.every((id) => ids.has(id));
    },
    { message: "Every target paragraph must be in the draft", path: ["target_paragraph_ids"] },
  );
export type DraftReviseInput = z.input<typeof DraftReviseInput>;

export const DraftReviseOutput = RevisionResult;
export type DraftReviseOutput = z.output<typeof DraftReviseOutput>;

/* draft.need_fill (§5.8 NEED chips) --------------------------------------------------------- */

export const DraftNeedFillInput = z.object({
  paragraph: Paragraph,
  /** The neighbouring paragraphs' text, for the joins. */
  before: text(4_000).nullable().default(null),
  after: text(4_000).nullable().default(null),
  need: z.object({ question: text(400), approx_words: z.number().int().min(1).max(400) }),
  /** The applicant's answer, already saved to the dossier under `code` (an F, C or L code). */
  answer: z.object({
    text: text(4_000),
    code: z
      .string()
      .refine((v) => isCode(v, "fact") || isCode(v, "conversation") || isCode(v, "line"), {
        message: "The saved answer's code (F##, C# or L###)",
      }),
  }),
  limit_words: z.number().int().min(1).max(2_000).nullable().default(null),
});
export type DraftNeedFillInput = z.input<typeof DraftNeedFillInput>;

export const DraftNeedFillOutput = z.object({ paragraph: Paragraph, summary: text(400) });
export type DraftNeedFillOutput = z.output<typeof DraftNeedFillOutput>;

/* util.classify (§8.6 target paragraphs) ---------------------------------------------------- */

export const UtilClassifyInput = z.object({
  instruction: text(2_000),
  paragraphs: z
    .array(z.object({ id: paragraphId, text: text(6_000), locked: z.boolean().default(false) }))
    .min(1)
    .max(30),
});
export type UtilClassifyInput = z.input<typeof UtilClassifyInput>;

export const UtilClassifyOutput = z.object({
  /** The paragraphs the instruction is about; empty only when it is about the whole draft. */
  paragraph_ids: z.array(paragraphId).max(30),
  /** True for "rewrite from scratch"-style requests, which go to the Writer (§8.6). */
  whole_draft: z.boolean(),
  reason: text(300),
});
export type UtilClassifyOutput = z.output<typeof UtilClassifyOutput>;
