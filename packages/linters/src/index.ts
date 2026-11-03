// Deterministic draft checks, provenance, the AI-tell index (spec §8.7, §8.8), cross-document
// consistency and the résumé layout (§5.10). Pure functions with no runtime dependencies, safe to
// import in the browser.

export * from "./types";
export {
  count,
  countAfterNormalize,
  countChars,
  countWords,
  graphemes,
  limitStatus,
  normalizeForPortal,
  unitLabel,
  type LimitStatus,
} from "./count";
export { draftText, paragraphText } from "./text";
export {
  bannedPhrases,
  constructions,
  CONTEXT_MAX_SHARE,
  contextRatio,
  countDashes,
  countTriplets,
  dashDensity,
  endingSummary,
  firstActionIndex,
  formatting,
  jargon,
  openingThesis,
  rhythm,
  RHYTHM_MIN_CV,
  sentenceLengthCV,
  tripletDensity,
  weHiding,
} from "./linters/style";
export {
  limit,
  LIMIT_UNDER_SHARE,
  lineReuse,
  LOR_OVERLAP_THRESHOLD,
  lorOverlap,
  NGRAM,
  ngrams,
  promptParts,
  storyReuse,
} from "./linters/file";
export { factMismatch, isValidPackSource, unverifiedSchool } from "./linters/truth";
export { BANNED_PHRASES, JARGON_ACRONYMS, type BannedPhrase } from "./phrases";
export { extractQuantities, type Quantity } from "./quantities";
export { findSchoolTerms, type SchoolTermMatch } from "./school-terms";
export {
  checkProvenance,
  DEFAULT_FIDELITY_TARGET,
  peopleNamed,
  scanClaims,
  VOICE_FIDELITY_TARGETS,
  voiceFidelity,
  voiceFidelityFinding,
  type AmbiguousClaim,
  type Claim,
  type ClaimKind,
  type ClaimScan,
  type FidelityRange,
  type ProvenanceResult,
  type VerifyItem,
  type VoiceFidelity,
} from "./provenance";
export {
  AI_TELL_LABELS,
  AI_TELL_NOTE,
  AI_TELL_THRESHOLDS,
  aiTellIndex,
  type AiTellIndex,
  type AiTellReason,
  type AiTellVerdict,
} from "./ai-tell";
export {
  affectedLinters,
  groupBySeverity,
  LINTERS,
  runAffectedLinters,
  runLinters,
  SEVERITY_LABELS,
  severityCounts,
  sortFindings,
  type ChangeInfo,
  type Linter,
} from "./run";
export {
  bulletText,
  estimatePages,
  fillPlaceholders,
  orderedSections,
  overflowIndex,
  placeholdersIn,
  RESUME_LAYOUT,
  resumeLines,
  type ResumeLine,
} from "./resume";
export {
  CONSISTENCY_SUBJECTS,
  type ConsistencyDoc,
  type ConsistencyDocKind,
  type ConsistencyFinding,
  type ConsistencyInput,
  type ConsistencyRole,
  type ConsistencySegment,
  type ConsistencySubject,
  type ConsistencyValue,
} from "./consistency/types";
export { checkConsistency } from "./consistency/check";
export { fitToLimit, type FitResult } from "./fit";
