// The Voiceprint (spec §6.2). Owned by the Voiceprint agent after the Foundation step; the
// exported names and types are the shared contract. The WebGL renderer and GPU tiering were
// removed on 2026-11-17 (no WebGL anywhere); Voiceprint is the still SVG.

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
export { voiceprintStillSvg } from "./still-svg";
export { SILENT_SIGNAL, microphoneSupported, useMicrophone, type MicrophoneOptions } from "./audio";
export type { AnalysisFrame } from "./audio-features";
export {
  IDENTITY_MIN_SECONDS,
  IDENTITY_SAMPLE_SECONDS,
  createIdentityAccumulator,
  identityFromText,
  type AccumulatorSnapshot,
  type IdentityAccumulator,
} from "./identity";
