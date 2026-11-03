"use client";

// The record button (spec §6.8): idle, listening, processing, error. A circle (spec §6.5) whose
// ring follows the speaker's amplitude while listening, read from the live signal every animation
// frame and moved on the snap spring, never through React state. Built with SVG icons and Motion
// rather than Rive: there is no Rive asset yet (a recorded Phase 0.5 deviation).

import type { Icon } from "@phosphor-icons/react";
import { MicrophoneIcon, StopIcon, WarningIcon, WaveformIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useId, useRef, type MouseEvent } from "react";
import { cx } from "../lib/cx";
import { REDUCED_FADE, spring } from "../motion";
import type { VoiceSignalRef } from "../voiceprint/types";
import { canTalkFrom, isSpaceKey, releaseAction } from "./space-to-talk";
import { followSpring } from "./synthetic-signal";

export type RecordButtonState = "idle" | "listening" | "processing" | "error";

export const RECORD_STATUS: Record<RecordButtonState, string> = {
  idle: "Tap to talk, or hold Space",
  listening: "Listening",
  processing: "Writing down your answer",
  error: "We couldn't hear that. Tap to try again.",
};

const ICONS: Record<RecordButtonState, Icon> = {
  idle: MicrophoneIcon,
  listening: StopIcon,
  processing: WaveformIcon,
  error: WarningIcon,
};

// Day text on --record would be 4.4:1, so --record is a fill with --on-signal icons (tokens.css).
const SURFACES: Record<RecordButtonState, string> = {
  idle: "bg-signal text-on-signal hover:bg-signal/90",
  listening: "bg-record text-on-signal",
  processing: "border border-control bg-depth text-text-soft",
  error: "border-2 border-risk bg-depth text-risk",
};

export interface RecordButtonProps {
  state: RecordButtonState;
  onStart: () => void;
  onStop: () => void;
  /** The microphone's live signal; the ring follows its amplitude while listening. */
  signal?: VoiceSignalRef | null;
  /** Hold Space to talk anywhere on the page, unless focus is in a field or on another control. */
  spaceToTalk?: boolean;
  /** Accessible name. It stays the same in every state; aria-pressed says whether it is on. */
  label?: string;
  /** Replaces the default status line for the current state. Announced politely. */
  status?: string;
  disabled?: boolean;
  className?: string;
}

export function RecordButton({
  state,
  onStart,
  onStop,
  signal,
  spaceToTalk = true,
  label = "Record your answer",
  status,
  disabled = false,
  className,
}: RecordButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const statusId = useId();
  const reduced = useReducedMotion();
  const inactive = disabled || state === "processing";
  const listening = state === "listening";

  // A Space press in progress: when it began and whether it started recording.
  const press = useRef<{ startedAt: number; started: boolean } | null>(null);
  // Space on the focused button would also fire a click on release; that click is ours already.
  const swallowClick = useRef(false);

  const toggle = () => {
    if (inactive) return;
    if (listening) onStop();
    else onStart();
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (swallowClick.current && event.detail === 0) {
      swallowClick.current = false;
      return;
    }
    toggle();
  };

  const keyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isSpaceKey(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (press.current) {
      // Auto-repeat while held: keep the page from scrolling, nothing else.
      event.preventDefault();
      return;
    }
    if (!canTalkFrom(event.target, buttonRef.current)) return;
    event.preventDefault();
    if (event.target === buttonRef.current) swallowClick.current = true;
    if (inactive) return;
    press.current = { startedAt: event.timeStamp, started: !listening };
    if (listening) onStop();
    else onStart();
  });

  const keyUp = useEffectEvent((event: KeyboardEvent) => {
    if (!isSpaceKey(event) || !press.current) return;
    event.preventDefault();
    const { startedAt, started } = press.current;
    press.current = null;
    window.setTimeout(() => (swallowClick.current = false), 0);
    if (started && releaseAction(event.timeStamp - startedAt) === "stop") onStop();
  });

  // Losing the window mid-hold means the release will never arrive: treat it as one.
  const blur = useEffectEvent(() => {
    const held = press.current;
    press.current = null;
    if (held?.started) onStop();
  });

  useEffect(() => {
    if (!spaceToTalk) return;
    const down = (event: KeyboardEvent) => keyDown(event);
    const up = (event: KeyboardEvent) => keyUp(event);
    const lost = () => blur();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", lost);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", lost);
    };
  }, [spaceToTalk]);

  // The ring follows amplitude while listening. With reduced motion it only brightens and dims.
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring || !listening || !signal) return;
    let frame = 0;
    let last = performance.now();
    let follow = { value: 0, velocity: 0 };
    const tick = (now: number) => {
      follow = followSpring(follow, signal.current.amplitude, (now - last) / 1000, "snap");
      last = now;
      const level = Math.min(1, Math.max(0, follow.value));
      ring.style.opacity = String(0.3 + level * 0.7);
      if (!reduced) ring.style.transform = `scale(${1 + level * 0.4})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ring.style.removeProperty("opacity");
      ring.style.removeProperty("transform");
    };
  }, [listening, signal, reduced]);

  const StateIcon = ICONS[state];
  const iconMotion = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.6 },
      };

  return (
    <div className={cx("flex flex-col items-center gap-3", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-pressed={listening}
        aria-describedby={statusId}
        aria-disabled={inactive || undefined}
        aria-keyshortcuts={spaceToTalk ? "Space" : undefined}
        data-state={state}
        onClick={onClick}
        className={cx(
          "relative grid size-20 shrink-0 place-items-center rounded-full",
          "transition-colors duration-(--spring-snap-duration) ease-snap",
          "aria-disabled:cursor-not-allowed",
          SURFACES[state],
        )}
      >
        <span
          ref={ringRef}
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute -inset-2 rounded-full border-2 will-change-transform",
            "transition-[border-color,opacity] duration-(--spring-snap-duration) ease-snap",
            listening && "border-record opacity-60",
            state === "processing" && "border-control opacity-60",
            (state === "idle" || state === "error") && "border-transparent opacity-0",
          )}
        />
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            className="grid place-items-center"
            transition={reduced ? REDUCED_FADE : spring("snap")}
            {...iconMotion}
          >
            <StateIcon size={32} weight={listening ? "fill" : "regular"} aria-hidden />
          </motion.span>
        </AnimatePresence>
      </button>
      <p id={statusId} role="status" className="min-h-[1lh] text-center text-sm text-text-soft">
        {status ?? RECORD_STATUS[state]}
      </p>
    </div>
  );
}
