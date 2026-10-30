"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StatusLabel, type StatusTone } from "../components/status-label";
import { cx } from "../lib/cx";
import { REDUCED_FADE, spring } from "../motion";
import {
  Voiceprint,
  usePerformanceTier,
  type LiveVoiceSignal,
  type PerformanceTier,
  type VoiceprintIdentity,
} from "../voiceprint";
import { StreamingText } from "../workspace/streaming-text";
import { KitStageList } from "./kit-stage-list";
import { threadsFor, usedStories, type Thread, type ThreadAnchors } from "./threads";
import type { KitDeliverable, KitDeliverableStatus, KitStage, KitStory } from "./types";

export interface KitAssemblyProps {
  identity: VoiceprintIdentity;
  stories: readonly KitStory[];
  deliverables: readonly KitDeliverable[];
  stages: readonly KitStage[];
  onStageAction?: (stageId: string) => void;
  /** Heading over the deliverables, e.g. "What Northfield asks for". */
  deliverablesHeading: string;
  /** Under the stage list: the gap questions plane. */
  aside?: ReactNode;
  /** Force a performance tier (prototype, tests); otherwise chosen at runtime. */
  tier?: PerformanceTier;
  className?: string;
}

const STATUS: Record<KitDeliverableStatus, { tone: StatusTone; word: string }> = {
  waiting: { tone: "neutral", word: "Waiting" },
  mapped: { tone: "neutral", word: "Story chosen" },
  drafting: { tone: "neutral", word: "Drafting" },
  ready: { tone: "verified", word: "Draft ready" },
};

/** Centre of an element relative to the container, or its left / right edge at mid-height. */
function anchor(element: Element, box: DOMRect, at: "center" | "left" | "right") {
  const rect = element.getBoundingClientRect();
  const x = at === "left" ? rect.left : at === "right" ? rect.right : rect.left + rect.width / 2;
  return { x: x - box.left, y: rect.top + rect.height / 2 - box.top };
}

function measure(container: HTMLElement): ThreadAnchors | null {
  const box = container.getBoundingClientRect();
  const origin = container.querySelector("[data-thread-origin]");
  if (!origin) return null;
  const rect = origin.getBoundingClientRect();
  const anchors: ThreadAnchors = {
    // Just inside the Voiceprint's right edge, where its light is still bright.
    origin: {
      x: rect.right - rect.width * 0.18 - box.left,
      y: rect.top + rect.height / 2 - box.top,
    },
    stories: {},
    ports: {},
  };
  for (const node of container.querySelectorAll<HTMLElement>("[data-story-node]")) {
    const dot = node.querySelector("[data-story-dot]");
    const label = node.querySelector("[data-story-label]");
    if (!dot || !label) continue;
    const enter = anchor(dot, box, "center");
    anchors.stories[node.dataset.storyNode as string] = {
      enter,
      exit: { x: anchor(label, box, "right").x + 12, y: enter.y },
    };
  }
  for (const port of container.querySelectorAll<HTMLElement>("[data-deliverable-port]")) {
    anchors.ports[port.dataset.deliverablePort as string] = anchor(port, box, "center");
  }
  return anchors;
}

/**
 * The kit assembly, the most cinematic moment in the product (spec §6.7 Kit generation): the
 * applicant's Voiceprint on the left with their stories beside it, the school's deliverables on
 * the right. As the file map decides, a thread of light leaves the Voiceprint, passes through the
 * chosen story and travels to its essay on the drift spring; while that essay drafts, a soft pulse
 * keeps running along it and its first lines stream in.
 *
 * It also shows the reasoning without any animation: every row names the story it came from, and
 * the threads themselves are decorative. Tier 1 and reduced motion: threads appear in place,
 * opacity only. Threads are drawn from 1024px up; narrower, the rows carry the story names alone.
 */
export function KitAssembly({
  identity,
  stories,
  deliverables,
  stages,
  onStageAction,
  deliverablesHeading,
  aside,
  tier: forcedTier,
  className,
}: KitAssemblyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const storiesHeadingId = useId();
  const deliverablesHeadingId = useId();
  const reduced = useReducedMotion();
  const runtimeTier = usePerformanceTier();
  const tier = forcedTier ?? runtimeTier;
  const still = Boolean(reduced) || tier === 1;

  // Re-measure whenever anything inside changes size. Rows reserve their space, so this is rare.
  const [anchors, setAnchors] = useState<ThreadAnchors | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setAnchors(measure(container)));
    observer.observe(container);
    for (const child of container.querySelectorAll("[data-story-node], [data-deliverable-row]")) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [stories.length, deliverables.length]);

  const threads = threadsFor(deliverables, anchors);
  const used = usedStories(deliverables);
  const storyTitle = new Map(stories.map((story) => [story.id, story.title]));

  // Each new thread leaves the Voiceprint with a small swell of light (settle spring).
  const signal = useRef<LiveVoiceSignal>({ amplitude: 0, centroid: 0.4, pitchDelta: 0 });
  const decided = deliverables.filter((d) => d.status !== "waiting" && d.storyId).length;
  useEffect(() => {
    if (still || decided === 0) return;
    const controls = animate(0.6, 0, {
      ...spring("settle"),
      onUpdate: (value) => {
        signal.current.amplitude = Math.max(0, value);
      },
    });
    return () => controls.stop();
  }, [decided, still]);

  const active = stages.find((stage) => stage.status === "active");
  const allDone = stages.length > 0 && stages.every((stage) => stage.status === "done");
  const progress = active
    ? `${active.label}: ${active.detail ?? "in progress"}`
    : allDone
      ? "Every part of the kit is ready."
      : "";

  return (
    <div
      ref={containerRef}
      className={cx(
        "relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_clamp(3rem,7vw,8rem)_minmax(0,1fr)] lg:gap-y-0",
        className,
      )}
      data-motion={still ? "still" : "full"}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block"
      >
        {threads.map((thread) => (
          <ThreadOfLight
            key={thread.key}
            thread={thread}
            still={still}
            reduced={Boolean(reduced)}
          />
        ))}
      </svg>

      <div className="relative flex flex-col gap-10 lg:col-start-1">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
          <div data-thread-origin className="size-[clamp(10rem,15vw,14rem)] shrink-0">
            <Voiceprint
              identity={identity}
              signal={signal}
              size="fill"
              tier={forcedTier}
              label="Your Voiceprint"
            />
          </div>
          <section
            aria-labelledby={storiesHeadingId}
            className="w-full min-w-0 sm:w-auto sm:flex-1"
          >
            <h2 id={storiesHeadingId} className="mb-2 text-sm text-text-soft">
              Your stories
            </h2>
            <ul className="flex flex-col gap-1">
              {stories.map((story) => {
                const lit = used.has(story.id);
                return (
                  <li
                    key={story.id}
                    data-story-node={story.id}
                    data-lit={lit ? "" : undefined}
                    className="flex min-h-11 items-center gap-3"
                  >
                    <span
                      data-story-dot
                      aria-hidden
                      className={cx(
                        "size-2.5 shrink-0 rounded-full border transition-[background-color,box-shadow,border-color] duration-(--spring-drift-duration) ease-drift motion-reduce:transition-none",
                        lit
                          ? "border-voice bg-voice shadow-[0_0_12px_var(--voice)]"
                          : "border-control bg-transparent shadow-[0_0_12px_transparent]",
                      )}
                    />
                    <span data-story-label className="flex min-w-0 flex-col">
                      <span className={cx("truncate", lit ? "text-text" : "text-text-soft")}>
                        {story.title}
                      </span>
                      {story.context ? (
                        <span className="text-sm text-text-soft">{story.context}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <KitStageList stages={stages} onAction={onStageAction} />
        <p className="sr-only" aria-live="polite">
          {progress}
        </p>
        {aside}
      </div>

      <section aria-labelledby={deliverablesHeadingId} className="relative lg:col-start-3">
        <h2 id={deliverablesHeadingId} className="mb-3 text-sm text-text-soft">
          {deliverablesHeading}
        </h2>
        <ol className="plane flex flex-col">
          {deliverables.map((deliverable) => {
            const status = STATUS[deliverable.status];
            const story = deliverable.storyId ? storyTitle.get(deliverable.storyId) : undefined;
            const decided = deliverable.status !== "waiting" && story;
            return (
              <li
                key={deliverable.key}
                data-deliverable-row
                data-status={deliverable.status}
                className="relative flex flex-col gap-2 border-b border-edge px-5 py-4 last:border-b-0"
              >
                <span
                  data-deliverable-port={deliverable.key}
                  aria-hidden
                  className={cx(
                    "absolute -left-[5px] top-[1.65rem] hidden size-2.5 rounded-full border transition-[background-color,border-color] duration-(--spring-drift-duration) ease-drift motion-reduce:transition-none lg:block",
                    decided ? "border-voice bg-voice" : "border-control bg-depth",
                  )}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-lg font-medium text-text">{deliverable.title}</h3>
                  <StatusLabel tone={status.tone}>{status.word}</StatusLabel>
                </div>
                <p className="text-sm text-text-soft">
                  {deliverable.prompt} ({deliverable.limit})
                </p>
                {/* Always one line tall, so choosing a story never moves the row. */}
                <p className="min-h-[1lh] text-sm">
                  {decided ? (
                    <>
                      <span className="text-text-soft">From your story </span>
                      <span className="text-text">{story}</span>
                    </>
                  ) : (
                    <span className="text-text-soft">Choosing a story</span>
                  )}
                </p>
                <StreamingText
                  text={deliverable.text}
                  done={deliverable.status === "ready"}
                  reserve={deliverable.reserve ?? 3}
                  live={false}
                  className="font-reading text-read text-text"
                />
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/**
 * One thread: a faint line that draws itself in, and a brighter pulse riding along it while the
 * essay is mapped or drafting. Only stroke offsets and opacity animate. Still: the line fades in
 * where it belongs and no pulse runs.
 */
function ThreadOfLight({
  thread,
  still,
  reduced,
}: {
  thread: Thread;
  still: boolean;
  reduced: boolean;
}) {
  const ready = thread.status === "ready";
  const lineOpacity = ready ? 0.55 : 0.4;
  return (
    <g data-thread={thread.key} data-story={thread.storyId} data-thread-status={thread.status}>
      <motion.path
        d={thread.d}
        fill="none"
        stroke="var(--voice)"
        strokeWidth={1.25}
        strokeLinecap="round"
        initial={still ? { opacity: 0 } : { pathLength: 0, opacity: lineOpacity }}
        animate={still ? { opacity: lineOpacity } : { pathLength: 1, opacity: lineOpacity }}
        transition={reduced ? REDUCED_FADE : spring("drift")}
      />
      {still || ready ? null : (
        // Remounts when drafting starts, so the pulse switches from one trip to a slow loop.
        <Pulse key={thread.status} d={thread.d} loop={thread.status === "drafting"} />
      )}
    </g>
  );
}

function Pulse({ d, loop }: { d: string; loop: boolean }) {
  const transition = loop
    ? { ...spring("settle"), repeat: Infinity, repeatDelay: 0.9 }
    : spring("drift");
  // A short visible segment (pathLength) sliding along the path (pathOffset): a halo and a core.
  return (
    <>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--voice)"
        strokeWidth={8}
        strokeLinecap="round"
        opacity={0.22}
        initial={{ pathLength: 0.08, pathOffset: 0 }}
        animate={{ pathOffset: 1 }}
        transition={transition}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--voice)"
        strokeWidth={2.25}
        strokeLinecap="round"
        initial={{ pathLength: 0.05, pathOffset: 0 }}
        animate={{ pathOffset: 1 }}
        transition={transition}
      />
    </>
  );
}
