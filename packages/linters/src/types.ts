// Plain input and output types for the linters (spec §8.7, §8.8, Appendix I). Deliberately plain
// TS with no Zod and no workspace imports: the Workspace runs these checks in the browser on
// every keystroke-debounced edit, and the kit pipeline runs them on the server, so this package
// must stay dependency-free (see the JS budget rule in docs/phase-2.md).

/* Drafts ------------------------------------------------------------------------------------- */

export type SentenceKind = "verbatim" | "adapted" | "composed";

export interface DraftSentence {
  text: string;
  kind: SentenceKind;
  /** Provenance codes: F## facts, S## stories, L### golden lines, P# people, C# conversations, K## pack items. */
  sources: string[];
}

export interface DraftParagraph {
  /** Stable across versions (§8.6), so findings and patches can address it. */
  id: string;
  sentences: DraftSentence[];
}

export interface DraftDoc {
  paragraphs: DraftParagraph[];
}

/* Findings (Appendix I `Finding`, the Critic's shape) --------------------------------------- */

export type Severity = "must" | "should" | "consider";

export interface FindingLocation {
  paragraph_id: string | null;
  /** Zero-based index into the paragraph's sentences; null for a paragraph- or draft-level finding. */
  sentence: number | null;
}

/** Appendix I `Patch`: a paragraph-scoped edit the Workspace can offer as a one-click fix. */
export interface Patch {
  op: "replace" | "insert_after" | "delete";
  paragraph_id: string;
  sentences: DraftSentence[] | null;
}

export interface Finding {
  rule_id: RuleId;
  severity: Severity;
  location: FindingLocation;
  /** One plain sentence in the §6.9 voice. */
  explanation: string;
  fix_hint: string | null;
  /** Present only when the fix is mechanical and safe to apply without review of meaning. */
  patch?: Patch;
}

export const RULE_IDS = [
  // §8.8
  "limit",
  "bannedPhrases",
  "openingThesis",
  "endingSummary",
  "weHiding",
  "tripletDensity",
  "rhythm",
  "dashDensity",
  "contextRatio",
  "storyReuse",
  "lineReuse",
  "lorOverlap",
  "factMismatch",
  "unverifiedSchool",
  "promptParts",
  "jargon",
  // Appendix A13 TELL-02 and TELL-03, which the §8.8 table leaves implicit
  "constructions",
  "formatting",
  // §8.7 provenance
  "unsupportedClaim",
  "unsourcedOwnWords",
  "personNamed",
  "voiceFidelity",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/* Context ------------------------------------------------------------------------------------ */

export type LimitKind = "words" | "chars_incl_spaces" | "chars_excl_spaces";

/** The pack's counting rule for one prompt (§9.2 `limit`). */
export interface LimitRule {
  kind: LimitKind;
  value: number;
}

/** A Fact Sheet entry as the compact dossier carries it (§5.3a). */
export interface FactRef {
  code: string;
  key: string;
  value: string;
  approvedPhrasing: string | null;
}

/** A cited school-pack item (§9.2 leaf `Item`). */
export interface PackItemRef {
  code: string;
  /** ISO date; null when the item has never been verified. */
  verifiedAt: string | null;
  cycle: string;
}

export interface PersonRef {
  code: string;
  name: string;
  /** "my manager" — what the draft says instead of the name when mayName is false. */
  role: string;
  mayName: boolean;
}

export interface OtherDeliverable {
  key: string;
  /** Shown in explanations: "Essay 1". Falls back to the key. */
  label?: string;
  primaryStory: string | null;
  plainText: string;
}

/** A recommender brief talking point (§5.11), for lorOverlap. */
export interface BriefBullet {
  story: string | null;
  text: string;
}

/** Where this draft sits in the school's file. Only ever this school's deliverables (§8.8 lineReuse). */
export interface DeliverableContext {
  key: string;
  label?: string;
  primaryStory: string | null;
  otherDeliverables: OtherDeliverable[];
  /** Application form field answers for the same school. */
  formFields: string[];
  briefBullets?: BriefBullet[];
}

export interface PromptPartsInput {
  /** Each sub-question of the prompt (§9.2 `parts`). */
  parts: string[];
  /** The Writer's `prompt_parts_answered` (Appendix I). */
  answered: { part: string; paragraph_ids: string[] }[];
}

/** Prompt archetype ids from Appendix A8, mirrored from @admitstory/shared's ARCHETYPE_IDS. */
export type PromptType =
  | "GOALS"
  | "WHY-SCHOOL"
  | "LEADERSHIP"
  | "SETBACK"
  | "IDENTITY"
  | "SUPPORT"
  | "CONTRIBUTION"
  | "VALUES"
  | "OPTIONAL"
  | "CONTEXT"
  | "REAPPLICANT"
  | "LIST"
  | "MICRO"
  | "GOALBOX"
  | "VIDEO"
  | "SCHOLARSHIP";

/** Text similarity in [0, 1]. Embeddings live in packages/ai; the caller pre-embeds and injects cosine. */
export type SimilarityFn = (a: string, b: string) => number;

export interface LintContext {
  limit?: LimitRule | null;
  facts?: FactRef[];
  packItems?: PackItemRef[];
  /** "2026-27". A K source is valid only when its item is verified and belongs to this cycle. */
  currentCycle?: string;
  people?: PersonRef[];
  deliverable?: DeliverableContext;
  promptParts?: PromptPartsInput | null;
  promptType?: PromptType | null;
  /** The Critic's tag for the first sentence where the story starts moving (§8.8 contextRatio). */
  firstActionSentence?: { paragraph_id: string; sentence: number } | null;
  /** Names from the pack (courses, professors, clubs, centres, treks, events) for unverifiedSchool. */
  schoolTerms?: string[];
  /** Extra domain acronyms for jargon, on top of the built-in list. */
  jargonTerms?: string[];
  /** Injected for lorOverlap; without it lorOverlap does nothing. */
  similarity?: SimilarityFn;
}
