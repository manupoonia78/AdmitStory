// Server-safe: no hooks beyond useId, so avatars and exports can render it anywhere.
import { useId } from "react";
import { cx } from "../lib/cx";
import { filaments, motes } from "./geometry";
import { paramsFromIdentity } from "./params";
import type { VoiceprintIdentity, VoiceprintMood } from "./types";

export interface VoiceprintStillProps {
  identity: VoiceprintIdentity;
  /** Pixels, or "fill" to fill the parent (which must have a size). */
  size: number | "fill";
  /** "silver" is the interviewer's neutral form; "voice" uses the nearest --voice hue. */
  tone?: "voice" | "silver";
  mood?: VoiceprintMood;
  /** Accessible name. Pass "" when the mark is decorative (an avatar beside the name). */
  label: string;
  className?: string;
}

/**
 * A still render of the Voiceprint (spec §6.2): avatars, kit covers, exports, and the tier 1
 * fallback. Deterministic: the same identity draws the same threads and motes everywhere, and
 * the live WebGL form is built from the same geometry. Colour comes from CSS (--voice or
 * --silver), so it follows the theme and the applicant's chosen hue without re-rendering.
 */
export function VoiceprintStill({
  identity,
  size,
  tone = "voice",
  mood = "idle",
  label,
  className,
}: VoiceprintStillProps) {
  const id = useId();
  const glowId = `${id}-glow`;
  const params = paramsFromIdentity(identity);
  const dimension = size === "fill" ? "100%" : size;
  const seed = mood === "seed";
  return (
    <svg
      viewBox="0 0 100 100"
      width={dimension}
      height={dimension}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-mood={mood}
      data-tone={tone}
      className={cx("block overflow-visible", className)}
      style={{ color: tone === "silver" ? "var(--silver)" : "var(--voice)" }}
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="currentColor" stopOpacity={seed ? 0.35 : 0.7} />
          <stop offset="55%" stopColor="currentColor" stopOpacity={seed ? 0.08 : 0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${glowId})`} />
      <g
        transform={seed ? "translate(50 50) scale(0.55) translate(-50 -50)" : undefined}
        opacity={mood === "listening" ? 0.7 : seed ? 0.5 : 1}
      >
        <g fill="none" stroke="currentColor" strokeWidth={0.6}>
          {filaments(params).map((f, i) => (
            <ellipse
              key={i}
              cx={f.cx}
              cy={f.cy}
              rx={f.rx}
              ry={f.ry}
              strokeOpacity={f.opacity}
              transform={`rotate(${f.rotate} ${f.cx} ${f.cy})`}
            />
          ))}
        </g>
        <g fill="currentColor">
          {motes(params).map((m, i) => (
            <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fillOpacity={m.opacity} />
          ))}
        </g>
      </g>
    </svg>
  );
}
