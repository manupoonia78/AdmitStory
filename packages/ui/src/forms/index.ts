// Phase 5: the Form Advisor, the Résumé Pass and the consistency check (spec §5.10). FormAdvisor
// and ResumeSheet carry Motion: routes load them with next/dynamic behind a host module, as the
// Workspace does. ConsistencyList and the text helpers are server-safe.

export {
  CONSISTENCY_EMPTY,
  ConsistencyList,
  canUseExpected,
  differs,
  referenceValue,
  type ConsistencyListProps,
} from "./consistency-list";
export {
  COACH_POLICY_NOTE,
  copiedEntryMessage,
  entryCount,
  entryTally,
  formLanes,
  isEntryLane,
  limitDescription,
  limitKind,
  overCountNote,
  type FormLane,
} from "./form-text";
export {
  FormItemView,
  NeedTag,
  type FormAdvisorItem,
  type FormAdvisorMode,
  type FormCitation,
  type FormItemViewProps,
} from "./form-item";
export {
  FormAdvisor,
  type FormAdvisorProps,
  type FormAdvisorSection,
  type FormGuidance,
} from "./form-advisor";
export {
  BULLET_STATE_WORDS,
  bulletState,
  bulletsInOrder,
  formatPages,
  limitAsk,
  nextUndecided,
  pageSummary,
  stepBullet,
  suggestedOrderText,
  type BulletState,
  type PageSummary,
} from "./resume-text";
export { ResumePaper, lineKeys, type ResumePaperProps } from "./resume-paper";
export {
  BulletReview,
  WordDiff,
  openPlaceholders,
  previewRewrite,
  type BulletReviewProps,
} from "./bullet-review";
export { ResumeSheet, type ResumeSheetProps } from "./resume-sheet";
