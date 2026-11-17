"use client";

// The Studio's horizon (SPEC §6.4): one hairline across the room that answers your voice. At rest
// it lies flat in --line-strong. While the applicant speaks it turns their hue and moves with the
// real microphone level, growing outwards from the record button; while a question is read aloud
// it moves in --silver on a synthetic level. The shape is the hero's (two sines and a little value
// noise), set by the applicant's Voiceprint numbers: pitch the wavelength, pace the second
// frequency, range the amplitude.
//
// One canvas stroke a frame, a point every 4 px. The loop runs only while someone is speaking or
// the line is settling back, and stops while the tab is hidden. Reduced motion: the line never
// moves; it only takes the speaker's colour.

import type { VoiceprintIdentity } from "@admitstory/shared";
import { useEffect, useRef } from "react";
import { cx } from "../lib/cx";
import type { VoiceSignalRef } from "../voiceprint/types";
import { followSpring, type SpringState } from "./synthetic-signal";

export type VoicelineSpeaker = "none" | "you" | "reader";

export interface StudioVoicelineProps {
  /** The microphone's live signal while the applicant speaks. */
  signal: VoiceSignalRef | null;
  speaker: VoicelineSpeaker;
  identity: VoiceprintIdentity;
  className?: string;
}

const STROKE = 1.25;
const SPREAD_MS = 600;
const FADE_MS = 250;
const TAU = Math.PI * 2;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
function smoothstep(from: number, to: number, x: number): number {
  const p = clamp01((x - from) / (to - from));
  return p * p * (3 - 2 * p);
}
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43_758.5453;
  return x - Math.floor(x);
}
/** 1-D value noise, −1 to 1. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}
/** easeOutQuint-like rise for the spread and the colour fade (the --ease-rise family). */
const rise = (p: number) => 1 - (1 - clamp01(p)) ** 4;

/** The line's form from the Voiceprint numbers (SPEC §9.1). */
export function voicelineForm(identity: VoiceprintIdentity) {
  const pitch = clamp01((identity.avgPitchHz - 80) / 220);
  const pace = clamp01((identity.paceWpm - 100) / 100);
  const range = clamp01((identity.pitchRangeSemitones - 2) / 14);
  return { wavelength: 170 - pitch * 60, second: 60 - pace * 16, gain: 0.8 + range * 0.35 };
}

export function StudioVoiceline({ signal, speaker, identity, className }: StudioVoicelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Everything the frame loop reads lives here, so a new prop never restarts the loop.
  const live = useRef({ signal, speaker, form: voicelineForm(identity) });
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    live.current = { signal, speaker, form: voicelineForm(identity) };
    wake.current();
  }, [signal, speaker, identity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let t = 0;
    let level: SpringState = { value: 0, velocity: 0 };
    /** 0–1: how far the live part has spread from the button, and how present its colour is. */
    let spread = 0;
    let presence = 0;
    let colours = { rest: "", you: "", reader: "" };
    let active: VoicelineSpeaker = "none";

    function readColours() {
      const style = getComputedStyle(surface);
      colours = {
        rest: style.getPropertyValue("--line-strong").trim() || "rgb(244 241 234 / 0.2)",
        you: style.getPropertyValue("--voice").trim() || "#e2b36b",
        reader: style.getPropertyValue("--silver").trim() || "#c9c5bc",
      };
    }

    function resize() {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = surface.clientWidth;
      height = surface.clientHeight;
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function flat(colour: string, alpha: number) {
      if (alpha <= 0.001) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = STROKE;
      ctx.lineJoin = "round";
      const colour = active === "reader" ? colours.reader : colours.you;
      if (still.matches) {
        flat(active === "none" ? colours.rest : colour, 1);
        return;
      }
      const shown = rise(presence);
      flat(colours.rest, 1 - shown);
      if (presence <= 0.001) return;
      const { form } = live.current;
      const half = width / 2;
      const reach = Math.max(1, half * rise(spread));
      const amp =
        (width < 640 ? 22 : 34) * form.gain * clamp01(level.value) * (active === "reader" ? 0.55 : 1);
      const mid = height / 2;
      const count = Math.min(360, Math.max(48, Math.ceil(width / 4)));
      ctx.globalAlpha = shown;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      for (let i = 0; i <= count; i += 1) {
        const px = (width * i) / count;
        const d = Math.abs(px - half);
        const envelope = (1 - smoothstep(0.3 * reach, reach, d)) * (1 - smoothstep(0.92 * half, half, d));
        const y =
          envelope === 0
            ? 0
            : envelope *
              (0.55 * Math.sin(TAU * (d / form.wavelength - 0.6 * t)) +
                0.3 * Math.sin(TAU * (px / form.second + 1.1 * t) + 1.7) +
                0.15 * noise(px / 18 + 2.4 * t));
        if (i === 0) ctx.moveTo(px, mid + amp * y);
        else ctx.lineTo(px, mid + amp * y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function target(now: number): number {
      const { speaker: who, signal: source } = live.current;
      if (who === "you") return clamp01(source?.current.amplitude ?? 0);
      if (who === "reader") return 0.35 + 0.35 * (0.5 + 0.5 * noise(now / 600));
      return 0;
    }

    function tick(now: number) {
      frame = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const who = live.current.speaker;
      if (who !== "none") active = who;
      const on = who !== "none";
      spread = on ? Math.min(1, spread + (dt * 1000) / SPREAD_MS) : spread;
      presence = clamp01(presence + ((on ? 1 : -1) * dt * 1000) / FADE_MS);
      level = followSpring(level, target(now), dt, "snap");
      draw();
      const settled = !on && presence === 0 && Math.abs(level.value) < 0.002;
      if (settled) {
        spread = 0;
        active = "none";
        level = { value: 0, velocity: 0 };
        draw();
        return;
      }
      if (!document.hidden) frame = requestAnimationFrame(tick);
    }

    function start() {
      if (live.current.speaker !== "none") readColours();
      if (still.matches) {
        active = live.current.speaker;
        draw();
        return;
      }
      if (frame || document.hidden) return;
      if (live.current.speaker === "none" && presence === 0) {
        draw();
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    wake.current = start;
    readColours();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    start();
    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      wake.current = () => {};
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-speaker={speaker}
      className={cx("pointer-events-none block size-full", className)}
    />
  );
}
