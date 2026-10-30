// Geometry for the assembly's threads of light (spec §6.2 "Kit generation", §6.7). Pure, so the
// shapes are unit-tested; the component only measures the DOM and draws.

import type { KitDeliverable } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface ThreadAnchors {
  /** Where threads leave the Voiceprint. */
  origin: Point;
  /** Per story id: where the thread enters the story node (its dot) and leaves it (past the
   *  label, so light never crosses the words). */
  stories: Record<string, { enter: Point; exit: Point }>;
  /** Per deliverable key: the port on the row's edge. */
  ports: Record<string, Point>;
}

export interface Thread {
  key: string;
  storyId: string;
  d: string;
  status: KitDeliverable["status"];
}

const round = (value: number) => Math.round(value * 10) / 10;

/** A smooth S-curve from `from` to `to` that leaves and arrives horizontally. */
export function curveTo(from: Point, to: Point): string {
  const mid = round(from.x + (to.x - from.x) / 2);
  return `C ${mid} ${round(from.y)}, ${mid} ${round(to.y)}, ${round(to.x)} ${round(to.y)}`;
}

/**
 * One thread: from the Voiceprint into the story's dot, then (after a gap where it passes behind
 * the story's label) out to the deliverable. The gap is a second "M", so a pulse travelling the
 * path disappears into the story and comes out the other side.
 */
export function threadPath(origin: Point, enter: Point, exit: Point, port: Point): string {
  return [
    `M ${round(origin.x)} ${round(origin.y)}`,
    curveTo(origin, enter),
    `M ${round(exit.x)} ${round(exit.y)}`,
    curveTo(exit, port),
  ].join(" ");
}

/** The threads to draw: every deliverable that has a story and whose anchors are measured. */
export function threadsFor(
  deliverables: readonly KitDeliverable[],
  anchors: ThreadAnchors | null,
): Thread[] {
  if (!anchors) return [];
  const threads: Thread[] = [];
  for (const deliverable of deliverables) {
    if (deliverable.status === "waiting" || !deliverable.storyId) continue;
    const story = anchors.stories[deliverable.storyId];
    const port = anchors.ports[deliverable.key];
    if (!story || !port) continue;
    threads.push({
      key: deliverable.key,
      storyId: deliverable.storyId,
      status: deliverable.status,
      d: threadPath(anchors.origin, story.enter, story.exit, port),
    });
  }
  return threads;
}

/** Story ids that at least one decided deliverable uses: their nodes light up. */
export function usedStories(deliverables: readonly KitDeliverable[]): Set<string> {
  const used = new Set<string>();
  for (const deliverable of deliverables) {
    if (deliverable.status !== "waiting" && deliverable.storyId) used.add(deliverable.storyId);
  }
  return used;
}
