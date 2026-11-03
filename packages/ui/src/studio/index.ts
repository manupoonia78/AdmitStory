// Story Studio components (spec §5.2, §6.7, §6.8; §16 Phase 0.5). Owned by the Studio agent.
// Built for the prototype and meant to carry into Phase 1 unchanged.

export {
  estimateWordTimings,
  offsetTimings,
  readingEndMs,
  splitWords,
  spokenWordCount,
  type EstimateOptions,
  type WordTiming,
} from "./word-timing";
export {
  TimedText,
  useSpokenWordCount,
  type PlaybackClock,
  type TimedTextProps,
} from "./timed-text";
export { SpokenQuestion, type SpokenQuestionProps } from "./spoken-question";
export {
  LiveTranscript,
  interimWeight,
  type LiveTranscriptProps,
  type TranscriptSegment,
} from "./live-transcript";
export {
  RECORD_STATUS,
  RecordButton,
  type RecordButtonProps,
  type RecordButtonState,
} from "./record-button";
export { HOLD_TO_TALK_MS, canTalkFrom } from "./space-to-talk";
export {
  VoiceNotice,
  type VoiceNoticeAction,
  type VoiceNoticeProps,
  type VoiceNoticeTone,
} from "./voice-notice";
export {
  ChapterTabs,
  chapterTabId,
  nextTabIndex,
  type ChapterTab,
  type ChapterTabsProps,
} from "./chapter-tabs";
export { MAX_CARD_TRAITS, StoryCard, type StoryCardData, type StoryCardProps } from "./story-card";
export {
  COVERAGE_LABELS,
  COVERAGE_ORDER,
  CoverageMeter,
  coverageText,
  type CoverageLens,
  type CoverageLensId,
  type CoverageLevel,
  type CoverageMeterProps,
} from "./coverage-meter";
export { CAPTURE_SOURCE_ATTRIBUTE } from "./capture-source";
export { announceStory } from "./story-capture-state";
export {
  IGNITE_MS,
  StoryCaptureProvider,
  StoryShelf,
  useShelfFallbackRef,
  useStoryCapture,
  type StoryCapture,
  type StoryCaptureProviderProps,
  type StoryShelfProps,
} from "./story-capture";
export {
  followSpring,
  spansFromTimings,
  syntheticSignalAt,
  type SpringState,
  type VoicedSpan,
} from "./synthetic-signal";
