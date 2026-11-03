"use client";

// The live mock interview (spec §6.7 "Live mock", §6.10 J, §5.12): two Voiceprints facing each
// other in a dim room, yours in your hue and the interviewer's in neutral silver. Each responds
// to whoever is speaking: the speaker's form speaks and comes forward, the listener calms and
// faintly echoes the voice it is hearing. Captions are Newsreader, the interviewer's in silver
// and yours in your hue. Nothing else is on screen except the session line and the controls.
//
// Live signals are read every animation frame and never pass through React state.

import type { Icon } from "@phosphor-icons/react";
import {
  ClosedCaptioningIcon,
  HandPalmIcon,
  MicrophoneSlashIcon,
  PauseIcon,
  PhoneDisconnectIcon,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { buttonStyles } from "../components/button-styles";
import { cx } from "../lib/cx";
import { useMotionToken } from "../motion";
import type { LiveVoiceSignal, VoiceSignalRef, VoiceprintIdentity } from "../voiceprint/types";
import { Voiceprint } from "../voiceprint/voiceprint";
import {
  RESONANCE_GAIN,
  duetMoods,
  elapsedDateTime,
  formatElapsed,
  resonate,
  type DuetSpeaker,
} from "./duet-logic";

const SILENCE: LiveVoiceSignal = { amplitude: 0, centroid: 0, pitchDelta: 0 };

export interface DuetParty {
  identity: VoiceprintIdentity;
  signal?: VoiceSignalRef | null;
  /** Accessible name of the form, e.g. "Your Voiceprint". */
  label: string;
}

export interface DuetStageProps {
  you: DuetParty;
  interviewer: DuetParty;
  speaker: DuetSpeaker;
  /** Both forms rest while the mock is paused. */
  paused?: boolean;
  /** The session line (DuetHeader). */
  header?: ReactNode;
  /** The caption lines (DuetCaptions). */
  captions?: ReactNode;
  /** The control bar (DuetControls). */
  controls?: ReactNode;
  /** Turn changes for screen readers ("The interviewer asks: …", "Paused"). Announced politely. */
  status?: string;
  className?: string;
}

export function DuetStage({
  you,
  interviewer,
  speaker,
  paused = false,
  header,
  captions,
  controls,
  status,
  className,
}: DuetStageProps) {
  const reduced = useReducedMotion();
  const moods = duetMoods(speaker, paused);
  const yourMix = useRef<LiveVoiceSignal>({ ...SILENCE });
  const theirMix = useRef<LiveVoiceSignal>({ ...SILENCE });

  // The listener echoes the speaker. Reduced motion needs none of this: both forms are still.
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const tick = () => {
      const yours = you.signal?.current ?? SILENCE;
      const theirs = interviewer.signal?.current ?? SILENCE;
      if (paused) {
        yourMix.current = { ...SILENCE };
        theirMix.current = { ...SILENCE };
      } else {
        yourMix.current = resonate(yours, theirs, speaker === "interviewer" ? RESONANCE_GAIN : 0);
        theirMix.current = resonate(theirs, yours, speaker === "you" ? RESONANCE_GAIN : 0);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, paused, speaker, you.signal, interviewer.signal]);

  return (
    <section aria-label="Live mock" className={cx("relative flex flex-1 flex-col", className)}>
      {header}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6 sm:gap-10 sm:px-8">
        {/* The dim room: a soft falloff towards the edges, in Night only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 night:bg-[radial-gradient(ellipse_at_50%_42%,transparent_35%,rgb(2_3_12/0.55)_100%)]"
        />
        <div className="relative grid w-full max-w-5xl grid-rows-2 items-center gap-2 sm:grid-cols-2 sm:grid-rows-1 sm:gap-8">
          <DuetForm
            party={interviewer}
            signal={reduced ? interviewer.signal : theirMix}
            tone="silver"
            mood={moods.interviewer}
            forward={speaker === "interviewer" && !paused}
          />
          <DuetForm
            party={you}
            signal={reduced ? you.signal : yourMix}
            tone="voice"
            mood={moods.you}
            forward={speaker === "you" && !paused}
          />
        </div>
        {captions}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
      {controls}
    </section>
  );
}

const GLOWS: Record<"voice" | "silver", string> = {
  voice: "var(--voice-glow)",
  silver: "color-mix(in srgb, var(--silver) 16%, transparent)",
};

function DuetForm({
  party,
  signal,
  tone,
  mood,
  forward,
}: {
  party: DuetParty;
  signal: VoiceSignalRef | null | undefined;
  tone: "voice" | "silver";
  mood: ReturnType<typeof duetMoods>["you"];
  forward: boolean;
}) {
  const reduced = useReducedMotion();
  const drift = useMotionToken("drift");
  return (
    <motion.div
      data-party={tone === "silver" ? "interviewer" : "you"}
      data-mood={mood}
      className="relative mx-auto aspect-square w-[min(44vw,28dvh,24rem)] sm:w-[min(34vw,50dvh,24rem)]"
      // The speaker comes forward; the listener settles back. Still with reduced motion.
      initial={false}
      animate={reduced ? undefined : { scale: forward ? 1 : 0.9 }}
      transition={drift}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[18%] rounded-full transition-opacity duration-(--spring-settle-duration) ease-settle"
        style={
          {
            background: `radial-gradient(closest-side, ${GLOWS[tone]}, transparent)`,
            opacity: forward ? 1 : 0.35,
          } as CSSProperties
        }
      />
      <Voiceprint
        identity={party.identity}
        signal={signal}
        mood={mood}
        tone={tone}
        size="fill"
        label={party.label}
      />
    </motion.div>
  );
}

export interface DuetHeaderProps {
  /** "Northfield mock". The page's main heading. */
  title: string;
  /** Persona, format and length, each its own item: no joined meta strings (spec §6.1). */
  details: readonly string[];
  elapsedMs: number;
  className?: string;
}

export function DuetHeader({ title, details, elapsedMs, className }: DuetHeaderProps) {
  return (
    <div
      className={cx(
        "relative flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 sm:px-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <ul aria-label="About this mock" className="flex flex-wrap gap-x-4 text-sm text-text-soft">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </div>
      <p className="text-lg text-text tabular-nums">
        <span className="sr-only">Time elapsed: </span>
        {/* role="timer" is not announced as it ticks. */}
        <time role="timer" dateTime={elapsedDateTime(elapsedMs)}>
          {formatElapsed(elapsedMs)}
        </time>
      </p>
    </div>
  );
}

export interface DuetCaptionsProps {
  /** The interviewer's current or last line, typically <TimedText upcoming="hidden">. */
  interviewer?: ReactNode;
  /** Your current or last line. */
  you?: ReactNode;
  /** Captions off: the lines keep their space so nothing on the stage jumps. */
  hidden?: boolean;
  className?: string;
}

export function DuetCaptions({ interviewer, you, hidden = false, className }: DuetCaptionsProps) {
  return (
    <div
      data-captions={hidden ? "off" : "on"}
      className={cx(
        "relative flex w-full max-w-3xl flex-col gap-3 font-reading text-read-lg sm:gap-4 sm:text-[length:1.625rem] sm:leading-[1.3]",
        hidden && "invisible",
        className,
      )}
    >
      <p className="min-h-[2lh] text-silver">
        <span className="sr-only">Interviewer: </span>
        {interviewer}
      </p>
      <p className="min-h-[2lh] text-voice">
        <span className="mr-2 font-ui text-base text-text-soft">You</span>
        {you}
      </p>
    </div>
  );
}

export interface DuetControlsProps {
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  captionsOn: boolean;
  onCaptionsChange: (on: boolean) => void;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  /** "Need a moment": the interviewer waits until you are ready (spec §7.5). */
  waiting: boolean;
  onWaitingChange: (waiting: boolean) => void;
  onEnd: () => void;
  className?: string;
}

/**
 * The only controls in the room (spec §6.10 J). The four toggles keep their names and say whether
 * they are on with aria-pressed (and a filled icon), so a screen reader hears "Mute, pressed".
 */
export function DuetControls({
  muted,
  onMutedChange,
  captionsOn,
  onCaptionsChange,
  paused,
  onPausedChange,
  waiting,
  onWaitingChange,
  onEnd,
  className,
}: DuetControlsProps) {
  return (
    <div
      role="group"
      aria-label="Mock controls"
      className={cx(
        "relative flex flex-wrap items-center justify-center gap-2 px-4 pt-2 pb-6 sm:gap-3 sm:px-8",
        className,
      )}
    >
      <ControlToggle icon={MicrophoneSlashIcon} pressed={muted} onChange={onMutedChange}>
        Mute
      </ControlToggle>
      <ControlToggle icon={ClosedCaptioningIcon} pressed={captionsOn} onChange={onCaptionsChange}>
        Captions on
      </ControlToggle>
      <ControlToggle icon={PauseIcon} pressed={paused} onChange={onPausedChange}>
        Pause
      </ControlToggle>
      <ControlToggle icon={HandPalmIcon} pressed={waiting} onChange={onWaitingChange}>
        Need a moment
      </ControlToggle>
      <button
        type="button"
        onClick={onEnd}
        className={cx(buttonStyles({ variant: "secondary" }), "sm:ml-4")}
      >
        <PhoneDisconnectIcon size={20} aria-hidden />
        End
      </button>
    </div>
  );
}

function ControlToggle({
  icon: ToggleIcon,
  pressed,
  onChange,
  children,
}: {
  icon: Icon;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cx(
        "relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control px-4 text-base font-medium whitespace-nowrap",
        "text-text-soft transition-colors duration-(--spring-snap-duration) ease-snap hover:bg-veil hover:text-text",
        "aria-pressed:bg-veil aria-pressed:text-signal",
      )}
    >
      <ToggleIcon size={20} weight={pressed ? "fill" : "regular"} aria-hidden />
      {children}
    </button>
  );
}
