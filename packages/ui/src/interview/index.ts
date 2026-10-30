// Interview components: the live mock duet stage (spec §6.7, §6.8, §6.10 J). Owned by the Studio
// agent. Built for the Phase 0.5 prototype and meant to carry into Phase 7.

export {
  DuetCaptions,
  DuetControls,
  DuetHeader,
  DuetStage,
  type DuetCaptionsProps,
  type DuetControlsProps,
  type DuetHeaderProps,
  type DuetParty,
  type DuetStageProps,
} from "./duet-stage";
export {
  RESONANCE_GAIN,
  duetMoods,
  elapsedDateTime,
  formatElapsed,
  resonate,
  type DuetSpeaker,
} from "./duet-logic";
