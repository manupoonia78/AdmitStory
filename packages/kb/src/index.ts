// School pack schema, compiler, proposals and retrieval (spec §9, §8.9). Server-only: client code
// imports plain types from `@admitstory/kb/types`. Text extraction and URL fetching are on
// `@admitstory/kb/ingest`, so importing this barrel never loads the PDF or DOCX parsers.

export * from "./types";
export {
  AiStance as AiStanceSchema,
  CitedThing as CitedThingSchema,
  EssayPrompt as EssayPromptSchema,
  KbSourceType as KbSourceTypeSchema,
  PackItem as PackItemSchema,
  PackSource as PackSourceSchema,
  SchoolPack as SchoolPackSchema,
  packIntegrityIssues,
  parseSchoolPack,
} from "./schema/school-pack";
export { citedNodes, packIdNumber, type CitedNode } from "./walk";
export {
  CYCLE_OPENS_ON,
  cycleStart,
  isCitableSpecific,
  isStale,
  sectionFreshness,
  type SectionFreshness,
} from "./freshness";
export {
  PACK_TOKEN_TARGET,
  citableSpecificIds,
  compilePack,
  type CompilePackOptions,
  type CompiledPack,
  type ExclusionReason,
  type PackIndexEntry,
} from "./compiler";
export {
  FieldPathError,
  formatFieldPath,
  locate,
  parseFieldPath,
  pathPattern,
  type Located,
  type PathSegment,
} from "./paths";
export {
  ITEM_PATTERNS,
  RECORD_PATTERNS,
  applyProposals,
  detectConflicts,
  nextPackId,
  packHighWater,
  sameContent,
  type AcceptedProposal,
  type AppliedProposal,
  type ApplyOptions,
  type ApplyResult,
  type BlockReason,
  type BlockedProposal,
  type ConflictCandidate,
  type FieldConflict,
  type PackProposal,
  type SourceSpan,
} from "./proposals";
export { publishBlockers, type PublishBlocker } from "./publish";
export {
  DEFAULT_SOURCE_TYPES,
  RETRIEVAL_DEFAULTS,
  RRF_K,
  chunkForCode,
  formatRetrieved,
  hybridSearch,
  isRetrievalCode,
  matchesFilters,
  reciprocalRankFusion,
  retrievalCode,
  storeFilters,
  type HybridSearchOptions,
  type RetrievalResult,
  type RetrievedChunk,
} from "./retrieval";
