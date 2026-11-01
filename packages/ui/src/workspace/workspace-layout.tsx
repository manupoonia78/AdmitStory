"use client";

import { ChatCircleTextIcon } from "@phosphor-icons/react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "../components/button";
import { Sheet, SheetContent } from "../components/sheet";
import { cx } from "../lib/cx";
import { useMediaQuery } from "./use-media-query";

export type WorkspaceView = "files" | "document" | "coach";

const VIEWS: readonly { id: WorkspaceView; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "document", label: "Draft" },
  { id: "coach", label: "Coach" },
];

/** A horizontal swipe longer than this moves between views. */
const SWIPE_PX = 56;

/** The view a swipe lands on: left (dx < 0) is next, right is previous; vertical-ish ignored. */
export function swipeTarget(view: WorkspaceView, dx: number, dy: number): WorkspaceView {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) / 2) return view;
  const index = VIEWS.findIndex((v) => v.id === view);
  return VIEWS[Math.min(VIEWS.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))]?.id ?? view;
}

export interface WorkspaceLayoutProps {
  files: ReactNode;
  document: ReactNode;
  /** The CoachSheet. */
  coach: ReactNode;
  /** Controlled phone view; the document comes first. */
  view?: WorkspaceView;
  onViewChange?: (view: WorkspaceView) => void;
  /** Controlled tablet Coach sheet. */
  coachOpen?: boolean;
  onCoachOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Screen G's three planes (spec §6.5): Files 248px, the document sheet, the Coach 400px. From 1024
 * to 1279px the Coach is a sheet over the right, opened from "Open coach"; below 1024px the three
 * are views, chosen from a tab row or by swiping sideways, with the document first. Markup is right
 * at every width through CSS; the media query only decides whether the Coach is a modal sheet.
 */
export function WorkspaceLayout({
  files,
  document,
  coach,
  view: controlledView,
  onViewChange,
  coachOpen: controlledOpen,
  onCoachOpenChange,
  className,
}: WorkspaceLayoutProps) {
  const [ownView, setOwnView] = useState<WorkspaceView>("document");
  const [ownOpen, setOwnOpen] = useState(false);
  const view = controlledView ?? ownView;
  const setView = (next: WorkspaceView) => {
    setOwnView(next);
    onViewChange?.(next);
  };
  const coachOpen = controlledOpen ?? ownOpen;
  const setCoachOpen = (open: boolean) => {
    setOwnOpen(open);
    onCoachOpenChange?.(open);
  };
  const sheetMode = useMediaQuery("(min-width: 1024px) and (max-width: 1279.98px)");
  const narrow = useMediaQuery("(max-width: 1023.98px)");
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent) => {
    swipe.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || !narrow) return;
    // Text selection and horizontal scrollers keep their own gestures.
    if (
      (event.target as Element).closest?.(
        "[data-no-swipe], input, textarea, [contenteditable=true]",
      )
    ) {
      return;
    }
    const next = swipeTarget(view, event.clientX - start.x, event.clientY - start.y);
    if (next !== view) setView(next);
  };

  return (
    <div
      className={cx(
        "flex flex-1 flex-col gap-3 p-3 max-lg:touch-pan-y sm:p-4 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div role="group" aria-label="Views" className="flex gap-1 lg:hidden">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            aria-controls={`workspace-${v.id}`}
            onClick={() => setView(v.id)}
            className={cx(
              "min-h-11 flex-1 rounded-control px-3 font-medium",
              view === v.id ? "bg-veil text-text" : "text-text-soft hover:text-text",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 sm:gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_400px]">
        <div
          id="workspace-files"
          className={cx("plane min-h-0 overflow-y-auto", view === "files" ? null : "max-lg:hidden")}
        >
          {files}
        </div>
        <section
          id="workspace-document"
          aria-label="Draft"
          className={cx(
            "plane relative min-h-0 overflow-y-auto",
            view === "document" ? null : "max-lg:hidden",
          )}
        >
          <div className="absolute right-4 top-4 hidden lg:max-xl:block">
            <Button
              variant="secondary"
              icon={ChatCircleTextIcon}
              onClick={() => setCoachOpen(true)}
            >
              Open coach
            </Button>
          </div>
          {document}
        </section>
        {sheetMode ? null : (
          <aside
            id="workspace-coach"
            aria-label="Coach"
            className={cx(
              "plane flex min-h-0 flex-col overflow-hidden lg:max-xl:hidden",
              view === "coach" ? null : "max-lg:hidden",
            )}
          >
            {coach}
          </aside>
        )}
      </div>

      {sheetMode ? (
        <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
          <SheetContent title="Coach" className="[&>div:last-child]:p-0">
            {coach}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
