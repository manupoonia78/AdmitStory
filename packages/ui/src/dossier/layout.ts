// Where each story sits in the constellation (spec §6.7): era left to right, grouped by the lenses
// it proves, with lines between stories that share a trait.
//
// Pure and deterministic: the same stories always produce the same sky, so a node does not jump
// when the view re-renders, and the layout can be computed on the server for the first paint.

import { LENS_IDS, type LensId } from "@admitstory/shared";

export interface ConstellationStory {
  id: string;
  code: string;
  nickname: string;
  /** "2024", "2019–2021", "college", "before college". */
  era: string;
  lenses: readonly LensId[];
  traits: readonly string[];
  status: "confirmed" | "partial" | "unconfirmed";
  /** Sensitive stories are drawn, but marked, and never silently used (spec §14.3). */
  sensitivity: "none" | "personal" | "sensitive";
}

export interface ConstellationNode {
  story: ConstellationStory;
  /** 0–1 across the sky; 0 is earliest. */
  x: number;
  /** 0–1 down the sky. */
  y: number;
  /** The lens band this node belongs to, or null when its traits prove none. */
  band: LensId | null;
}

export interface ConstellationLink {
  from: string;
  to: string;
  /** How many traits the two stories share; the line's weight. */
  shared: number;
}

export interface ConstellationLayout {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  /** The era labels along the bottom, in order, with their x positions. */
  eras: { label: string; x: number }[];
  bands: { lens: LensId; y: number }[];
}

/** The first year in an era string, or undefined for "college" and the like. */
function yearOf(era: string): number | undefined {
  const match = era.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

/**
 * Eras without a year are placed by what they mean rather than dropped: childhood first, then
 * education, then anything unlabelled, which sorts after dated material because an undated story is
 * usually recent work the applicant did not date.
 */
const UNDATED_ORDER: { pattern: RegExp; rank: number }[] = [
  { pattern: /child|school|home|grew up|before college/i, rank: -3 },
  { pattern: /college|university|undergrad|degree|mba/i, rank: -2 },
];

function undatedRank(era: string): number {
  return UNDATED_ORDER.find((entry) => entry.pattern.test(era))?.rank ?? -1;
}

/** Spreads values evenly across 0..1, with a margin so nodes never touch the edge. */
function spread(index: number, count: number): number {
  if (count <= 1) return 0.5;
  const margin = 0.08;
  return margin + (index / (count - 1)) * (1 - margin * 2);
}

export function layoutConstellation(stories: readonly ConstellationStory[]): ConstellationLayout {
  if (stories.length === 0) return { nodes: [], links: [], eras: [], bands: [] };

  // Columns: one per distinct era, ordered in time. Undated eras keep their meaning-based rank.
  const eraKeys = [...new Set(stories.map((story) => story.era || "undated"))];
  const ordered = eraKeys.sort((a, b) => {
    const yearA = yearOf(a);
    const yearB = yearOf(b);
    if (yearA !== undefined && yearB !== undefined) return yearA - yearB || a.localeCompare(b);
    if (yearA !== undefined) return 1;
    if (yearB !== undefined) return -1;
    return undatedRank(a) - undatedRank(b) || a.localeCompare(b);
  });
  const columnOf = new Map(ordered.map((era, index) => [era, index] as const));

  // Bands: one per lens, in canonical order, so the same lens is always the same height.
  const bandY = new Map<LensId, number>(
    LENS_IDS.map((lens, index) => [lens, spread(index, LENS_IDS.length)] as const),
  );

  // A story's band is the first lens it proves, in canonical order; nodes in the same cell are
  // nudged apart so none hides another.
  const cellCounts = new Map<string, number>();
  const nodes = stories.map((story): ConstellationNode => {
    const band = LENS_IDS.find((lens) => story.lenses.includes(lens)) ?? null;
    const column = columnOf.get(story.era || "undated") ?? 0;
    const cell = `${column}:${band ?? "none"}`;
    const seen = cellCounts.get(cell) ?? 0;
    cellCounts.set(cell, seen + 1);
    // Alternate above and below the band line, widening as a cell fills.
    const offset = seen === 0 ? 0 : (seen % 2 === 1 ? 1 : -1) * Math.ceil(seen / 2) * 0.07;
    const baseY = band ? (bandY.get(band) ?? 0.5) : 0.94;
    return {
      story,
      x: spread(column, ordered.length),
      y: Math.min(0.96, Math.max(0.04, baseY + offset)),
      band,
    };
  });

  // Links: stories that share a trait. Lines are the point of a constellation, so every shared
  // trait counts, but a pair is listed once.
  const links: ConstellationLink[] = [];
  for (let i = 0; i < stories.length; i += 1) {
    for (let j = i + 1; j < stories.length; j += 1) {
      const left = stories[i];
      const right = stories[j];
      if (!left || !right) continue;
      const shared = left.traits.filter((trait) => right.traits.includes(trait)).length;
      if (shared > 0) links.push({ from: left.id, to: right.id, shared });
    }
  }

  return {
    nodes,
    links,
    eras: ordered.map((label, index) => ({
      label: label === "undated" ? "Undated" : label,
      x: spread(index, ordered.length),
    })),
    bands: LENS_IDS.map((lens) => ({ lens, y: bandY.get(lens) ?? 0.5 })),
  };
}

/**
 * The node to move to from `fromId` in a direction, for arrow-key navigation: the nearest node in
 * that half-plane, measured with the perpendicular axis weighted up so "right" prefers a node
 * roughly level rather than one far off diagonally.
 */
export function nodeInDirection(
  nodes: readonly ConstellationNode[],
  fromId: string,
  direction: "left" | "right" | "up" | "down",
): ConstellationNode | undefined {
  const from = nodes.find((node) => node.story.id === fromId);
  if (!from) return nodes[0];
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;

  let best: ConstellationNode | undefined;
  let bestCost = Infinity;
  for (const node of nodes) {
    if (node.story.id === fromId) continue;
    const along = horizontal ? (node.x - from.x) * sign : (node.y - from.y) * sign;
    if (along <= 0.001) continue;
    const across = horizontal ? Math.abs(node.y - from.y) : Math.abs(node.x - from.x);
    const cost = along + across * 2.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = node;
    }
  }
  return best;
}
