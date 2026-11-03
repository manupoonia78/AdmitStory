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
// Phase 4 Workspace (screen G). TipTap pieces (DocCanvas) are on `@admitstory/ui/editor` so they
// never reach a route's first load.
export {
  FILE_GROUPS,
  FilesPane,
  fileStatusWord,
  stepFile,
  type FileEntry,
  type FileGroupId,
  type FileStatus,
  type FilesPaneProps,
} from "./files-pane";
export { COACH_TABS, CoachSheet, type CoachSheetProps, type CoachTab } from "./coach-sheet";
export { WhyThisDraft, type WhyThisDraftProps } from "./coach/why-this-draft";
export { OptionsTab, type OptionSummary, type OptionsTabProps } from "./coach/options-tab";
export {
  QUICK_ACTIONS,
  RefineTab,
  type QuickActionId,
  type RefineRequest,
  type RefineTabProps,
} from "./coach/refine-tab";
export {
  CHECK_GROUPS,
  CheckItem,
  CheckList,
  fixLabel,
  type CheckFinding,
  type CheckItemProps,
  type CheckListProps,
  type CheckSeverity,
} from "./coach/checks-tab";
export {
  VerifyItem,
  VerifyList,
  type VerifyEntry,
  type VerifyItemProps,
  type VerifyListProps,
  type VerifyStatus,
} from "./coach/verify-tab";
export { SourceLine, verifiedDate, type PackSource } from "./coach/source-line";
export {
  OptionSplit,
  SPLIT_MAX,
  SPLIT_MIN,
  clampSplit,
  splitForKey,
  type OptionSide,
  type OptionSplitProps,
} from "./option-split";
export { VersionScrubber, type DraftVersion, type VersionScrubberProps } from "./version-scrubber";
export { ExportMenu, copiedMessage, type ExportFormat, type ExportMenuProps } from "./export-menu";
export {
  AUTHORSHIP_ORDER,
  AuthorshipBanner,
  MODE_LABELS,
  modeExplanation,
  stricterModes,
  type AiPolicyStance,
  type AuthorshipBannerProps,
  type AuthorshipMode,
} from "./authorship-banner";
export { NeedComposer, wordsHint, type NeedComposerProps } from "./need-composer";
export { RevisionReview, type RevisionReviewProps } from "./revision-review";
export {
  WorkspaceLayout,
  swipeTarget,
  type WorkspaceLayoutProps,
  type WorkspaceView,
} from "./workspace-layout";
export { countFor, portalText, ruleLabel, type CountRule } from "./portal-text";
export {
  applyDecisions,
  changeText,
  nextPending,
  planRevision,
  revisionMessage,
  type ChangeDecision,
  type DraftPatch,
  type RevisionChange,
  type RevisionPlan,
} from "./revision";
export { useMediaQuery } from "./use-media-query";
