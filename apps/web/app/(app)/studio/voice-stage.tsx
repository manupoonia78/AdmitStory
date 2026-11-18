"use client";

import {
  Button,
  LiveTranscript,
  RecordButton,
  SpokenQuestion,
  StudioVoiceline,
  VoiceNotice,
  createIdentityAccumulator,
  microphoneSupported,
  paramsFromIdentity,
  useMicrophone,
  voiceHueStyle,
  type IdentityAccumulator,
  type VoiceNoticeAction,
  type VoicelineSpeaker,
  type VoiceprintIdentity,
} from "@admitstory/ui";
import { useDictation, useReadAloud, type DictationSnapshot } from "@admitstory/voice/client";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { QUESTION_CLASS, StageFrame } from "./stage-frame";
import type { LiveReply, QuestionDto } from "./types";
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

// The Studio's voice stage (spec §5.2 Talk; SPEC §6.4): the horizon line answering the
// microphone, the question read aloud word by word, the live transcript, the record button with
// hold-Space, and every voice state's notice. Loaded after first paint, so the dictation client,
// the read-aloud player, Motion and the canvas line are never in the Studio's first load. The screen keeps the answer flow (voice-flow.ts) and sends
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
  /** The consultant's reply as it streams in, then finished. */
  reply: LiveReply | null;
  /** The applicant's last answer, shown as saved until they start the next one. */
  lastSaid: string;
  /** The open chapter's name, above the question. */
  chapter: string;
  /** The answer field, shown in the transcript's place in Write. */
  composer?: ReactNode;
  /** The top row's Write switch calls this: it carries the words said so far into the composer. */
  writeInsteadRef: RefObject<(() => void) | null>;
  /** A goodbye (`question.wrapUp`) has been read aloud in full: the screen closes the session. */
  onGoodbyeSaid?: () => void;
}

/** The end of the last complete sentence in `text`, or 0: where a spoken chunk can stop. */
function sentenceBoundary(text: string): number {
  let end = 0;
  for (const match of text.matchAll(/[.?!…]["'”’)\]]*\s+/gu)) end = match.index + match[0].length;
  return end;
}

/** Hands-free: an answer the Studio started on its own ends quietly if nothing is said. */
const HANDS_FREE_IDLE_MS = 12_000;

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
  reply,
  lastSaid,
  chapter,
  writeInsteadRef,
  composer,
  onGoodbyeSaid,
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
  /** The reply's read-aloud queue: which reply, how much of it has been handed to the player. */
  const speech = useRef<{ id: string | null; said: string; items: string[]; playing: boolean }>({
    id: null,
    said: "",
    items: [],
    playing: false,
  });

  // Hands-free (on by default): once the applicant has answered out loud once, the Studio
  // listens again by itself when the consultant finishes speaking, like a call.
  const [handsFree, setHandsFree] = useState(true);
  const autoStarted = useRef(false);

  const startAnswer = async (auto = false) => {
    if (!question || busy) return;
    autoStarted.current = auto;
    speech.current.items = [];
    if (!auto) unlock();
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
  useEffect(() => {
    writeInsteadRef.current = writeInstead;
  });
  useEffect(
    () => () => {
      writeInsteadRef.current = null;
    },
    [writeInsteadRef],
  );

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

  // The reply is read aloud as it streams (§5.2: questions read aloud in Talk mode when the
  // applicant has it on): each sentence goes to the player the moment it is complete, so the
  // consultant starts talking while the rest is still being written. Captions are always on
  // screen. Never over a recording: the microphone would hear it.
  const answeredOnce = attempt > 0;

  const listenAgain = useEffectEvent(() => {
    // After a goodbye there is nothing to answer: once it has been said, the call ends. With
    // read-aloud off the screen closes on its own timer instead.
    if (question?.wrapUp) {
      if (talk && readAloud) onGoodbyeSaid?.();
      return;
    }
    if (!handsFree || !talk || !answeredOnce || busy || !question) return;
    if (isRecording(snapshot.state) || snapshot.state === "finishing") return;
    void startAnswer(true);
  });

  const latestReply = useRef(reply);
  useEffect(() => {
    latestReply.current = reply;
  });

  /** Says whatever is queued, in order; when it runs dry on a finished reply, hands over. */
  const pump = useEffectEvent(() => {
    const queue = speech.current;
    if (queue.playing) return;
    queue.playing = true;
    void (async () => {
      for (let next = queue.items.shift(); next !== undefined; next = queue.items.shift()) {
        const outcome = await speak(next);
        if (outcome !== "ended") {
          queue.items = [];
          queue.playing = false;
          return;
        }
      }
      queue.playing = false;
      // Everything said and the reply is finished: the applicant's turn. Read from the ref, since
      // the reply may have finished while this was speaking.
      const latest = latestReply.current;
      if (latest?.final && latest.id === queue.id && queue.said.length >= latest.text.length)
        listenAgain();
    })();
  });

  const liveText = reply?.text ?? "";
  const liveFinal = reply?.final ?? false;
  const liveId = reply?.id ?? null;
  const feedSpeech = useEffectEvent(() => {
    if (!liveId || !talk || !readAloud || recording) return;
    if (speech.current.id !== liveId)
      speech.current = { id: liveId, said: "", items: [], playing: false };
    const queue = speech.current;
    // The finished reply can differ from what streamed (a repaired reply). Then what was said is
    // wrong: stop, and read the finished one from the start.
    if (liveFinal && !liveText.startsWith(queue.said)) {
      queue.items = [];
      queue.said = "";
      stopReading();
    }
    const pending = liveText.slice(queue.said.length);
    const take = liveFinal ? pending.length : sentenceBoundary(pending);
    const chunk = pending.slice(0, take).trim();
    queue.said += pending.slice(0, take);
    if (chunk) queue.items.push(chunk);
    pump();
  });
  useEffect(() => {
    feedSpeech();
  }, [liveText, liveFinal, liveId]);

  // A question that did not stream (the session's first, after a resume) is read whole.
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!question || !talk || !readAloud || spoken.current === question.turnId) return;
    spoken.current = question.turnId;
    if (question.streamed || recording) return;
    void speak(question.question).then((outcome) => {
      if (outcome === "ended") listenAgain();
    });
  }, [question, talk, readAloud, speak, recording]);
  useEffect(() => {
    if (!talk || !readAloud) {
      speech.current.items = [];
      stopReading();
    }
  }, [talk, readAloud, stopReading]);

  // Read-aloud off: hands-free still hands the turn back as soon as the question is on screen.
  const silentHandOff = useEffectEvent(() => {
    if (!readAloud) listenAgain();
  });
  useEffect(() => {
    if (!turnId) return;
    const timer = window.setTimeout(() => silentHandOff(), 600);
    return () => window.clearTimeout(timer);
  }, [turnId]);

  // Hands-free answers end quietly when nothing is said, so an open microphone never runs down
  // the free minutes while the applicant is away.
  const nothingYet = snapshot.text === "" && snapshot.interim === "";
  const idleOut = useEffectEvent(() => {
    if (!autoStarted.current || !nothingYet || !isRecording(snapshot.state)) return;
    dictation.cancel();
    stopMic();
  });
  useEffect(() => {
    if (snapshot.state !== "listening" || !nothingYet) return;
    const timer = window.setTimeout(() => idleOut(), HANDS_FREE_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [snapshot.state, nothingYet, attempt]);

  const toggleReadAloud = () => {
    const on = !readAloud;
    if (on) {
      unlock();
      // Turned back on: read the question on screen now.
      if (question && !recording) void speak(question.question);
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
    allow: () => void startAnswer(false),
    write: () => dispatch({ type: "mode", mode: "write" }),
    "retry-stt": () => dictation.retry(),
    "retry-mic": () => void startAnswer(false),
    type: typeInstead,
  };
  const actions: VoiceNoticeAction[] = (notice?.actions ?? []).map((action, index) => ({
    label: NOTICE_ACTION_LABELS[action],
    onClick: runAction[action],
    primary: index === 0,
  }));

  const reading = read.status === "playing" && read.text === question?.question;
  const speaker: VoicelineSpeaker = recording ? "you" : reading ? "reader" : "none";
  const live = recording ? mic.signal : null;
  const matched = question !== null && read.text === question.question;

  return (
    <StageFrame
      mode={flow.mode}
      chapter={chapter}
      line={<StudioVoiceline signal={live} speaker={speaker} identity={identity} />}
      question={
        reply && !reply.final && reply.text ? (
          <h2 className={QUESTION_CLASS} aria-live="polite">
            {reply.text}
          </h2>
        ) : question ? (
          <SpokenQuestion
            text={question.question}
            timings={matched ? read.timings : null}
            clock={matched ? read.clock : null}
            className="studio-question"
          />
        ) : (
          <p className="text-display-3 text-text-soft">{waiting}</p>
        )
      }
      answer={
        talk ? (
          <LiveTranscript
            segments={transcriptSegments(snapshot, `answer-${attempt}`)}
            signal={live}
            label="Your answer"
            className="studio-transcript"
            empty={
              recording ? (
                <p className="text-base text-text-soft">
                  Listening. Your words appear here as you speak.
                </p>
              ) : lastSaid ? (
                <div className="flex flex-col gap-2">
                  <p className="line-clamp-3 font-accent text-transcript text-text-soft italic">
                    {lastSaid}
                  </p>
                  <p className="label text-text-label">Saved to your Dossier</p>
                </div>
              ) : (
                <p className="text-base text-text-soft">
                  Answer out loud. Your words appear here as you speak.
                </p>
              )
            }
          />
        ) : (
          composer
        )
      }
      notice={<VoiceNotice notice={notice} actions={actions} className="w-full max-w-2xl" />}
      button={
        <div ref={recordRef}>
          <RecordButton
            state={recordButtonState(snapshot.state, busy)}
            onStart={() =>
              snapshot.state === "failed" ? dictation.retry() : void startAnswer(false)
            }
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
      }
      controls={
        <>
          {/* aria-disabled, not disabled: focus stays put when an answer ends. */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (recording || snapshot.state === "failed") finishAnswer();
            }}
            aria-disabled={!recording && snapshot.state !== "failed"}
          >
            Done
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={toggleReadAloud}
            aria-pressed={readAloud}
            className="gap-2"
          >
            <span aria-hidden className="studio-dot" />
            Read aloud
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setHandsFree((on) => !on)}
            aria-pressed={handsFree}
            className="gap-2"
          >
            <span aria-hidden className="studio-dot" />
            Hands-free
          </Button>
        </>
      }
    />
  );
}
