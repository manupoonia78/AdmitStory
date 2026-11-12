"use client";

// Everything the hero does after the first tap (direction §4.2, plan §9.1.3–6), loaded lazily by
// ./hero-stage. Each phase renders into the actions box (which keeps its height) and, where the
// moment needs it, into absolutely placed layers over the stage, so nothing below ever moves:
//
//   sample       the fictional applicant's line, its words brightening on their timings
//   writing      a two-line field for the visitor's own line
//   placing      the words glow, an essay sheet rises, and each word flies into its first line
//   placed       the caption, then "Write your own line" or "Sign up and keep this line"
//
// Escape interrupts any of it. Nothing the visitor writes leaves this browser; the line is kept
// only on "keep".

import {
  SharedElement,
  buttonStyles,
  cx,
  estimateWordTimings,
  identityFromText,
  spansFromTimings,
  spokenWordCount,
  readingEndMs,
  splitWords,
  syntheticSignalAt,
  type LiveVoiceSignal,
  type VoiceSignalRef,
  type VoiceprintIdentity,
  type VoiceprintMood,
  type WordTiming,
} from "@admitstory/ui";
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
  SAMPLE_LABEL,
  SHEET_COPY,
  WRITE_COPY,
  placedAnnouncement,
} from "../_copy/hero";
import { START_FREE } from "../_copy/shared";
import { SAMPLE_LINE } from "../_data/sample";
import { track } from "../_lib/track";
import { flyWord, prefersStill, readSpring } from "./hero-motion";
import { INTERRUPTIBLE, type HeroAction, type HeroState, type PlacedLine } from "./hero-state";
import { ACTIONS_BOX } from "./hero-ui";
import { cleanWrittenLine } from "./line-cleanup";

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

/** Where the sheet goes when it leaves: back to idle, or on to the field for the visitor's line. */
type LeaveTo = "idle" | "writing";

export default function HeroExperience(props: HeroExperienceProps) {
  const { state, dispatch } = props;
  const [leaving, setLeaving] = useState<LeaveTo | null>(null);

  // Escape interrupts from wherever the moment has got to (while focus is in the hero or nowhere).
  const interrupt = useEffectEvent(() => {
    if (!INTERRUPTIBLE.has(state.phase)) return;
    if (state.phase === "placing" || state.phase === "placed") setLeaving("idle");
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

  return (
    <div className={ACTIONS_BOX}>
      {state.phase === "sample" ? <SamplePlayer {...props} /> : null}
      {state.phase === "writing" ? <Writer {...props} /> : null}
      {(state.phase === "placing" || state.phase === "placed") && state.line ? (
        <Placement
          {...props}
          line={state.line}
          leaving={leaving !== null}
          onLeave={setLeaving}
          onGone={() => {
            const next = leaving;
            setLeaving(null);
            dispatch({ type: "reset" });
            if (next === "writing") dispatch({ type: "write" });
          }}
        />
      ) : null}
    </div>
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
        <button type="button" className={TEXT_BUTTON} onClick={() => dispatch({ type: "write" })}>
          {HERO_ACTIONS.write}
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
// The visitor's own line.

function Writer({ dispatch, setIdentity }: HeroExperienceProps) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus({ preventScroll: true }), []);

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
      <p className="max-w-[34rem] text-sm text-text-soft">{HERO_COPY.writeNote}</p>
      <div className="mt-3">
        <button type="button" className={TEXT_BUTTON} onClick={() => dispatch({ type: "reset" })}>
          {HERO_ACTIONS.cancel}
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
  onLeave: (to: LeaveTo) => void;
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

  // "Try another line", "Write your own line" or Escape: the sheet reverses on glide and the form returns to idle.
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {sample ? (
              <>
                <button
                  ref={keepRef}
                  type="button"
                  className={PRIMARY}
                  onClick={() => onLeave("writing")}
                  disabled={!placed}
                >
                  {HERO_ACTIONS.write}
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
                <button
                  type="button"
                  className={GHOST}
                  onClick={() => onLeave("writing")}
                  disabled={!placed}
                >
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
