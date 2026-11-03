"use client";

// Everything the hero does after the first tap (direction §4.2, plan §9.1.3–6), loaded lazily by
// ./hero-stage. Each phase renders into the actions box (which keeps its height) and, where the
// moment needs it, into absolutely placed layers over the stage, so nothing below ever moves:
//
//   explaining   the §6.9 microphone explainer, with Turnstile rendered invisibly beside it
//   recording    a 15-second answer: microphone → 16 kHz PCM → Deepgram (one scoped token from
//                /api/demo/stt-token), the live transcript over the form, a countdown ring
//   sample       the fictional applicant's line, its words brightening on their timings
//   writing      a two-line field instead of the microphone
//   placing      the words glow, an essay sheet rises, and each word flies into its first line
//   placed       the caption, "Sign up and keep this line" and "Say it again"
//
// Escape or "Say it again" interrupts any of it. Nothing the visitor says or writes leaves this
// browser except as audio to the speech-to-text provider; the line is kept only on "keep".

import {
  SharedElement,
  buttonStyles,
  createIdentityAccumulator,
  cx,
  estimateWordTimings,
  identityFromText,
  spansFromTimings,
  spokenWordCount,
  readingEndMs,
  splitWords,
  syntheticSignalAt,
  useMicrophone,
  type LiveVoiceSignal,
  type VoiceSignalRef,
  type VoiceprintIdentity,
  type VoiceprintMood,
  type WordTiming,
} from "@admitstory/ui";
import {
  createDictationSession,
  startPcmCapture,
  type DictationSession,
  type DictationSnapshot,
  type PcmCapture,
} from "@admitstory/voice/client";
import type { SttTokenResponse } from "@admitstory/voice/contract";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
} from "react";
import {
  FIRST_LINE_MAX_CHARS,
  FIRST_LINE_TRANSITION,
  saveFirstLine,
} from "@/lib/marketing/first-line";
import {
  CAPTION_COPY,
  HERO_ACTIONS,
  HERO_COPY,
  HERO_NOTICES,
  MIC_EXPLAINER,
  SAMPLE_LABEL,
  SHEET_COPY,
  WRITE_COPY,
  fillersLine,
  placedAnnouncement,
  recordingStatus,
} from "../_copy/hero";
import { START_FREE } from "../_copy/shared";
import { SAMPLE_LINE } from "../_data/sample";
import { track } from "../_lib/track";
import { DemoRefusal, fetchDemoToken, renderTurnstile, type TurnstileHandle } from "./hero-demo";
import { flyWord, prefersStill, readSpring } from "./hero-motion";
import {
  INTERRUPTIBLE,
  SILENCE_END_MS,
  SPEAK_SECONDS,
  WATCHDOG_SECONDS,
  type HeroAction,
  type HeroState,
  type PlacedLine,
} from "./hero-state";
import { ACTIONS_BOX, Notice, RecordGlyph, recordClasses } from "./hero-ui";
import { cleanSpokenLine, cleanWrittenLine } from "./line-cleanup";

export interface HeroExperienceProps {
  state: HeroState;
  dispatch: Dispatch<HeroAction>;
  signal: VoiceSignalRef;
  identity: VoiceprintIdentity | null;
  setIdentity: (identity: VoiceprintIdentity | null) => void;
  setMood: (mood: VoiceprintMood) => void;
}

const SILENT: LiveVoiceSignal = { amplitude: 0, centroid: 0, pitchDelta: 0 };
const TEXT_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-control px-3 text-base text-signal underline-offset-4 hover:underline";
const PRIMARY = cx(buttonStyles({ variant: "primary" }), "min-h-11 px-5");
const GHOST = cx(buttonStyles({ variant: "secondary" }), "min-h-11 px-5");
/** The live transcript and the sample's words: Geist 500 at display-sm, three lines tall. */
const TRANSCRIPT =
  "flex h-[3.6em] flex-col justify-end overflow-hidden text-center font-ui text-display-sm font-medium leading-[1.2] tracking-[-0.02em] text-text";

export default function HeroExperience(props: HeroExperienceProps) {
  const { state, dispatch } = props;
  const [leaving, setLeaving] = useState(false);
  const turnstile = useRef<TurnstileHandle | null>(null);
  const turnstileSlot = useRef<HTMLDivElement>(null);

  // Turnstile renders once, the first time the explainer opens, and lives until the hero is idle
  // again, so a challenge still running when "Allow microphone" is pressed can finish.
  useEffect(() => {
    if (state.phase !== "explaining" || turnstile.current || !turnstileSlot.current) return;
    turnstile.current = renderTurnstile(turnstileSlot.current);
  }, [state.phase]);
  useEffect(() => () => turnstile.current?.remove(), []);

  // Escape interrupts from wherever the moment has got to (while focus is in the hero or nowhere).
  const interrupt = useEffectEvent(() => {
    if (!INTERRUPTIBLE.has(state.phase)) return;
    if (state.phase === "placing" || state.phase === "placed") setLeaving(true);
    else dispatch({ type: "reset" });
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      const hero = document.getElementById("hero");
      if (active && active !== document.body && !hero?.contains(active)) return;
      event.preventDefault();
      interrupt();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const recording =
    state.phase === "requesting" || state.phase === "listening" || state.phase === "finishing";

  return (
    <div className={ACTIONS_BOX}>
      {state.phase === "explaining" ? <Explainer dispatch={dispatch} /> : null}
      {recording ? <Recorder {...props} turnstile={turnstile} /> : null}
      {state.phase === "sample" ? <SamplePlayer {...props} /> : null}
      {state.phase === "writing" ? <Writer {...props} /> : null}
      {(state.phase === "placing" || state.phase === "placed") && state.line ? (
        <Placement
          {...props}
          line={state.line}
          leaving={leaving}
          onLeave={() => setLeaving(true)}
          onGone={() => {
            setLeaving(false);
            dispatch({ type: "reset" });
          }}
        />
      ) : null}
      {/* Turnstile's (usually invisible) widget. interaction-only shows a box only if needed. */}
      <div
        ref={turnstileSlot}
        className={cx("mt-3", !(state.phase === "explaining" || recording) && "hidden")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The microphone explainer (§6.9): getUserMedia is only called after "Allow microphone".

function Explainer({ dispatch }: { dispatch: Dispatch<HeroAction> }) {
  const allow = useRef<HTMLButtonElement>(null);
  useEffect(() => allow.current?.focus({ preventScroll: true }), []);
  return (
    <div
      role="group"
      aria-labelledby="hero-mic-text"
      className="plane max-w-[36rem] animate-fade-in p-4 sm:p-5"
    >
      <p id="hero-mic-text" className="text-base text-text">
        {MIC_EXPLAINER.text}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          ref={allow}
          type="button"
          className={PRIMARY}
          onClick={() => dispatch({ type: "allow" })}
        >
          {MIC_EXPLAINER.allow}
        </button>
        <button type="button" className={TEXT_BUTTON} onClick={() => dispatch({ type: "write" })}>
          {MIC_EXPLAINER.write}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Recording: one 15-second answer.

function Recorder({
  state,
  dispatch,
  signal,
  setIdentity,
  setMood,
  turnstile,
}: HeroExperienceProps & { turnstile: { current: TurnstileHandle | null } }) {
  const accumulator = useRef(createIdentityAccumulator());
  const mic = useMicrophone({
    onFrame: (frame) => {
      accumulator.current.add(frame);
      // The form follows the microphone's own signal (one analyser, one context).
      Object.assign(signal.current, mic.signal.current);
    },
  });

  const token = useRef<SttTokenResponse | null>(null);
  const session = useRef<DictationSession | null>(null);
  const capture = useRef<PcmCapture | null>(null);
  const ended = useRef(false);
  const [snapshot, setSnapshot] = useState<DictationSnapshot | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(SPEAK_SECONDS);
  const [announcement, setAnnouncement] = useState("");
  const transcriptRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const stopAudio = () => {
    capture.current?.close();
    capture.current = null;
    mic.stop();
    Object.assign(signal.current, SILENT);
  };

  /** The answer is over: tidy it, and place it (or say nothing was heard). */
  const conclude = useEffectEvent((text: string) => {
    if (ended.current) return;
    ended.current = true;
    const cleaned = cleanSpokenLine(text);
    const progress = accumulator.current.snapshot();
    if (cleaned && progress.usable) setIdentity(accumulator.current.identity());
    stopAudio();
    setMood("idle");
    if (cleaned) track("hero_line_placed", { source: "voice" });
    dispatch({
      type: "transcript",
      line: cleaned ? { line: cleaned.line, source: "voice", removed: cleaned.removed } : null,
    });
  });

  // A plain function, so the Done button's handler (finish) can call it too; effects use `fail`.
  const failNow = (notice: "paused" | "turnstile" | "mic_blocked") => {
    if (ended.current) return;
    ended.current = true;
    session.current?.dispose();
    stopAudio();
    setMood("idle");
    dispatch({ type: "fail", notice });
  };
  const fail = useEffectEvent(failNow);

  const finish = () => {
    const current = session.current;
    if (!current || state.phase !== "listening") {
      if (!ended.current && state.phase === "requesting") failNow("paused");
      return;
    }
    dispatch({ type: "finish" });
    void (capture.current?.flush() ?? Promise.resolve()).then(() => current.finish());
  };
  const finishFromEffect = useEffectEvent(finish);

  /** The session's own states: open (start the clock), or failed and refused. */
  const onSessionState = useEffectEvent((next: DictationSnapshot["state"]) => {
    if (next === "listening" && state.phase === "requesting") {
      dispatch({ type: "listening" });
      setMood("speaking");
      setStartedAt(performance.now());
      setAnnouncement(recordingStatus(SPEAK_SECONDS));
      doneRef.current?.focus({ preventScroll: true });
    } else if (next === "failed" || next === "refused") {
      // A socket that fails (or the dev fake server not running) pauses speaking for this visit,
      // unless words already arrived: then the answer stands.
      const text = session.current?.getSnapshot().text ?? "";
      if (text) conclude(text);
      else fail("paused");
    }
  });

  /** Both the token and the microphone are ready: open the stream. */
  const begin = useEffectEvent(async () => {
    const audio = mic.audio();
    const minted = token.current;
    if (session.current || !audio || !minted || ended.current) return;
    let handedOut = false;
    const dictation = createDictationSession({
      // One connection: the demo's token is single-use, and a dropped socket isn't retried.
      fetchToken: async () => {
        if (handedOut) return { refusal: "stt_unavailable" };
        handedOut = true;
        return minted;
      },
      retryDelaysMs: [],
      utteranceEndMs: SILENCE_END_MS,
      onDone: (result) => conclude(result.text),
    });
    session.current = dictation;
    let lastState = dictation.getSnapshot().state;
    dictation.subscribe(() => {
      const next = dictation.getSnapshot();
      setSnapshot(next);
      if (next.state !== lastState) {
        lastState = next.state;
        onSessionState(next.state);
      }
    });
    try {
      capture.current = await startPcmCapture(audio.context, audio.stream, (pcm) =>
        dictation.pushAudio(pcm),
      );
    } catch {
      return fail("paused");
    }
    dictation.start();
  });

  // Start: the microphone and the token together (one tap, one prompt).
  useEffect(() => {
    let cancelled = false;
    const live = signal.current;
    void mic.start();
    void (turnstile.current?.token() ?? Promise.resolve(null))
      .then((turnstileToken) => fetchDemoToken(turnstileToken))
      .then(
        (minted) => {
          if (cancelled) return;
          token.current = minted;
          void begin();
        },
        (error: unknown) => {
          if (cancelled) return;
          fail(
            error instanceof DemoRefusal && error.reason === "turnstile" ? "turnstile" : "paused",
          );
        },
      );
    return () => {
      cancelled = true;
      session.current?.dispose();
      session.current = null;
      capture.current?.close();
      capture.current = null;
      Object.assign(live, SILENT);
    };
    // Runs once per recording; the microphone hook's start is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mic.status === "live") void begin();
    else if (mic.status === "denied") fail("mic_blocked");
    else if (mic.status === "unsupported" || mic.status === "error") fail("paused");
  }, [mic.status]);

  // The countdown, the 15-second stop and the 20-second watchdog.
  useEffect(() => {
    if (startedAt === null) return;
    const tick = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const left = Math.max(0, Math.ceil(SPEAK_SECONDS - elapsed));
      setSecondsLeft(left);
      if (left === 10 || left === 5) setAnnouncement(recordingStatus(left));
      if (elapsed >= SPEAK_SECONDS) finishFromEffect();
      if (elapsed >= WATCHDOG_SECONDS) {
        const text = session.current?.getSnapshot().text ?? "";
        session.current?.dispose();
        if (text) conclude(text);
        else fail("paused");
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [startedAt]);

  // The active line's weight answers the voice (±60 around 500), written per frame, never state.
  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let level = 0.5;
    const loop = () => {
      level += (signal.current.amplitude - level) * 0.25;
      const weight = Math.round(500 + (Math.min(1, Math.max(0, level)) * 2 - 1) * 60);
      element.style.setProperty("--interim-weight", String(weight));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [signal]);

  // Space stops while focus is in the hero but not on a control.
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat) return;
      const target = event.target as Element | null;
      if (target?.closest("button, a, input, textarea, select")) return;
      event.preventDefault();
      finishFromEffect();
    };
    hero.addEventListener("keydown", onKey);
    return () => hero.removeEventListener("keydown", onKey);
  }, []);

  const record = recordClasses(true);
  const listening = state.phase === "listening";
  const ringLength = 2 * Math.PI * 34;
  const text = snapshot?.text ?? "";
  const interim = snapshot?.interim ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <button
          ref={doneRef}
          type="button"
          className={record.button}
          onClick={() => finish()}
          aria-pressed={listening}
          aria-describedby="hero-recording-status"
        >
          <span className={record.circle}>
            <RecordGlyph recording />
            {listening ? (
              <svg
                viewBox="0 0 72 72"
                aria-hidden="true"
                className="absolute inset-0 hidden size-full -rotate-90 sm:block"
              >
                <circle
                  cx="36"
                  cy="36"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.9"
                  strokeWidth="2"
                  strokeDasharray={ringLength}
                  className="hero-ring"
                  style={{ ["--ring-length" as string]: `${ringLength}` }}
                />
              </svg>
            ) : null}
          </span>
          {HERO_ACTIONS.done}
        </button>
        <span aria-hidden="true" className="text-lg text-text tabular-nums">
          0:{String(secondsLeft).padStart(2, "0")}
        </span>
      </div>
      <p className="mt-4 max-w-[34rem] text-sm text-text-soft">{HERO_COPY.privacy}</p>
      <p id="hero-recording-status" className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="hero-center" aria-hidden="true">
        <p ref={transcriptRef} className={TRANSCRIPT}>
          <span>
            {text}
            {text && interim ? " " : null}
            <span className="opacity-40 [font-weight:var(--interim-weight,500)] transition-opacity duration-(--spring-snap-duration)">
              {interim}
            </span>
          </span>
        </p>
      </div>
      <div className="sr-only" role="log" aria-live="polite" aria-label="Transcript">
        {text}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The sample: the fictional applicant's line on its word timings, the form driven by its envelope.

interface SampleManifest {
  audio: { webm?: string; m4a?: string } | null;
  words: WordTiming[];
  envelope: { hz: number; amplitude: number[]; centroid: number[]; pitchDelta: number[] } | null;
}

function isManifest(value: unknown): value is SampleManifest {
  const record = value as SampleManifest | null;
  return Boolean(record && Array.isArray(record.words) && record.words.length > 0);
}

function SamplePlayer({ dispatch, signal, setMood }: HeroExperienceProps) {
  const words = splitWords(SAMPLE_LINE);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [voiced, setVoiced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let audio: HTMLAudioElement | null = null;
    const live = signal.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track("sample_played");
    setMood("speaking");

    void fetch("/marketing/sample-line.json")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((body: unknown) => {
        if (cancelled) return;
        const manifest = isManifest(body) ? body : null;
        const timings = manifest?.words ?? estimateWordTimings(SAMPLE_LINE, { wpm: 158 });
        const spans = spansFromTimings(timings);
        const end = readingEndMs(timings) + 350;
        let clock: () => number;
        const source = manifest?.audio?.webm ?? manifest?.audio?.m4a;
        if (source) {
          audio = new Audio();
          audio.preload = "none";
          const canWebm = audio.canPlayType('audio/webm; codecs="opus"') !== "";
          audio.src =
            canWebm && manifest?.audio?.webm
              ? manifest.audio.webm
              : (manifest?.audio?.m4a ?? source);
          void audio.play().catch(() => {});
          setVoiced(true);
          const element = audio;
          clock = () => element.currentTime * 1000;
        } else {
          const start = performance.now();
          clock = () => performance.now() - start;
        }
        const tick = () => {
          const ms = clock();
          const spoken = spokenWordCount(timings, ms);
          wordRefs.current.forEach((word, index) => {
            if (word) word.style.opacity = index < spoken || still ? "1" : "0.25";
          });
          const envelope = manifest?.envelope;
          if (envelope) {
            const index = Math.min(
              envelope.amplitude.length - 1,
              Math.floor((ms / 1000) * envelope.hz),
            );
            signal.current.amplitude = envelope.amplitude[index] ?? 0;
            signal.current.centroid = envelope.centroid[index] ?? 0;
            signal.current.pitchDelta = envelope.pitchDelta[index] ?? 0;
          } else Object.assign(signal.current, syntheticSignalAt(spans, ms, 3));
          if (ms >= end) {
            Object.assign(signal.current, SILENT);
            setMood("idle");
            dispatch({
              type: "sample_line",
              line: { line: SAMPLE_LINE, source: "sample", removed: 0 },
            });
            return;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      audio?.pause();
      Object.assign(live, SILENT);
      setMood("idle");
    };
  }, [dispatch, signal, setMood]);

  return (
    <>
      <p className="max-w-[34rem] text-base text-text" role="status">
        {voiced ? SAMPLE_LABEL.voiced : SAMPLE_LABEL.silent}
      </p>
      <div className="mt-3">
        <button type="button" className={TEXT_BUTTON} onClick={() => dispatch({ type: "reset" })}>
          {HERO_ACTIONS.ownLine}
        </button>
      </div>
      <div className="hero-center">
        <p className={TRANSCRIPT}>
          <span className="sr-only">{SAMPLE_LINE}</span>
          <span aria-hidden="true">
            {words.map((word, index) => (
              <span key={`${word}-${index}`}>
                <span
                  ref={(element) => {
                    wordRefs.current[index] = element;
                  }}
                  className="opacity-25 transition-opacity duration-(--spring-snap-duration) ease-snap"
                >
                  {word}
                </span>
                {index < words.length - 1 ? " " : null}
              </span>
            ))}
          </span>
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Write instead.

function Writer({ state, dispatch, setIdentity }: HeroExperienceProps) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus({ preventScroll: true }), []);
  const notice =
    state.notice === "mic_blocked" || state.notice === "turnstile" || state.notice === "paused"
      ? HERO_NOTICES[state.notice]
      : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = cleanWrittenLine(value);
    if (!cleaned) return field.current?.focus();
    setIdentity(identityFromText([cleaned.line]));
    track("hero_line_placed", { source: "written" });
    dispatch({ type: "submit", line: { line: cleaned.line, source: "written", removed: 0 } });
  };

  return (
    <>
      {notice ? (
        <Notice>{notice}</Notice>
      ) : (
        <p className="max-w-[34rem] text-sm text-text-soft">{HERO_COPY.privacy}</p>
      )}
      <div className="mt-3">
        <button type="button" className={TEXT_BUTTON} onClick={() => dispatch({ type: "reset" })}>
          Cancel
        </button>
      </div>
      <form className="hero-center flex flex-col items-center gap-4" onSubmit={submit}>
        <label htmlFor="hero-write" className="sr-only">
          {WRITE_COPY.label}
        </label>
        <textarea
          id="hero-write"
          ref={field}
          rows={2}
          maxLength={FIRST_LINE_MAX_CHARS}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={WRITE_COPY.placeholder}
          aria-describedby="hero-write-count"
          className="w-full resize-none rounded-plane border border-edge bg-depth/80 px-5 py-3 text-center font-reading text-[2rem] leading-[1.25] text-text backdrop-blur-sm placeholder:text-text-soft max-sm:text-[1.5rem]"
        />
        <div className="flex items-center gap-4">
          <span id="hero-write-count" className="text-sm text-text-soft tabular-nums">
            {value.length}/{FIRST_LINE_MAX_CHARS}
          </span>
          <button type="submit" className={PRIMARY}>
            {HERO_ACTIONS.place}
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The placement: the line becomes light, the sheet rises, the words land, the caption.

function Placement({
  state,
  dispatch,
  signal,
  identity,
  line,
  leaving,
  onLeave,
  onGone,
}: HeroExperienceProps & {
  line: PlacedLine;
  leaving: boolean;
  onLeave: () => void;
  onGone: () => void;
}) {
  const router = useRouter();
  const words = splitWords(line.line);
  const fromRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const toRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const placed = state.phase === "placed";
  const sample = line.source === "sample";

  // The choreography, once, on mount (direction §4.2 steps 5–8, about 1.6 s in all).
  useLayoutEffect(() => {
    const abort = new AbortController();
    const still = prefersStill();
    const snap = readSpring("snap");
    const glide = readSpring("glide");
    const drift = readSpring("drift");
    const sheetEl = sheet.current;
    const captionEl = caption.current;
    if (!sheetEl || !captionEl) return;

    const land = () => {
      if (abort.signal.aborted) return;
      lineRef.current?.setAttribute("data-lit", "");
      captionEl.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: glide.ms,
        easing: glide.easing,
        fill: "both",
      });
      captionEl.style.visibility = "visible";
      setAnnouncement(placedAnnouncement(line.line));
      dispatch({ type: "landed" });
      requestAnimationFrame(() => keepRef.current?.focus({ preventScroll: true }));
    };

    if (still) {
      for (const word of toRefs.current) if (word) word.style.opacity = "1";
      for (const word of fromRefs.current) if (word) word.style.opacity = "0";
      sheetEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "both" });
      land();
      return () => abort.abort();
    }

    // 5. Each word takes the --voice glow, 40 ms apart; the form takes one bright breath.
    fromRefs.current.forEach((word, index) => {
      if (!word) return;
      word.style.transitionDelay = `${index * 40}ms`;
      word.setAttribute("data-glow", "");
    });
    const breathStart = performance.now();
    let breath = 0;
    const breathe = () => {
      const t = (performance.now() - breathStart) / 300;
      signal.current.amplitude = t < 1 ? Math.sin(Math.PI * t) * 0.9 : 0;
      if (t < 1) breath = requestAnimationFrame(breathe);
    };
    breath = requestAnimationFrame(breathe);
    abort.signal.addEventListener("abort", () => cancelAnimationFrame(breath));

    // 6. The sheet rises on drift.
    const riseDelay = Math.min(300, words.length * 40) + snap.ms * 0.4;
    sheetEl.animate(
      [
        { transform: "translateY(110%)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: drift.ms, easing: drift.easing, delay: riseDelay, fill: "both" },
    );

    // 7. The words fly in, 40 ms apart, once the sheet has nearly settled.
    const flightsAt = riseDelay + drift.ms * 0.75;
    const flights = words.map((_, index) => {
      const from = fromRefs.current[index];
      const to = toRefs.current[index];
      if (!from || !to) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          void flyWord(from, to, index * 40, drift, abort.signal).then(resolve, resolve);
        }, flightsAt);
        abort.signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          resolve();
        });
      });
    });
    void Promise.all(flights).then(land);
    return () => abort.abort();
    // The choreography runs once per placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Say it again" or Escape: the sheet reverses on glide and the form returns to idle.
  useEffect(() => {
    if (!leaving) return;
    const glide = readSpring("glide");
    const sheetEl = sheet.current;
    const captionEl = caption.current;
    for (const word of fromRefs.current)
      word?.getAnimations().forEach((animation) => animation.cancel());
    captionEl?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "both" });
    const exit = sheetEl?.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(110%)", opacity: 0 },
      ],
      { duration: glide.ms, easing: glide.easing, fill: "both" },
    );
    const done = () => onGone();
    if (exit) void exit.finished.then(done, done);
    else done();
  }, [leaving, onGone]);

  const keep = () => {
    if (sample) return;
    saveFirstLine({ line: line.line, source: line.source, identity, removedFillers: line.removed });
    track("hero_keep_line");
    startTransition(() => router.push("/sign-in?from=line"));
  };

  const usableVoiceprint = line.source === "voice" && identity !== null;

  return (
    <>
      <div className="hero-center" aria-hidden="true">
        <p className={TRANSCRIPT}>
          <span>
            {words.map((word, index) => (
              <span key={`${word}-${index}`}>
                <span
                  ref={(element) => {
                    fromRefs.current[index] = element;
                  }}
                  className="transition-[text-shadow,color] duration-(--spring-snap-duration) ease-snap data-glow:text-voice data-glow:[text-shadow:0_0_24px_var(--voice-glow)]"
                >
                  {word}
                </span>
                {index < words.length - 1 ? " " : null}
              </span>
            ))}
          </span>
        </p>
      </div>
      <div className="hero-sheet-stack">
        <div
          ref={sheet}
          data-theme="day"
          role="figure"
          aria-label={SHEET_COPY.label}
          className="w-full max-w-[720px] rounded-sheet border border-edge bg-depth px-6 py-6 text-text opacity-0 sm:px-10 sm:py-8"
        >
          <p className="text-sm text-text-soft">{SHEET_COPY.header}</p>
          <SharedElement name={FIRST_LINE_TRANSITION}>
            <p ref={lineRef} className="mt-4 min-h-16 font-reading text-read text-text">
              <span className="hero-line">
                {words.map((word, index) => (
                  <span key={`${word}-${index}`}>
                    <span
                      ref={(element) => {
                        toRefs.current[index] = element;
                      }}
                      style={{ opacity: 0 }}
                    >
                      {word}
                    </span>
                    {index < words.length - 1 ? " " : null}
                  </span>
                ))}
              </span>
            </p>
          </SharedElement>
          <div aria-hidden="true" className="mt-4 flex flex-col gap-[31px] pb-2">
            <span className="block h-px w-full bg-edge" />
            <span className="block h-px w-full bg-edge" />
            <span className="block h-px w-11/12 bg-edge" />
            <span className="hero-ruled-extra block h-px w-full bg-edge" />
            <span className="hero-ruled-extra block h-px w-3/5 bg-edge" />
          </div>
        </div>
        <div ref={caption} className="invisible w-full max-w-[720px] text-center">
          <p className="text-base text-text">{sample ? CAPTION_COPY.sample : CAPTION_COPY.line}</p>
          {!sample && line.removed > 0 ? (
            <p className="mt-1 text-sm text-text-soft">{fillersLine(line.removed)}</p>
          ) : null}
          {usableVoiceprint ? (
            <p className="mt-1 text-sm text-text-soft">{CAPTION_COPY.voiceprint}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {sample ? (
              <>
                <button
                  ref={keepRef}
                  type="button"
                  className={PRIMARY}
                  onClick={onLeave}
                  disabled={!placed}
                >
                  {HERO_ACTIONS.ownLine}
                </button>
                <Link
                  href="/sign-in"
                  className={GHOST}
                  data-track="cta_start_free"
                  data-track-location="hero"
                >
                  {START_FREE}
                </Link>
              </>
            ) : (
              <>
                <button
                  ref={keepRef}
                  type="button"
                  className={PRIMARY}
                  onClick={keep}
                  disabled={!placed}
                >
                  {HERO_ACTIONS.keep}
                </button>
                <button type="button" className={GHOST} onClick={onLeave} disabled={!placed}>
                  {HERO_ACTIONS.again}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
