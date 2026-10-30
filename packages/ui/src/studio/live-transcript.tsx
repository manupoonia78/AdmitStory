"use client";

// The live transcript under the record button (spec §5.2, §6.4). Speech-to-text sends interim
// results that grow and are revised, then a final result per utterance; each becomes a segment.
// Interim words show at 40% opacity and weight 500, settling to full opacity and weight 400 when
// final. New words arrive in the phrase-sized groups STT sends and fade in together, never
// character by character. While someone speaks, the interim line's weight follows their voice
// (±60, spec §6.4).
//
// The visible text is decorative for assistive technology: a polite live log beside it receives
// each segment once it is final, so a screen reader hears whole sentences, not every revision.

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../lib/cx";
import type { VoiceSignalRef } from "../voiceprint/types";
import { CAPTURE_SOURCE_ATTRIBUTE } from "./capture-source";
import { followSpring } from "./synthetic-signal";
import { splitWords } from "./word-timing";

export interface TranscriptSegment {
  /** Stable across interim revisions and the final result of the same utterance. */
  id: string;
  text: string;
  final: boolean;
}

export interface LiveTranscriptProps {
  segments: readonly TranscriptSegment[];
  /** Segments lit in the applicant's hue: a story was just found in them (spec §6.7). */
  ignitedIds?: ReadonlySet<string>;
  /** The speaker's live signal; the interim line's weight follows its amplitude. */
  signal?: VoiceSignalRef | null;
  /** Name of the live log for screen readers. */
  label?: string;
  /** Shown while there are no segments. */
  empty?: ReactNode;
  className?: string;
}

/** Interim weight for a smoothed amplitude: 500 ± 60 (spec §6.4). */
export function interimWeight(amplitude: number): number {
  const a = Math.min(1, Math.max(0, amplitude));
  return Math.round(500 + (a * 2 - 1) * 60);
}

const NO_IGNITION: ReadonlySet<string> = new Set();

export function LiveTranscript({
  segments,
  ignitedIds = NO_IGNITION,
  signal,
  label = "Live transcript",
  empty,
  className,
}: LiveTranscriptProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();

  // Voice-driven weight: written straight to a CSS variable each frame, never React state.
  useEffect(() => {
    const element = textRef.current;
    if (!signal || reduced || !element) return;
    let frame = 0;
    let last = performance.now();
    let state = { value: 0.5, velocity: 0 };
    let written = 0;
    const tick = (now: number) => {
      state = followSpring(state, signal.current.amplitude, (now - last) / 1000, "snap");
      last = now;
      const weight = interimWeight(state.value);
      if (weight !== written) {
        element.style.setProperty("--interim-weight", String(weight));
        written = weight;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.style.removeProperty("--interim-weight");
    };
  }, [signal, reduced]);

  const finals = segments.filter((segment) => segment.final);

  return (
    <div className={cx("relative", className)}>
      {segments.length === 0 && empty ? (
        <div className="absolute inset-x-0 bottom-0 text-text-soft">{empty}</div>
      ) : null}
      {/* Bottom-aligned and clipped: new lines push old ones up under a soft fade, and the
          region never changes size. */}
      <div
        aria-hidden="true"
        className="flex h-full flex-col justify-end overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]"
      >
        <p ref={textRef} className="font-ui text-read-lg text-text">
          {segments.map((segment) => (
            <SegmentText key={segment.id} segment={segment} ignited={ignitedIds.has(segment.id)} />
          ))}
        </p>
      </div>
      <div role="log" aria-live="polite" aria-label={label} className="sr-only">
        {finals.map((segment) => (
          <p key={segment.id}>{segment.text}</p>
        ))}
      </div>
    </div>
  );
}

function SegmentText({ segment, ignited }: { segment: TranscriptSegment; ignited: boolean }) {
  const words = splitWords(segment.text);
  return (
    <>
      <span
        {...{ [CAPTURE_SOURCE_ATTRIBUTE]: segment.id }}
        data-final={segment.final ? "" : undefined}
        data-ignited={ignited ? "" : undefined}
        className={cx(
          "rounded-control box-decoration-clone transition-[color,background-color,text-shadow] duration-(--spring-snap-duration) ease-snap",
          ignited && "bg-voice-glow text-voice [text-shadow:0_0_24px_var(--voice-glow)]",
        )}
      >
        {words.map((word, index) => (
          // The outer span fades the arriving phrase in; the inner one settles interim → final.
          <span key={index} className="animate-fade-in">
            <span
              data-interim={segment.final ? undefined : ""}
              className={cx(
                "duration-(--spring-glide-duration) ease-glide",
                segment.final
                  ? "font-normal opacity-100 transition-[opacity,font-weight] motion-reduce:transition-opacity"
                  : "[font-weight:var(--interim-weight,500)] opacity-40 transition-opacity",
              )}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>{" "}
    </>
  );
}
