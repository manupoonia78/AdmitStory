// Kit generation components: the assembly (spec §5.7, §6.7, §6.10 screen F). Owned by the Kit
// agent. Built for the Phase 0.5 prototype and driven by the real pipeline in Phase 4.

export type {
  KitDeliverable,
  KitDeliverableStatus,
  KitStage,
  KitStageStatus,
  KitStory,
} from "./types";
export {
  curveTo,
  threadPath,
  threadsFor,
  usedStories,
  type Point,
  type Thread,
  type ThreadAnchors,
} from "./threads";
export { KitStageList, type KitStageListProps } from "./kit-stage-list";
export { GapQuestionsPlane, type GapQuestionsPlaneProps } from "./gap-questions-plane";
export { KitAssembly, type KitAssemblyProps } from "./kit-assembly";
