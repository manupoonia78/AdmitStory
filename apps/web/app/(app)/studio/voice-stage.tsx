"use client";

import {
  Button,
  LiveTranscript,
  RecordButton,
  SpokenQuestion,
  VoiceNotice,
  Voiceprint,
  createIdentityAccumulator,
  microphoneSupported,
  paramsFromIdentity,
  useMicrophone,
  voiceHueStyle,
  type IdentityAccumulator,
  type VoiceNoticeAction,
  type VoiceprintIdentity,
  type VoiceprintMood,
} from "@admitstory/ui";
import { useDictation, useReadAloud, type DictationSnapshot } from "@admitstory/voice/client";
import { PencilSimpleLineIcon, SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { StageFrame } from "./stage-frame";
import type { QuestionDto } from "./types";
import type { SpokenAnswer, VoiceFlowEvent, VoiceFlowState } from "./voice-flow";
import {
  LONG_SILENCE_MS,
  NOTICE_ACTION_LABELS,
  heardSoFar,
  recordButtonState,
  studioNotice,
  transcriptSegments,
  type NoticeAction,
} from "./voice-notice";

// The Studio's voice stage (spec §5.2 Talk, §6.2, §6.7, screen B): the Voiceprint full size and
// breathing with the microphone, the question read aloud word by word, the live transcript, the
// record button with hold-Space, and every voice state's notice. Loaded after first paint, so the
// dictation client, the read-aloud player, Motion and the Voiceprint's renderer loader are never
// in the Studio's first load (§6.11). The screen keeps the answer flow (voice-flow.ts) and sends
// the answers; this stage only turns speech into SpokenAnswers and says what is happening.

export interface VoiceStageProps {
  flow: VoiceFlowState;
  dispatch: (event: VoiceFlowEvent) => void;
  question: QuestionDto | null;
  /** Shown in place of the question while there is none. */
  waiting: string;
  /** An answer is being sent. */
  busy: boolean;
  identity: VoiceprintIdentity;
  /** The Voiceprint computed from the applicant's first minutes of speech has been saved. */
  onIdentity: (identity: VoiceprintIdentity, hueStyle: CSSProperties) => void;
  readAloud: boolean;
  onReadAloudChange: (on: boolean) => void;
  /** A dictated answer is complete (Done, or silence after a sentence end). */
  onAnswer: (answer: SpokenAnswer) => void;
}

const partialOf = (snapshot: DictationSnapshot): SpokenAnswer => ({
  text: heardSoFar(snapshot),
  seconds: snapshot.seconds,
  language: snapshot.language,
});

const isRecording = (state: DictationSnapshot["state"]) =>
  state === "connecting" || state === "listening";

/** Saves a Voiceprint identity heard from speech; resolves with the profile's, or null. */
async function saveSpokenIdentity(
  identity: VoiceprintIdentity,
): Promise<VoiceprintIdentity | null> {
  try {
    const response = await fetch("/api/profile/voiceprint", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(identity),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { voiceprint?: VoiceprintIdentity | null };
    return result.voiceprint ?? null;
  } catch {
    return null;
  }
}

export function VoiceStage({
  flow,
  dispatch,
  question,
  waiting,
  busy,
  identity,
  onIdentity,
  readAloud,
  onReadAloudChange,
  onAnswer,
}: VoiceStageProps) {
  const talk = flow.mode === "talk";
  const recordRef = useRef<HTMLDivElement>(null);

  // §6.2: the identity is computed once, from the first IDENTITY_SAMPLE_SECONDS of speech. Frames
  // only arrive while the microphone is live, which is only while an answer is being recorded.
  const [accumulator] = useState<IdentityAccumulator | null>(() =>
    identity.source === "voice" ? null : createIdentityAccumulator(),
  );
  const identitySent = useRef(false);
  const mic = useMicrophone({
    onFrame: (frame) => {
      if (!accumulator || identitySent.current) return;
      accumulator.add(frame);
      if (!accumulator.snapshot().done) return;
      identitySent.current = true;
      const heard = accumulator.identity();
      if (heard)
        void saveSpokenIdentity(heard).then((saved) => {
          if (saved) onIdentity(saved, voiceHueStyle(paramsFromIdentity(saved).hueIndex));
        });
    },
  });

  const read = useReadAloud();
  const { speak, stop: stopReading, unlock } = read;
  const dictation = useDictation({
    microphone: mic,
    // Recording stops the question being read aloud (§5.2).
    onStart: stopReading,
    onDone: (result) =>
      onAnswer({ text: result.text, seconds: result.seconds, language: result.language }),
  });
  const snapshot = dictation.snapshot;
  const recording = isRecording(snapshot.state);
  const stopMic = mic.stop;

  // Each answer gets its own transcript ids, and its own long-silence clock.
  const [attempt, setAttempt] = useState(0);
  const [startFailed, setStartFailed] = useState(false);
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");

  const startAnswer = async () => {
    if (!question || busy) return;
    unlock();
    setStartFailed(false);
    setAttempt((n) => n + 1);
    dispatch({ type: "dictation-start" });
    const started = await dictation.start();
    if (started) {
      setPermission("granted");
      return;
    }
    // The microphone came up but the capture pipeline did not: say so rather than sit there.
    if (mic.audio()) {
      stopMic();
      setStartFailed(true);
    }
  };

  const finishAnswer = () => {
    unlock();
    void dictation.done();
    // "Done" while a transcription has failed: the audio is held, so the microphone can go.
    if (snapshot.state === "failed") stopMic();
  };

  /** "Type instead": the words so far move into the composer, and the recording stops. */
  const typeInstead = () => {
    dispatch({ type: "type-instead", partial: partialOf(snapshot) });
    dictation.cancel();
    stopMic();
  };

  const writeInstead = () => {
    if (snapshot.state === "idle" || snapshot.state === "done") {
      dispatch({ type: "mode", mode: "write" });
    } else {
      typeInstead();
    }
  };

  // The browser's own answer about the microphone, where it gives one, so the explanation and
  // "Allow microphone" only show to someone who has not allowed it yet (§5.2 states).
  const blockedAtStart = useEffectEvent(() => {
    if (flow.block === null) dispatch({ type: "microphone", status: "denied" });
  });
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => {
      if (status) setPermission(status.state);
    };
    if (!microphoneSupported()) return;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        update();
        if (result.state === "denied") blockedAtStart();
        result.addEventListener("change", update);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      status?.removeEventListener("change", update);
    };
  }, []);

  const unsupportedAtStart = useEffectEvent(() => {
    if (flow.block === null) dispatch({ type: "microphone", status: "unsupported" });
  });
  useEffect(() => {
    if (!microphoneSupported()) unsupportedAtStart();
  }, []);

  useEffect(() => {
    if (mic.status === "denied" || mic.status === "unsupported" || mic.status === "live")
      dispatch({ type: "microphone", status: mic.status });
  }, [mic.status, dispatch]);

  // The microphone is only on while an answer is being recorded. A failed transcription keeps
  // it on: the session keeps taking audio, so nothing said while it reconnects is lost.
  useEffect(() => {
    if (snapshot.state === "finishing" || snapshot.state === "done") stopMic();
  }, [snapshot.state, stopMic]);

  // The microphone went away mid-answer (unplugged, permission revoked): end the answer with
  // what was heard rather than lose it.
  const micLost = useEffectEvent(() => {
    if (isRecording(snapshot.state)) void dictation.done();
  });
  useEffect(() => {
    if (mic.status === "error") micLost();
  }, [mic.status]);

  // A refused token: email unverified, the free minutes used, or speech recognition down. The
  // Studio carries on in writing and the words said so far go with it (§12.4).
  const refused = useEffectEvent(() => {
    if (!snapshot.refusal) return;
    dispatch({ type: "refused", reason: snapshot.refusal, partial: partialOf(snapshot) });
    dictation.cancel();
    stopMic();
  });
  useEffect(() => {
    if (snapshot.state === "refused") refused();
  }, [snapshot.state]);

  useEffect(() => {
    if (snapshot.remainingSeconds !== null)
      dispatch({ type: "remaining", seconds: snapshot.remainingSeconds });
  }, [snapshot.remainingSeconds, dispatch]);

  // Leaving Talk ends whatever was in progress; the reducer has already moved any words into the
  // composer. A new question clears the last answer's transcript.
  const reset = useEffectEvent(() => {
    stopReading();
    if (snapshot.state !== "idle") dictation.cancel();
    stopMic();
  });
  const focusRecord = useEffectEvent(() => recordRef.current?.querySelector("button")?.focus());
  const wasTalk = useRef(talk);
  useEffect(() => {
    if (wasTalk.current === talk) return;
    wasTalk.current = talk;
    if (talk) focusRecord();
    else reset();
  }, [talk]);

  const clearAnswer = useEffectEvent(() => {
    if (snapshot.state === "done") dictation.cancel();
  });
  const turnId = question?.turnId ?? null;
  useEffect(() => {
    if (turnId) clearAnswer();
  }, [turnId]);

  // Questions are read aloud in Talk mode when the applicant has it on (§5.2); each question
  // once. Captions are always on screen: the question is the caption. Never over a recording
  // (turning read-aloud on mid-answer): the microphone would hear it.
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!question || !talk || !readAloud || spoken.current === question.turnId) return;
    spoken.current = question.turnId;
    if (!recording) void speak(question.question);
  }, [question, talk, readAloud, speak, recording]);
  useEffect(() => {
    if (!talk || !readAloud) stopReading();
  }, [talk, readAloud, stopReading]);

  const toggleReadAloud = () => {
    const on = !readAloud;
    if (on) {
      unlock();
      // Turned back on: read the question on screen now.
      spoken.current = null;
    }
    onReadAloudChange(on);
  };

  // §12.4: the free minutes running out mid-answer end it with what was said, sent as usual;
  // the Studio then carries on in writing.
  const outOfMinutes = recording && flow.remainingSeconds - snapshot.seconds <= 0;
  const minutesUsed = useEffectEvent(() => void dictation.done());
  useEffect(() => {
    if (outOfMinutes) minutesUsed();
  }, [outOfMinutes]);

  // §5.2 "long silence": a gentle word after a long pause. It never ends the answer.
  const silenceKey = `${attempt}|${snapshot.text.length}|${snapshot.interim}`;
  const [quietKey, setQuietKey] = useState<string | null>(null);
  useEffect(() => {
    if (snapshot.state !== "listening") return;
    const timer = window.setTimeout(() => setQuietKey(silenceKey), LONG_SILENCE_MS);
    return () => window.clearTimeout(timer);
  }, [silenceKey, snapshot.state]);

  const notice = studioNotice({
    mode: flow.mode,
    block: flow.block,
    // While talking, the minutes count down with the answer.
    remainingSeconds: flow.remainingSeconds - (recording ? snapshot.seconds : 0),
    microphone: startFailed ? "error" : mic.status,
    permission,
    dictation: snapshot.state,
    connection: snapshot.connection,
    longSilence: quietKey === silenceKey,
    nothingHeard: flow.nothingHeard,
  });

  const runAction: Record<NoticeAction, () => void> = {
    allow: () => void startAnswer(),
    write: () => dispatch({ type: "mode", mode: "write" }),
    "retry-stt": () => dictation.retry(),
    "retry-mic": () => void startAnswer(),
    type: typeInstead,
  };
  const actions: VoiceNoticeAction[] = (notice?.actions ?? []).map((action, index) => ({
    label: NOTICE_ACTION_LABELS[action],
    onClick: runAction[action],
    primary: index === 0,
  }));

  const reading = read.status === "playing" && read.text === question?.question;
  const mood: VoiceprintMood = recording ? "speaking" : reading ? "listening" : "idle";
  const live = recording ? mic.signal : null;
  const matched = question !== null && read.text === question.question;

  return (
    <StageFrame
      mode={flow.mode}
      voiceprint={
        <Voiceprint
          identity={identity}
          signal={live}
          mood={mood}
          size="fill"
          label="Your Voiceprint"
        />
      }
      question={
        question ? (
          <SpokenQuestion
            text={question.question}
            timings={matched ? read.timings : null}
            clock={matched ? read.clock : null}
            className="max-w-[30ch]"
          />
        ) : (
          <p className="font-reading text-reading-lg text-text-soft">{waiting}</p>
        )
      }
      transcript={
        <LiveTranscript
          segments={transcriptSegments(snapshot, `answer-${attempt}`)}
          signal={live}
          label="Your answer"
          className="h-full"
          empty={
            <p className="text-base">
              {recording
                ? "Listening. Your words appear here as you speak."
                : "Answer out loud. Your words appear here as you speak."}
            </p>
          }
        />
      }
      notice={
        <VoiceNotice notice={notice} actions={actions} className="w-full max-w-2xl text-start" />
      }
      controls={
        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
          <div ref={recordRef}>
            <RecordButton
              state={recordButtonState(snapshot.state, busy)}
              onStart={() => (snapshot.state === "failed" ? dictation.retry() : void startAnswer())}
              onStop={finishAnswer}
              signal={live}
              disabled={!question}
              status={
                mic.status === "requesting"
                  ? "Waiting for your browser's permission"
                  : snapshot.state === "connecting"
                    ? "Getting ready to listen"
                    : undefined
              }
            />
          </div>
          <div className="flex h-20 flex-wrap items-center gap-2">
            {/* aria-disabled, not disabled: focus stays put when an answer ends. */}
            <Button
              variant="secondary"
              onClick={() => {
                if (recording || snapshot.state === "failed") finishAnswer();
              }}
              aria-disabled={!recording && snapshot.state !== "failed"}
            >
              Done
            </Button>
            <Button variant="quiet" icon={PencilSimpleLineIcon} onClick={writeInstead}>
              Write instead
            </Button>
            <Button
              variant="quiet"
              icon={readAloud ? SpeakerHighIcon : SpeakerSlashIcon}
              onClick={toggleReadAloud}
              aria-pressed={readAloud}
            >
              Read questions aloud
            </Button>
          </div>
        </div>
      }
    />
  );
}
