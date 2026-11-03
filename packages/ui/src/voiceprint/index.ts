// The Voiceprint (spec §6.2). Owned by the Voiceprint agent after the Foundation step; the
// exported names and types are the shared contract and may only grow. The WebGL renderer
// (./renderer, with OGL) is deliberately not exported: Voiceprint loads it lazily after mount.

export type {
  LiveVoiceSignal,
  MicrophoneState,
  PerformanceTier,
  VoiceSignalRef,
  VoiceprintIdentity,
  VoiceprintMood,
  VoiceprintParams,
  VoiceprintProps,
} from "./types";
export { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";
export { Voiceprint } from "./voiceprint";
export { VoiceprintStill, type VoiceprintStillProps } from "./voiceprint-still";
export { SILENT_SIGNAL, microphoneSupported, useMicrophone, type MicrophoneOptions } from "./audio";
export type { AnalysisFrame } from "./audio-features";
export {
  configurePerformanceTier,
  decideTier,
  usePerformanceTier,
  useTierDetails,
  type GpuClass,
  type TierDetails,
  type TierInputs,
} from "./tier";
export {
  IDENTITY_MIN_SECONDS,
  IDENTITY_SAMPLE_SECONDS,
  createIdentityAccumulator,
  identityFromText,
  type AccumulatorSnapshot,
  type IdentityAccumulator,
} from "./identity";
