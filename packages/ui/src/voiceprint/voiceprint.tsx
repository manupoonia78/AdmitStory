"use client";

// The living Voiceprint (spec §6.2). It always renders the still SVG first (server render, tier 1
// and while WebGL loads), then, at tiers 2 and 3, lazy-loads the OGL renderer after mount and
// crossfades the canvas in over the still. Both sit in the same fixed box, so nothing around it
// ever moves.

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { paramsFromIdentity } from "./params";
import type { RendererInputs, VoiceprintRenderer } from "./renderer";
import { useTierDetails, type TierDetails } from "./tier";
import type { PerformanceTier, VoiceprintProps } from "./types";
import { VoiceprintStill } from "./voiceprint-still";

/**
 * The tier to draw at. Reduced motion always wins, even over a forced tier: the Voiceprint is
 * completely still (spec §6.6). A forced live tier without WebGL falls back to the still.
 */
export function resolveTier(details: TierDetails, forced?: PerformanceTier): PerformanceTier {
  if (details.inputs.reducedMotion) return 1;
  if (forced === undefined) return details.tier;
  return forced > 1 && !details.inputs.webgl ? 1 : forced;
}

// Tier 1's "slow CSS opacity pulse" (spec §6.2), on the settle spring's easing. React hoists
// this <style> into <head> once, however many Voiceprints are on the page.
const PULSE_CLASS = "admitstory-voiceprint-pulse";
const PULSE_CSS = `@keyframes ${PULSE_CLASS}{from{opacity:1}to{opacity:.7}}
.${PULSE_CLASS}{animation:${PULSE_CLASS} calc(var(--spring-settle-duration) * 2.5) var(--spring-settle) infinite alternate}
@media (prefers-reduced-motion: reduce){.${PULSE_CLASS}{animation:none}}`;

type GlState = "loading" | "ready" | "failed";

export function Voiceprint({
  identity,
  signal = null,
  mood = "idle",
  size,
  tone = "voice",
  tier: forcedTier,
  label,
  className,
}: VoiceprintProps) {
  const details = useTierDetails();
  const tier = resolveTier(details, forcedTier);
  const live = tier > 1;
  const [gl, setGl] = useState<GlState>("loading");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<VoiceprintRenderer | null>(null);

  const { avgPitchHz, paceWpm, pitchRangeSemitones, pauseRhythm, source } = identity;
  const params = useMemo(
    () =>
      paramsFromIdentity({
        version: 1,
        avgPitchHz,
        paceWpm,
        pitchRangeSemitones,
        pauseRhythm,
        source,
      }),
    [avgPitchHz, paceWpm, pitchRangeSemitones, pauseRhythm, source],
  );

  const inputs = useMemo<RendererInputs | null>(
    () => (live ? { params, mood, tier: tier as 2 | 3, signal } : null),
    [live, params, mood, tier, signal],
  );
  const latest = useRef(inputs);
  useEffect(() => {
    latest.current = inputs;
    if (inputs) renderer.current?.update(inputs);
  }, [inputs]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let instance: VoiceprintRenderer | null = null;
    import("./renderer")
      .then(({ createVoiceprintRenderer }) => {
        if (cancelled || !host.current || !canvas.current || !latest.current) return;
        try {
          instance = createVoiceprintRenderer(host.current, canvas.current, latest.current, {
            onFirstFrame: () => setGl("ready"),
            onLost: () => setGl("loading"),
          });
          renderer.current = instance;
        } catch {
          setGl("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setGl("failed");
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      renderer.current = null;
      setGl("loading");
    };
  }, [live]);

  const showCanvas = live && gl !== "failed";
  const glVisible = showCanvas && gl === "ready";
  const pulse = !details.inputs.reducedMotion && (tier === 1 || gl === "failed");

  return (
    <div
      ref={host}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-voiceprint=""
      data-renderer={glVisible ? "webgl" : "still"}
      data-tier={tier}
      data-mood={mood}
      className={cx("relative isolate shrink-0", size === "fill" && "size-full", className)}
      style={{
        ...(size === "fill" ? null : { width: size, height: size }),
        color: tone === "silver" ? "var(--silver)" : "var(--voice)",
      }}
    >
      <style href={PULSE_CLASS} precedence="default">
        {PULSE_CSS}
      </style>
      <div
        className={cx(
          "absolute inset-0 transition-opacity duration-(--spring-drift-duration) ease-drift",
          glVisible && "opacity-0",
        )}
      >
        <div className={cx("size-full", pulse && PULSE_CLASS)}>
          <VoiceprintStill identity={identity} size="fill" tone={tone} mood={mood} label="" />
        </div>
      </div>
      {showCanvas ? (
        <canvas
          ref={canvas}
          aria-hidden
          className={cx(
            "absolute inset-0 size-full transition-opacity duration-(--spring-drift-duration) ease-drift",
            glVisible ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
