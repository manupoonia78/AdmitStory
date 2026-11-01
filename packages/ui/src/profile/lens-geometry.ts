// Geometry for the four-lens instrument (spec §6.7 Profile Read). Pure functions, so the dial's
// shape is tested without a DOM and the component only draws what these return.
//
// The dial is one circle cut into four quadrant arcs, never concentric rings (Apple asks that its
// Activity rings are not imitated; docs/design/phase-3-4-direction.md). Angles are degrees
// clockwise from twelve o'clock.

import { LENS_IDS, LENS_LABELS, type CoverageLevel, type LensId } from "@admitstory/shared";
import type { LensReading, LensStory } from "./types";

export const LENS_DIAL = {
  /** viewBox is SIZE × SIZE. */
  size: 200,
  radius: 78,
  stroke: 16,
  /** Gap between quadrants, so the four read as four. */
  quadrantGap: 10,
  /** Gap between the story segments inside an arc. */
  segmentGap: 2.5,
} as const;

/** Lens order around the dial, clockwise from twelve o'clock. */
export const LENS_DIAL_ORDER: readonly LensId[] = LENS_IDS;

/** Level in words, for the Profile Read. "partial" reads as "developing" to an applicant. */
export const LENS_LEVEL_WORDS: Record<CoverageLevel, string> = {
  none: "not shown yet",
  thin: "thin",
  partial: "developing",
  strong: "strong",
};

const LEVEL_FRACTION: Record<CoverageLevel, number> = {
  none: 0,
  thin: 1 / 3,
  partial: 2 / 3,
  strong: 1,
};

/** Share of the lens's quadrant that is filled. */
export function lensFraction(level: CoverageLevel): number {
  return LEVEL_FRACTION[level];
}

export interface LensSegment {
  /** The story it stands for, or null for a level with no stories listed. */
  storyId: string | null;
  start: number;
  end: number;
}

export interface LensArc {
  lens: LensId;
  label: string;
  level: CoverageLevel;
  stories: readonly LensStory[];
  /** The whole quadrant, drawn as the empty track. */
  trackStart: number;
  trackEnd: number;
  /** The filled span: trackStart to fillEnd. */
  fillEnd: number;
  segments: LensSegment[];
}

/**
 * The four arcs in dial order. A lens missing from `readings` is drawn as an empty track. The
 * filled span is split between the lens's stories by weight, with a small gap between them, so
 * the arc is visibly made of the stories behind it.
 */
export function layoutLensDial(readings: readonly LensReading[]): LensArc[] {
  const byLens = new Map(readings.map((reading) => [reading.lens, reading]));
  return LENS_DIAL_ORDER.map((lens, index) => {
    const reading = byLens.get(lens);
    const level = reading?.level ?? "none";
    const stories = reading?.stories ?? [];
    const trackStart = index * 90 + LENS_DIAL.quadrantGap / 2;
    const trackEnd = (index + 1) * 90 - LENS_DIAL.quadrantGap / 2;
    const fillEnd = trackStart + (trackEnd - trackStart) * lensFraction(level);
    return {
      lens,
      label: LENS_LABELS[lens],
      level,
      stories,
      trackStart,
      trackEnd,
      fillEnd,
      segments: segmentsFor(stories, trackStart, fillEnd),
    };
  });
}

function segmentsFor(stories: readonly LensStory[], start: number, end: number): LensSegment[] {
  const span = end - start;
  if (span <= 0) return [];
  if (stories.length === 0) return [{ storyId: null, start, end }];
  const weights = stories.map((story) => Math.max(story.weight ?? 1, 0.0001));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const gaps = LENS_DIAL.segmentGap * (stories.length - 1);
  // A thin arc with many stories would leave no room for the gaps: drop them rather than draw
  // slivers of negative length.
  const usable = span - gaps > span / 2 ? span - gaps : span;
  const gap = usable === span ? 0 : LENS_DIAL.segmentGap;
  const segments: LensSegment[] = [];
  let at = start;
  stories.forEach((story, i) => {
    const length = (usable * (weights[i] as number)) / total;
    segments.push({ storyId: story.id, start: at, end: at + length });
    at += length + gap;
  });
  return segments;
}

/** A point on the dial's circle at `angle` degrees clockwise from twelve o'clock. */
export function polar(angle: number, radius: number = LENS_DIAL.radius): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  const centre = LENS_DIAL.size / 2;
  return {
    x: round(centre + radius * Math.sin(radians)),
    y: round(centre - radius * Math.cos(radians)),
  };
}

/** SVG path for a clockwise arc. Every arc here spans less than 180°. */
export function arcPath(start: number, end: number, radius: number = LENS_DIAL.radius): string {
  const from = polar(start, radius);
  const to = polar(end, radius);
  const large = end - start > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y}`;
}

/** "Leadership: developing, from 3 stories". */
export function lensSummary(arc: Pick<LensArc, "label" | "level" | "stories">): string {
  const count = arc.stories.length;
  const base = `${arc.label}: ${LENS_LEVEL_WORDS[arc.level]}`;
  if (count === 0) return arc.level === "none" ? base : `${base}, no stories listed`;
  return `${base}, from ${count} ${count === 1 ? "story" : "stories"}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
