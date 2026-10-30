"use client";

// The Dossier's hero moment (spec §6.7): stories as glowing nodes, placed by era left to right and
// grouped by the lenses they prove, with lines between stories that share a trait. Drag to pan,
// zoom, and click a node to open it in place.
//
// How it is built, and why: the links are drawn on a 2D canvas — one path per pair, so a hundred
// stories stay at 60 fps — while every node is a real focusable <button> positioned over it. That
// means Tab order, arrow keys, focus rings, hover and screen-reader names all come from the
// platform rather than being re-implemented, which is what §6.12 asks for. The accessible list
// equivalent is not a hidden copy: §6.7 puts a list view "one keystroke away", and `L` switches to
// it for everyone.
//
// Under reduced motion nothing animates: the sky is drawn once, the glow is static, and panning is
// instant (spec §6.6).

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LENS_LABELS, type LensId } from "@admitstory/shared";
import { cx } from "../lib/cx";
import { layoutConstellation, nodeInDirection, type ConstellationStory } from "./layout";

export interface ConstellationProps {
  stories: readonly ConstellationStory[];
  /** The story currently open, drawn as selected. */
  selectedId?: string | null;
  onSelect: (storyId: string) => void;
  /** Switches to the list view (spec §6.7: "A list view sits one keystroke away"). */
  onShowList?: () => void;
  className?: string;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.6;
const ZOOM_STEP = 1.25;

interface View {
  zoom: number;
  /** Pan, in fractions of the sky. */
  panX: number;
  panY: number;
}

const START: View = { zoom: 1, panX: 0, panY: 0 };

function statusDot(status: ConstellationStory["status"]): string {
  if (status === "confirmed") return "bg-verified";
  if (status === "partial") return "bg-needs";
  return "bg-text-soft";
}

export function Constellation({
  stories,
  selectedId,
  onSelect,
  onShowList,
  className,
}: ConstellationProps) {
  const reduced = useReducedMotion();
  const layout = layoutConstellation(stories);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(START);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const describedBy = useId();

  const activeId = hoveredId ?? focusedId ?? selectedId ?? null;

  // Links are redrawn whenever the sky, the view or the highlighted story changes. One pass over
  // the links, no per-frame loop: nothing here animates on its own.
  const draw = useCallback(
    (canvas: HTMLCanvasElement, box: { width: number; height: number }) => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, box.width, box.height);

      const styles = getComputedStyle(canvas);
      const voice = styles.getPropertyValue("--voice").trim() || "#9DB1FF";
      const edge = styles.getPropertyValue("--text-soft").trim() || "#9AA2CC";

      const place = (x: number, y: number) => ({
        px: (x + view.panX) * view.zoom * box.width,
        py: (y + view.panY) * view.zoom * box.height,
      });
      const byId = new Map(layout.nodes.map((node) => [node.story.id, node] as const));

      for (const link of layout.links) {
        const from = byId.get(link.from);
        const to = byId.get(link.to);
        if (!from || !to) continue;
        const a = place(from.x, from.y);
        const b = place(to.x, to.y);
        const lit = activeId === link.from || activeId === link.to;
        context.strokeStyle = lit ? voice : edge;
        context.globalAlpha = lit ? 0.5 : 0.12;
        context.lineWidth = lit ? 1.5 : 1;
        context.beginPath();
        context.moveTo(a.px, a.py);
        // A gentle curve, so a dense sky reads as lines of light rather than a mesh.
        const midX = (a.px + b.px) / 2;
        const midY = (a.py + b.py) / 2 - Math.abs(b.px - a.px) * 0.08;
        context.quadraticCurveTo(midX, midY, b.px, b.py);
        context.stroke();
      }
      context.globalAlpha = 1;
    },
    [layout, view, activeId],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const render = () => draw(canvas, frame.getBoundingClientRect());
    render();
    const observer = new ResizeObserver(render);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [draw]);

  /* Panning: pointer drag on the sky itself, never on a node. */
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const frame = frameRef.current;
    if (!state || state.id !== event.pointerId || !frame) return;
    const box = frame.getBoundingClientRect();
    const dx = (event.clientX - state.x) / (box.width * view.zoom);
    const dy = (event.clientY - state.y) / (box.height * view.zoom);
    drag.current = { ...state, x: event.clientX, y: event.clientY };
    setView((current) => ({
      ...current,
      panX: current.panX + dx,
      panY: current.panY + dy,
    }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
  };

  const zoomBy = (factor: number) =>
    setView((current) => ({
      ...current,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor)),
    }));

  // Wheel zoom, but only with a modifier: a plain wheel must still scroll the page (§6.6, no
  // scroll hijacking).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  const moveFocus = (direction: "left" | "right" | "up" | "down") => {
    const next = nodeInDirection(layout.nodes, focusedId ?? selectedId ?? "", direction);
    if (!next) return;
    setFocusedId(next.story.id);
    document.getElementById(nodeDomId(describedBy, next.story.id))?.focus();
  };

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={describedBy} className="text-sm text-text-soft">
          {stories.length === 0
            ? "No stories yet."
            : `${stories.length} ${stories.length === 1 ? "story" : "stories"}, earliest on the left, grouped by what they prove. Arrow keys move between them; L opens the list.`}
        </p>
        <div className="flex items-center gap-1">
          <ZoomButton
            label="Zoom out"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={view.zoom <= MIN_ZOOM}
          >
            −
          </ZoomButton>
          <ZoomButton
            label="Zoom in"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={view.zoom >= MAX_ZOOM}
          >
            +
          </ZoomButton>
          <button
            type="button"
            onClick={() => setView(START)}
            className="rounded-control px-2 py-1 text-sm text-text-soft hover:bg-veil hover:text-text"
          >
            Reset view
          </button>
          {onShowList ? (
            <button
              type="button"
              onClick={onShowList}
              className="rounded-control px-2 py-1 text-sm text-text-soft hover:bg-veil hover:text-text"
            >
              List view
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const keys: Record<string, "left" | "right" | "up" | "down"> = {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
          };
          const direction = keys[event.key];
          if (direction) {
            event.preventDefault();
            moveFocus(direction);
            return;
          }
          if (event.key.toLowerCase() === "l" && onShowList) {
            event.preventDefault();
            onShowList();
          }
        }}
        className={cx(
          "relative h-[clamp(20rem,52vh,34rem)] touch-none overflow-hidden rounded-plane",
          "border border-edge bg-depth",
          panning ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        />

        {/* Lens bands, named so the sky reads without colour alone. */}
        {layout.bands.map((band) => (
          <span
            key={band.lens}
            aria-hidden
            className="pointer-events-none absolute left-2 -translate-y-1/2 text-xs text-text-soft/70"
            style={bandStyle(band.y, view)}
          >
            {LENS_LABELS[band.lens as LensId]}
          </span>
        ))}

        {layout.nodes.map((node) => {
          const isSelected = node.story.id === selectedId;
          const isActive = node.story.id === activeId;
          return (
            <button
              key={node.story.id}
              id={nodeDomId(describedBy, node.story.id)}
              type="button"
              aria-describedby={describedBy}
              aria-pressed={isSelected}
              onClick={() => onSelect(node.story.id)}
              onFocus={() => setFocusedId(node.story.id)}
              onBlur={() => setFocusedId(null)}
              onPointerEnter={() => setHoveredId(node.story.id)}
              onPointerLeave={() => setHoveredId(null)}
              style={nodeStyle(node.x, node.y, view)}
              className={cx(
                "group absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2",
                "min-h-11 rounded-control px-2 py-1 text-left",
                reduced ? "" : "transition-[opacity,filter] duration-150",
                isActive || isSelected ? "z-10" : "z-0",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "size-2.5 shrink-0 rounded-full",
                  statusDot(node.story.status),
                  isSelected || isActive
                    ? "ring-2 ring-signal ring-offset-2 ring-offset-depth"
                    : "",
                )}
              />
              <span
                className={cx(
                  "max-w-[12rem] truncate text-sm",
                  isSelected ? "font-semibold text-text" : "text-text-soft group-hover:text-text",
                )}
              >
                {node.story.nickname}
              </span>
              {node.story.sensitivity === "sensitive" ? (
                <span className="sr-only">Private unless you allow it</span>
              ) : null}
            </button>
          );
        })}

        {/* Era labels along the bottom, so left-to-right means something. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6">
          {layout.eras.map((era) => (
            <span
              key={era.label}
              className="absolute -translate-x-1/2 text-xs text-text-soft/70"
              style={eraStyle(era.x, view)}
            >
              {era.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function nodeDomId(prefix: string, storyId: string): string {
  return `${prefix}-node-${storyId}`;
}

function nodeStyle(x: number, y: number, view: View): CSSProperties {
  return {
    left: `${(x + view.panX) * view.zoom * 100}%`,
    top: `${(y + view.panY) * view.zoom * 100}%`,
  };
}

function bandStyle(y: number, view: View): CSSProperties {
  return { top: `${(y + view.panY) * view.zoom * 100}%` };
}

function eraStyle(x: number, view: View): CSSProperties {
  return { left: `${(x + view.panX) * view.zoom * 100}%` };
}

function ZoomButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-control text-text-soft hover:bg-veil hover:text-text disabled:opacity-40"
    >
      <span aria-hidden className="text-base">
        {children}
      </span>
    </button>
  );
}
