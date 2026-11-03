"use client";

// Story Studio's hero moment (spec §5.2, §6.7). When a story is found, the phrase it came from
// ignites in the applicant's hue (200 ms), condenses into a story card and flies along a curved
// path into the shelf on the drift spring; the shelf count updates and a screen reader hears
// "New story added to your shelf: {nickname}." With reduced motion the card simply appears.
//
//   <StoryCaptureProvider initialStories={…}>
//     <LiveTranscript segments={…} ignitedIds={useStoryCapture().ignited} />
//     <StoryShelf />
//   </StoryCaptureProvider>
//
// The flight is interruptible: each capture has its own reserved slot and flight, and a flight
// reads its slot's position every frame, so when a newer story pushes the slot down mid-flight
// the card simply heads for the new place. Nothing awaits an animation.

import { animate, MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type RefCallback,
} from "react";
import { cx } from "../lib/cx";
import { spring, useMotionToken } from "../motion";
import { findCaptureSource } from "./capture-source";
import {
  centreOf,
  clamp01,
  condenseOpacity,
  flightBox,
  flightControlPoint,
  isOnScreen,
  type Box,
} from "./flight-path";
import { StoryCard, type StoryCardData } from "./story-card";
import {
  captureReducer,
  initCaptureState,
  landedStories,
  type Flight,
  type ShelfItem,
} from "./story-capture-state";

/** How long the phrase glows in place before it lifts off (spec §6.7). */
export const IGNITE_MS = 200;

type Target = { box: Box; kind: "slot" | "button" };

interface CaptureContextValue {
  items: readonly ShelfItem[];
  count: number;
  ignited: ReadonlySet<string>;
  capture: (story: StoryCardData, options?: { sourceId?: string }) => void;
  reset: (stories: readonly StoryCardData[]) => void;
  registerSlot: (id: string, element: HTMLElement | null) => void;
  registerFallback: (element: HTMLElement | null) => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

function useCaptureContext(): CaptureContextValue {
  const value = useContext(CaptureContext);
  if (!value) throw new Error("Story capture components must be inside <StoryCaptureProvider>.");
  return value;
}

export interface StoryCapture {
  /** On the shelf, newest first (stories still in flight are not included). */
  stories: StoryCardData[];
  count: number;
  /** Transcript segment ids to light in the applicant's hue (LiveTranscript `ignitedIds`). */
  ignited: ReadonlySet<string>;
  /** Start the choreography for a found story. `sourceId` is the transcript segment it came from. */
  capture: (story: StoryCardData, options?: { sourceId?: string }) => void;
  /** Replace the shelf and drop anything in flight (prototype replays, tests). */
  reset: (stories: readonly StoryCardData[]) => void;
}

export function useStoryCapture(): StoryCapture {
  const { items, count, ignited, capture, reset } = useCaptureContext();
  const stories = useMemo(
    () => items.filter((item) => item.landed).map((item) => item.story),
    [items],
  );
  return { stories, count, ignited, capture, reset };
}

/**
 * A ref for the element flights head for when the shelf itself is off screen: the shelf button on
 * phones, where the shelf sits below the Studio.
 */
export function useShelfFallbackRef(): RefCallback<HTMLElement> {
  const { registerFallback } = useCaptureContext();
  return useCallback(
    (element: HTMLElement | null) => {
      registerFallback(element);
      return () => registerFallback(null);
    },
    [registerFallback],
  );
}

const toBox = (rect: DOMRect): Box => ({
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
});

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

export interface StoryCaptureProviderProps {
  initialStories?: readonly StoryCardData[];
  children: ReactNode;
}

export function StoryCaptureProvider({ initialStories = [], children }: StoryCaptureProviderProps) {
  const reduced = useReducedMotion() ?? false;
  const [state, dispatch] = useReducer(captureReducer, initialStories, initCaptureState);
  const slots = useRef(new Map<string, HTMLElement>());
  const fallback = useRef<HTMLElement | null>(null);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const capture = useCallback(
    (story: StoryCardData, { sourceId }: { sourceId?: string } = {}) => {
      dispatch({ type: "capture", story, sourceId, instant: reduced });
      if (reduced) return;
      // The phrase glows in place first; the flight starts from wherever it is by then.
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        const rect = sourceId ? findCaptureSource(sourceId)?.getBoundingClientRect() : undefined;
        const from = rect && isOnScreen(toBox(rect), viewport()) ? toBox(rect) : null;
        dispatch({ type: "launch", id: story.id, from });
      }, IGNITE_MS);
      timers.current.add(timer);
    },
    [reduced],
  );

  const reset = useCallback((stories: readonly StoryCardData[]) => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current.clear();
    dispatch({ type: "reset", stories });
  }, []);

  const registerSlot = useCallback((id: string, element: HTMLElement | null) => {
    if (element) slots.current.set(id, element);
    else slots.current.delete(id);
  }, []);

  const registerFallback = useCallback((element: HTMLElement | null) => {
    fallback.current = element;
  }, []);

  // The slot's card (not the growing slot itself) gives the size the flying card ends at.
  const targetFor = useCallback((id: string): Target | null => {
    const card = slots.current.get(id)?.querySelector("article");
    const slot = card ? toBox(card.getBoundingClientRect()) : null;
    if (slot && isOnScreen(slot, viewport())) return { box: slot, kind: "slot" };
    const button = fallback.current ? toBox(fallback.current.getBoundingClientRect()) : null;
    if (button && isOnScreen(button, viewport())) return { box: button, kind: "button" };
    return slot ? { box: slot, kind: "slot" } : null;
  }, []);

  const onLand = useCallback((id: string) => dispatch({ type: "land", id }), []);

  const ignitedIds = state.ignited;
  const ignited = useMemo(() => new Set(ignitedIds), [ignitedIds]);
  const count = useMemo(() => landedStories(state).length, [state]);

  const value = useMemo<CaptureContextValue>(
    () => ({
      items: state.items,
      count,
      ignited,
      capture,
      reset,
      registerSlot,
      registerFallback,
    }),
    [state.items, count, ignited, capture, reset, registerSlot, registerFallback],
  );

  const storiesById = new Map(state.items.map((item) => [item.story.id, item.story]));

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {state.flights.map((flight) => {
          const story = storiesById.get(flight.id);
          return story ? (
            <FlyingStory
              key={flight.id}
              flight={flight}
              story={story}
              targetFor={targetFor}
              onLand={onLand}
            />
          ) : null;
        })}
      </div>
      <p role="status" className="sr-only">
        {state.announcement}
      </p>
    </CaptureContext.Provider>
  );
}

function FlyingStory({
  flight,
  story,
  targetFor,
  onLand,
}: {
  flight: Flight;
  story: StoryCardData;
  targetFor: (id: string) => Target | null;
  onLand: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landed = useEffectEvent(() => onLand(flight.id));

  useEffect(() => {
    const box = boxRef.current;
    const glow = glowRef.current;
    const card = cardRef.current;
    if (!box || !glow || !card) return;
    const from = flight.from;
    const frame = (t: number) => {
      // Re-read every frame: the slot moves if a newer story is captured mid-flight.
      const target = targetFor(flight.id);
      const to = target?.box ?? from;
      const inset = 8;
      const { width, height } = viewport();
      const control = flightControlPoint(centreOf(from), centreOf(to), {
        bounds: { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 },
      });
      const current = flightBox(from, to, control, t);
      box.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      box.style.width = `${current.width}px`;
      box.style.height = `${current.height}px`;
      card.style.width = `${to.width}px`;
      const fade = condenseOpacity(t);
      glow.style.opacity = String(fade.phrase);
      // Into the shelf button, the card shrinks away as it arrives instead of meeting a slot.
      card.style.opacity = String(
        target?.kind === "button" ? fade.card * (1 - clamp01((t - 0.7) / 0.3)) : fade.card,
      );
    };
    frame(0);
    const controls = animate(0, 1, { ...spring("drift"), onUpdate: frame, onComplete: landed });
    return () => controls.stop();
  }, [flight, targetFor]);

  return (
    <div
      ref={boxRef}
      data-flight={flight.id}
      className="absolute top-0 left-0 overflow-hidden rounded-control will-change-transform [contain:layout_paint]"
    >
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-control bg-voice-glow shadow-[0_0_32px_var(--voice-glow)]"
      />
      <div ref={cardRef} className="absolute top-0 left-0 opacity-0">
        <StoryCard story={story} layout={false} />
      </div>
    </div>
  );
}

export interface StoryShelfProps {
  heading?: string;
  headingLevel?: 2 | 3;
  /** Shown when the shelf is empty (spec §6.9). */
  emptyText?: string;
  id?: string;
  className?: string;
}

/**
 * The shelf (spec §5.2): stories newest first, each opening in place. Still and quiet: the only
 * motion is the room a captured story's slot makes as it flies in.
 */
export function StoryShelf({
  heading = "Your shelf",
  headingLevel = 2,
  emptyText = "No stories yet. Talk for five minutes and they'll start appearing here.",
  id,
  className,
}: StoryShelfProps) {
  const { items, count, registerSlot } = useCaptureContext();
  const [openId, setOpenId] = useState<string | null>(null);
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section id={id} aria-labelledby={headingId} className={cx("flex flex-col gap-3", className)}>
      <Heading id={headingId} className="text-base font-medium text-text">
        {heading} <span className="text-text-soft tabular-nums">({count})</span>
      </Heading>
      {items.length === 0 ? <p className="text-sm text-text-soft">{emptyText}</p> : null}
      {/* Layout and transform animations step aside under reduced motion. */}
      <MotionConfig reducedMotion="user">
        <ul className="flex flex-col">
          {items.map((item) => (
            <ShelfEntry
              key={item.story.id}
              item={item}
              open={openId === item.story.id}
              onToggle={() =>
                setOpenId((current) => (current === item.story.id ? null : item.story.id))
              }
              registerSlot={registerSlot}
            />
          ))}
        </ul>
      </MotionConfig>
    </section>
  );
}

function ShelfEntry({
  item,
  open,
  onToggle,
  registerSlot,
}: {
  item: ShelfItem;
  open: boolean;
  onToggle: () => void;
  registerSlot: (id: string, element: HTMLElement | null) => void;
}) {
  const reduced = useReducedMotion();
  const glide = useMotionToken("glide");
  const { story, landed } = item;
  const slotRef = useCallback(
    (element: HTMLLIElement | null) => {
      registerSlot(story.id, element);
      return () => registerSlot(story.id, null);
    },
    [registerSlot, story.id],
  );

  return (
    <motion.li
      ref={slotRef}
      data-story={story.id}
      data-pending={landed ? undefined : ""}
      aria-hidden={landed ? undefined : true}
      // An arriving story's slot opens from nothing; stories already here (and every story under
      // reduced motion) only fade in.
      initial={landed ? (reduced ? { opacity: 0 } : false) : { height: 0 }}
      animate={landed ? { opacity: 1 } : { height: "auto" }}
      layout={landed ? "position" : false}
      transition={glide}
      className={landed ? undefined : "overflow-hidden"}
    >
      {/* Spacing lives inside the slot so it opens with it; the card is hidden until it lands. */}
      <div className={cx("pb-2", !landed && "invisible")}>
        <StoryCard
          story={story}
          variant={open && landed ? "expanded" : "compact"}
          onToggle={landed ? onToggle : undefined}
        />
      </div>
    </motion.li>
  );
}
