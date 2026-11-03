"use client";

import {
  LiveTranscript,
  PORTAL_COPY,
  RecordButton,
  VoiceNotice,
  useMicrophone,
  type DictatedNote,
} from "@admitstory/ui";
import { fetchSttToken, useDictation } from "@admitstory/voice/client";
import { useEffect, useRef, useState } from "react";
import {
  VOICE_COPY,
  recordButtonState,
  refusalCopy,
  transcriptSegments,
} from "@/app/(app)/studio/voice-notice";

// Saying a note in the recommender portal (spec §5.11, §7.5). Loaded on first press by
// portal-record-host, so a recommender who types never downloads any of it.
//
// The token comes from this page's own endpoint (`/api/r/<token>/stt`), metered against the
// invite's hour of dictation and not the applicant's minutes. The audio only ever exists between
// the microphone and the transcriber: what arrives here is text and a count of seconds.

export function PortalRecord({
  endpoint,
  onDictated,
  autoStart = false,
}: {
  endpoint: string;
  onDictated: (note: DictatedNote) => void;
  /** Pressed once already, to open this: start listening as soon as the microphone is ready. */
  autoStart?: boolean;
}) {
  const mic = useMicrophone();
  const stopMic = mic.stop;
  const dictation = useDictation({
    microphone: mic,
    fetchToken: () => fetchSttToken({ endpoint }),
    onDone: (result) =>
      onDictated({ text: result.text, seconds: result.seconds, language: result.language }),
  });
  const snapshot = dictation.snapshot;
  const recording = snapshot.state === "connecting" || snapshot.state === "listening";
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);

  // The press that loaded this component is the press that starts it.
  const begin = dictation.start;
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void begin();
  }, [autoStart, begin]);

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
        label={PORTAL_COPY.recordNote}
        status={mic.status === "requesting" ? "Waiting for your browser's permission" : undefined}
      />
      {recording || snapshot.state === "finishing" ? (
        <LiveTranscript
          segments={transcriptSegments(snapshot, `note-${attempt}`)}
          signal={recording ? mic.signal : null}
          label={PORTAL_COPY.transcriptLabel}
          className="h-16 w-full text-start"
        />
      ) : null}
      <VoiceNotice
        notice={
          message
            ? {
                tone: snapshot.state === "failed" || mic.status === "error" ? "problem" : "info",
                message,
              }
            : null
        }
        actions={
          snapshot.state === "failed"
            ? [{ label: "Try again", onClick: () => dictation.retry(), primary: true }]
            : []
        }
        className="w-full text-start"
      />
    </div>
  );
}
