// Profile Read components (spec §5.4, §6.7, §6.10 screen D). Phase 3. Design direction:
// docs/design/phase-3-4-direction.md.

export type {
  EvidenceItem,
  EvidenceKind,
  EvidenceRef,
  Finding,
  FindingAction,
  LensFindingsData,
  LensReading,
  LensStory,
} from "./types";
export {
  LENS_LEVEL_WORDS,
  layoutLensDial,
  lensFraction,
  lensSummary,
  type LensArc,
  type LensSegment,
} from "./lens-geometry";
export { usePrefersReducedMotion } from "./reduced-motion";
export { LensInstrument, type LensInstrumentProps } from "./lens-instrument";
export { LensList, type LensListProps } from "./lens-list";
export { EvidenceDrawer, type EvidenceDrawerProps } from "./evidence";
export { EvidenceLink, evidenceLabel, type EvidenceLinkProps } from "./evidence-link";
export {
  LensFindings,
  StrengtheningPlan,
  type LensFindingsProps,
  type StrengtheningPlanProps,
} from "./findings";
