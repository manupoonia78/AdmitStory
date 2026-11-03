// School Strategy components (spec §5.5, §6.7, §6.8, §6.10 screen E). Phase 3. Design direction:
// docs/design/phase-3-4-direction.md. HorizonTimeline carries Motion: load it with next/dynamic
// behind HorizonPlaceholder (through a one-line local module, as the Dossier does).

export type {
  Citation,
  ComingSoonHorizonSchool,
  EmptyCell,
  FileMapEntry,
  HonestFlag,
  HonestFlagTone,
  HorizonRound,
  HorizonSchool,
  LockedDeliverable,
  MatrixCell,
  MatrixColumn,
  MatrixGroup,
  MatrixRow,
  MedianCell,
  MedianStanding,
  NumberCell,
  PackStatus,
  PlannedApplication,
  PublishedHorizonSchool,
  TextCell,
} from "./types";
export { citationKey, citationText, formatVerifiedOn, isCitation, verifiedText } from "./citation";
export {
  calendarDay,
  daysLeftText,
  daysUntil,
  formatDay,
  formatDeadline,
  monthTicks,
  positionIn,
  timeDomain,
  type Instant,
  type MonthTick,
  type TimeDomain,
} from "./time-scale";
export {
  MEDIAN_WORDS,
  collectFootnotes,
  formatFigure,
  isUncitedFigure,
  type Footnotes,
} from "./matrix";
export { CitationMark, type CitationMarkProps } from "./citation-mark";
export {
  ComparisonTable,
  MatrixTable,
  type ComparisonTableProps,
  type MatrixTableProps,
} from "./matrix-table";
export {
  COMPARE_AT,
  horizonModel,
  joinNames,
  laneSummary,
  markSummary,
  moveIndex,
  selectionAnnouncement,
  toggleSelection,
  visualOrder,
  type HorizonLane,
  type HorizonMark,
  type HorizonModel,
  type HorizonOptions,
} from "./horizon";
export { HORIZON_HINT, HorizonAxis, type HorizonAxisProps } from "./horizon-parts";
export {
  HorizonList,
  HorizonPlaceholder,
  type HorizonListProps,
  type HorizonPlaceholderProps,
} from "./horizon-list";
export { HorizonTimeline, type HorizonTimelineProps } from "./horizon-timeline";
export {
  HonestFlagItem,
  HonestFlagList,
  type HonestFlagItemProps,
  type HonestFlagListProps,
} from "./honest-flags";
export {
  RoundPlanner,
  plannerModel,
  type PlannerBar,
  type PlannerLane,
  type PlannerModel,
  type RoundPlannerProps,
} from "./round-planner";
export {
  FileMapList,
  KIT_PRICE,
  KitPreview,
  KitPreviewError,
  LockedDeliverables,
  PositioningBlock,
  UnlockCta,
  unlockLabel,
  type ComingSoonUnlockCtaProps,
  type FileMapListProps,
  type KitPreviewErrorProps,
  type KitPreviewProps,
  type LockedDeliverablesProps,
  type PositioningBlockProps,
  type PublishedUnlockCtaProps,
  type UnlockCtaProps,
} from "./kit-preview";
