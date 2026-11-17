"use client";

// The Voiceprint form (spec §6.2) as a still SVG drawn from the identity's numbers. The WebGL
// renderer that used to take over from it (OGL, with GPU tiering through detect-gpu) is gone
// (SPEC §9.1, Manu 2026-11-17: no WebGL anywhere): the Studio draws the applicant's voice as the
// 2-D Voiceline instead, and the remaining callers (the kit's assembly and the duet prototype) keep
// this still until their own phases redraw them. The props are unchanged so callers need not move.

import { cx } from "../lib/cx";
import type { VoiceprintProps } from "./types";
import { VoiceprintStill } from "./voiceprint-still";

export function Voiceprint({
  identity,
  mood = "idle",
  size,
  tone = "voice",
  label,
  className,
}: VoiceprintProps) {
  const dimension = size === "fill" ? "100%" : size;
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cx("relative", className)}
      style={{ width: dimension, height: dimension }}
    >
      <VoiceprintStill identity={identity} size="fill" tone={tone} mood={mood} label="" />
    </div>
  );
}
