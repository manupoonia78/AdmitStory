// Workspace components: the your-words glow, diff morph and streaming text (spec §5.8, §6.6,
// §6.7). Owned by the Kit agent. Built for the Phase 0.5 prototype and reused in Phase 4.

export type {
  DraftNeed,
  DraftParagraph,
  DraftSentence,
  SentenceKind,
  SourceExcerpt,
  SourceExcerpts,
} from "./types";
export {
  countCharacters,
  countWords,
  splitSentences,
  streamedSentences,
  type StreamedSentences,
} from "./sentences";
export {
  diffRuns,
  diffSide,
  diffWords,
  tokenizeWords,
  type DiffKind,
  type DiffRun,
  type DiffToken,
} from "./diff";
export { draftText, isOwnWords, ownWordsShare, paragraphText } from "./provenance";
export { isPlainKey, isTypingTarget, usePlainKey } from "./shortcuts";
export { StreamingText, type StreamingTextProps } from "./streaming-text";
export { LimitCounter, overLimit, type LimitCounterProps, type LimitUnit } from "./limit-counter";
export { NeedChip, type NeedChipProps } from "./need-chip";
export {
  YourWordsLegend,
  YourWordsToggle,
  type YourWordsLegendProps,
  type YourWordsToggleProps,
} from "./your-words-controls";
export { YourWordsText, type YourWordsTextProps } from "./your-words-text";
export { DiffMorph, type DiffMorphProps, type MorphDecision } from "./diff-morph";
export { RevisionBar, type RevisionBarProps } from "./revision-bar";
