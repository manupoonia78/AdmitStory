"use client";

import {
  Button,
  DuetCaptions,
  DuetControls,
  DuetHeader,
  DuetStage,
  TimedText,
  formatElapsed,
  syntheticSignalAt,
  useMicrophone,
  type DuetSpeaker,
  type LiveVoiceSignal,
  type PlaybackClock,
  type VoiceSignalRef,
} from "@admitstory/ui";
import { APP_NAME } from "@admitstory/shared";
import { ArrowCounterClockwiseIcon, MicrophoneIcon, PlayIcon } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePrototypeIdentity } from "../_shared/identity";
import { microphoneNotice } from "../studio/microphone-copy";
import {
  INTERVIEWER_IDENTITY,
  MOCK,
  TURNS,
  advanceScript,
  captionsAt,
  planDuet,
  speakerAt,
  type PlannedTurn,
} from "./script";

const SILENT: LiveVoiceSignal = { amplitude: 0, centroid: 0, pitchDelta: 0 };
const INTERVIEWER_SEED = 7;
const YOUR_SEED = 3;

type Phase = "lobby" | "live" | "ended";

interface Turns {
  speaker: DuetSpeaker;
  interviewer: number | null;
  you: number | null;
}

const NO_TURNS: Turns = { speaker: null, interviewer: null, you: null };

const sameTurns = (a: Turns, b: Turns) =>
  a.speaker === b.speaker && a.interviewer === b.interviewer && a.you === b.you;

/** The louder of two signals: the sample answer and your microphone can both drive your form. */
function louder(a: LiveVoiceSignal, b: LiveVoiceSignal): LiveVoiceSignal {
  return a.amplitude >= b.amplitude ? a : b;
}

/**
 * Live mock prototype (spec §6.7 "Live mock", §6.10 J): two Voiceprints facing each other in a dim
 * room, a scripted interviewer and scripted answers from a fictional applicant. Your microphone,
 * if you turn it on, drives your form too.
 */
export function DuetPrototype() {
  const [identity] = usePrototypeIdentity();
  const mic = useMicrophone();
  const plan = useMemo(() => planDuet(TURNS), []);
  const noteId = useId();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [turns, setTurns] = useState<Turns>(NO_TURNS);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("");

  // The clocks live outside React: the session timer and the script position, in ms.
  const timerMs = useRef(0);
  const scriptMs = useRef(0);
  // The question last announced. It outlives the frame loop, which restarts on every pause, mute
  // or wait, so a toggle never announces the same question again over its own status.
  const announced = useRef<number | null>(null);
  const yourSignal = useRef<LiveVoiceSignal>({ ...SILENT });
  const interviewerSignal = useRef<LiveVoiceSignal>({ ...SILENT });
  const controlsRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const micLive = mic.status === "live";
  const micSignal = mic.signal;

  useEffect(() => {
    if (phase !== "live") return;
    const yours = yourSignal.current;
    const theirs = interviewerSignal.current;
    let last = performance.now();
    let frame = 0;
    let shownSeconds = -1;
    let shownTurns: Turns | null = null;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused) {
        timerMs.current += dt;
        scriptMs.current = advanceScript(plan, scriptMs.current, dt, waiting);
      }
      const ms = scriptMs.current;
      Object.assign(
        theirs,
        paused ? SILENT : syntheticSignalAt(plan.spans.interviewer, ms, INTERVIEWER_SEED),
      );
      const sample = paused ? SILENT : syntheticSignalAt(plan.spans.you, ms, YOUR_SEED);
      Object.assign(yours, muted ? SILENT : louder(sample, micLive ? micSignal.current : SILENT));

      const nextSeconds = Math.floor(timerMs.current / 1000);
      if (nextSeconds !== shownSeconds) {
        shownSeconds = nextSeconds;
        setSeconds(nextSeconds);
      }
      const captions = captionsAt(plan, ms);
      const nextTurns = { speaker: speakerAt(plan, ms), ...captions };
      if (!shownTurns || !sameTurns(shownTurns, nextTurns)) {
        // A new question is announced once, in full; the visible caption is not a live region.
        const asked =
          nextTurns.interviewer === announced.current
            ? undefined
            : plan.turns[nextTurns.interviewer ?? -1];
        announced.current = nextTurns.interviewer;
        if (asked) setStatus(`Interviewer: ${asked.text}`);
        shownTurns = nextTurns;
        setTurns(nextTurns);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      Object.assign(yours, SILENT);
      Object.assign(theirs, SILENT);
    };
  }, [phase, paused, waiting, muted, micLive, micSignal, plan]);

  // Focus follows the room: into the controls when the mock starts, to "Start again" at the end.
  useEffect(() => {
    if (phase === "live") controlsRef.current?.querySelector("button")?.focus();
    if (phase === "ended") restartRef.current?.focus();
  }, [phase]);

  const start = (withMicrophone: boolean) => {
    timerMs.current = 0;
    scriptMs.current = 0;
    announced.current = null;
    setTurns(NO_TURNS);
    setSeconds(0);
    setPaused(false);
    setWaiting(false);
    setMuted(false);
    setStatus("The mock has started.");
    if (withMicrophone) void mic.start();
    setPhase("live");
  };

  const end = () => {
    mic.stop();
    setPhase("ended");
    setTurns((current) => ({ ...current, speaker: null }));
    setStatus(`Mock ended at ${formatElapsed(timerMs.current)}.`);
  };

  const interviewerClock = useTurnClock(plan.turns, turns.interviewer, scriptMs);
  const yourClock = useTurnClock(plan.turns, turns.you, scriptMs);
  const question = turns.interviewer === null ? undefined : plan.turns[turns.interviewer];
  const answer = turns.you === null ? undefined : plan.turns[turns.you];

  const blocked = mic.status === "denied" || mic.status === "unsupported" || mic.status === "error";
  const askCopy = microphoneNotice("idle", APP_NAME)?.message;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      <DuetStage
        you={{
          identity,
          signal: yourSignal as VoiceSignalRef,
          label: "Your Voiceprint",
        }}
        interviewer={{
          identity: INTERVIEWER_IDENTITY,
          signal: interviewerSignal as VoiceSignalRef,
          label: "The interviewer's Voiceprint",
        }}
        speaker={phase === "live" ? turns.speaker : null}
        paused={phase !== "live" || paused}
        status={status}
        header={<DuetHeader title={MOCK.title} details={MOCK.details} elapsedMs={seconds * 1000} />}
        captions={
          <DuetCaptions
            hidden={!captionsOn}
            interviewer={
              question ? (
                <TimedText
                  key={turns.interviewer}
                  text={question.text}
                  timings={question.words}
                  clock={interviewerClock}
                  upcoming="hidden"
                />
              ) : null
            }
            you={
              answer ? (
                <TimedText
                  key={turns.you}
                  text={answer.text}
                  timings={answer.words}
                  clock={yourClock}
                  upcoming="hidden"
                />
              ) : null
            }
          />
        }
        controls={
          phase === "live" ? (
            <div ref={controlsRef} className="flex flex-col items-center gap-1">
              <p className="min-h-[1lh] px-4 text-center text-sm text-text-soft">
                {waiting
                  ? "Take your time. The interviewer will wait until you're ready."
                  : blocked
                    ? "Microphone is blocked in your browser settings. The sample answers will play instead."
                    : micLive && !muted
                      ? "Your microphone is on. Speak along and your Voiceprint answers."
                      : ""}
              </p>
              <DuetControls
                muted={muted}
                onMutedChange={(next) => {
                  setMuted(next);
                  setStatus(next ? "Muted." : "Unmuted.");
                }}
                captionsOn={captionsOn}
                onCaptionsChange={setCaptionsOn}
                paused={paused}
                onPausedChange={(next) => {
                  setPaused(next);
                  setStatus(next ? "Paused. The timer has stopped." : "Resumed.");
                }}
                waiting={waiting}
                onWaitingChange={(next) => {
                  setWaiting(next);
                  setStatus(
                    next
                      ? "Take your time. The interviewer will wait until you're ready."
                      : "The interviewer will go on when you finish.",
                  );
                }}
                onEnd={end}
              />
            </div>
          ) : phase === "lobby" ? (
            <div className="flex flex-col items-center gap-4 px-4 pt-2 pb-6 text-center">
              <p className="max-w-prose text-base text-text-soft">
                A scripted interviewer asks three questions and sample answers from a fictional
                applicant reply. Turn on your microphone to make your Voiceprint answer you too.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button icon={PlayIcon} onClick={() => start(false)}>
                  Start the mock
                </Button>
                <Button
                  variant="secondary"
                  icon={MicrophoneIcon}
                  onClick={() => start(true)}
                  aria-describedby={noteId}
                >
                  Start with my microphone
                </Button>
              </div>
              <p id={noteId} className="max-w-prose text-sm text-text-soft">
                {askCopy}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 px-4 pt-2 pb-6 text-center">
              <p className="text-base text-text">
                Mock ended at <span className="tabular-nums">{formatElapsed(seconds * 1000)}</span>.
                The interview report isn&apos;t part of this prototype.
              </p>
              <Button
                ref={restartRef}
                variant="secondary"
                icon={ArrowCounterClockwiseIcon}
                onClick={() => start(false)}
              >
                Start again
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}

/**
 * A playback clock for one turn's caption: script time since the turn began. One function per
 * turn, so TimedText restarts its word count when the turn changes.
 */
function useTurnClock(
  planned: readonly PlannedTurn[],
  index: number | null,
  scriptMs: { current: number },
): PlaybackClock | null {
  return useMemo(() => {
    const turn = index === null ? undefined : planned[index];
    if (!turn) return null;
    return () => scriptMs.current - turn.startMs;
  }, [planned, index, scriptMs]);
}
