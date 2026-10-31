"use client";

import {
  LiveTranscript,
  RecordButton,
  VoiceNotice,
  useMicrophone,
  type VoiceNoticeAction,
} from "@admitstory/ui";
import { useDictation } from "@admitstory/voice/client";
import { useEffect, useState } from "react";
import type { SpokenAnswer } from "../studio/voice-flow";
import {
  VOICE_COPY,
  recordButtonState,
  refusalCopy,
  transcriptSegments,
} from "../studio/voice-notice";

// Saying a missing detail instead of typing it (spec §5.3b "add detail by voice"): the Studio's
// dictation, one answer at a time, beside the add-detail box. What was said is added to the box,
// where it can be read and edited before "Add this detail". Code-split from the story card, so
// none of it loads until a story with a missing detail is open (§6.11).

export function DetailDictation({
  onDictated,
  disabled = false,
}: {
  /** A dictated answer is complete; the card adds its words to the box. */
  onDictated: (answer: SpokenAnswer) => void;
  disabled?: boolean;
}) {
  const mic = useMicrophone();
  const stopMic = mic.stop;
  const dictation = useDictation({
    microphone: mic,
    onDone: (result) =>
      onDictated({ text: result.text, seconds: result.seconds, language: result.language }),
  });
  const snapshot = dictation.snapshot;
  const recording = snapshot.state === "connecting" || snapshot.state === "listening";
  const [attempt, setAttempt] = useState(0);

  // The microphone is on only while a detail is being said.
  useEffect(() => {
    if (snapshot.state === "finishing" || snapshot.state === "done" || snapshot.state === "refused")
      stopMic();
  }, [snapshot.state, stopMic]);

  const message =
    snapshot.state === "refused" && snapshot.refusal
      ? refusalCopy(snapshot.refusal)
      : mic.status === "denied" || mic.status === "unsupported"
        ? refusalCopy(mic.status)
        : mic.status === "error"
          ? VOICE_COPY.micError
          : snapshot.state === "failed"
            ? VOICE_COPY.sttFailed
            : snapshot.connection === "offline" && recording
              ? VOICE_COPY.offline
              : null;
  const tone = snapshot.state === "failed" || mic.status === "error" ? "problem" : "info";
  const actions: VoiceNoticeAction[] =
    snapshot.state === "failed"
      ? [{ label: "Try again", onClick: () => dictation.retry(), primary: true }]
      : [];

  return (
    <div className="flex flex-col items-center gap-2">
      <RecordButton
        state={recordButtonState(snapshot.state, false)}
        onStart={() => {
          if (snapshot.state === "failed") return dictation.retry();
          setAttempt((n) => n + 1);
          void dictation.start();
        }}
        onStop={() => void dictation.done()}
        signal={recording ? mic.signal : null}
        spaceToTalk={false}
        label="Say this detail"
        disabled={disabled}
        status={mic.status === "requesting" ? "Waiting for your browser's permission" : undefined}
      />
      {recording || snapshot.state === "finishing" ? (
        <LiveTranscript
          segments={transcriptSegments(snapshot, `detail-${attempt}`)}
          signal={recording ? mic.signal : null}
          label="Your detail"
          className="h-16 w-full max-w-xs text-start"
        />
      ) : null}
      <VoiceNotice
        notice={message ? { tone, message } : null}
        actions={actions}
        className="max-w-xs text-start"
      />
    </div>
  );
}
