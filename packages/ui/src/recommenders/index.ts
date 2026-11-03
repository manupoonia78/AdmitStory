// Screen H, the Recommender Kit's applicant side (spec §5.11, §6.10 H). Phase 6, package C.
// Design direction: docs/design/phase-6-direction.md.
//
// CoverageBoard is the screen's one hero and carries Motion; the route loads the whole screen
// behind a next/dynamic host, as Phase 5 does, so none of this reaches a route's first load.
// Each client component lives in its own file: a "use client" module ships all of its exports.

export {
  RECOMMENDERS_COPY,
  RECOMMENDER_TABS,
  REMINDER_STATE_WORDS,
  STATUS_TONES,
  briefStateWord,
  buildingLine,
  failedLine,
  firstNameOf,
  groupLabel,
  onDate,
  recommenderPrivacyLine,
  rebuildLabel,
  recommenderSchoolLine,
  reminderBlockedReason,
  reminderLabel,
  roleLine,
  staleLine,
  statusWord,
  storyCountHint,
  storyCountLine,
  storyTicks,
  tabFromParam,
  type RecommenderTabId,
  type StateWord,
} from "./recommender-text";
export { RecommenderList, stepRecommender, type RecommenderListProps } from "./recommender-list";
export {
  BriefPlaceholder,
  BriefSheet,
  type BriefPlaceholderProps,
  type BriefSheetProps,
} from "./brief-sheet";
export {
  COVERAGE_EMPTY,
  COVERAGE_LEAD,
  CoverageEssaysList,
  CoverageFindingsList,
  CoveragePlaceholder,
  openFindings,
  traitWords,
  type CoverageFindingsListProps,
} from "./coverage-list";
export {
  CoverageBoard,
  DEAL_STAGGER_S,
  facetMarks,
  hasSeenPlan,
  markPlanSeen,
  type CoverageBoardProps,
  type FacetMark,
} from "./coverage-board";
export {
  StoriesPanel,
  StoryFieldsForm,
  type StoriesPanelProps,
  type StoryRowItem,
} from "./stories-panel";
export { IntakePanel, type IntakeAnswerInput, type IntakePanelProps } from "./intake-panel";
export { NOTE_MAX, StatusPanel, type StatusPanelProps } from "./status-panel";
export {
  RecommenderForm,
  type RecommenderFormProps,
  type RecommenderFormValues,
} from "./recommender-form";
