"use client";

import { ChatCircleTextIcon } from "@phosphor-icons/react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button } from "../components/button";
import { Sheet, SheetContent } from "../components/sheet";
import { cx } from "../lib/cx";
import { useMediaQuery } from "./use-media-query";

export type WorkspaceView = "files" | "document" | "coach";

const ALL_VIEWS: readonly { id: WorkspaceView; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "document", label: "Draft" },
  { id: "coach", label: "Chat" },
];

/** A horizontal swipe longer than this moves between views. */
const SWIPE_PX = 56;

/** The view a swipe lands on: left (dx < 0) is next, right is previous; vertical-ish ignored. */
export function swipeTarget(
  view: WorkspaceView,
  dx: number,
  dy: number,
  views: readonly { id: WorkspaceView }[] = ALL_VIEWS,
): WorkspaceView {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) / 2) return view;
  const index = views.findIndex((v) => v.id === view);
  return views[Math.min(views.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))]?.id ?? view;
}

export interface WorkspaceLayoutProps {
  /** Above everything: the school's name and its tabs (SPEC §6.6). */
  header?: ReactNode;
  /** Under the header, across the top: the open tab's documents as a strip of chips. */
  strip?: ReactNode;
  /** A left column, for screens whose list can't be a strip (the résumé's sources). */
  files?: ReactNode;
  document: ReactNode;
  /** The CoachSheet: chat first, then the notes. */
  coach: ReactNode;
  /** Controlled phone view; the document comes first. */
  view?: WorkspaceView;
  onViewChange?: (view: WorkspaceView) => void;
  /** Controlled side sheet for the panel from 1024 to 1279px. */
  coachOpen?: boolean;
  onCoachOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * The editor's frame (SPEC §6.9). From 1280px: the desk and the panel (340px) side by side under
 * the header and the strip; the page scrolls, so the sheet is read like paper, and the panel stays
 * put beside it. From 1024 to 1279px the panel is a side sheet opened from "Chat". Below 1024px
 * the desk and the panel are two views, chosen from a switch or by swiping sideways, with the
 * draft first. Markup is right at every width through CSS; the media query only decides whether
 * the panel is a modal sheet.
 */
export function WorkspaceLayout({
  header,
  strip,
  files,
  document,
  coach,
  view: controlledView,
  onViewChange,
  coachOpen: controlledOpen,
  onCoachOpenChange,
  className,
}: WorkspaceLayoutProps) {
  const views = files ? ALL_VIEWS : ALL_VIEWS.filter((v) => v.id !== "files");
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
    const next = swipeTarget(view, event.clientX - start.x, event.clientY - start.y, views);
    if (next !== view) setView(next);
  };

  return (
    <div
      className={cx("flex flex-1 flex-col p-4 max-lg:touch-pan-y sm:p-6", className)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {header}
      {strip ? <div className="mt-3">{strip}</div> : null}

      <div
        role="group"
        aria-label="Views"
        className="mt-4 grid h-10 grid-flow-col auto-cols-fr rounded-full border border-edge bg-frost p-0.5 lg:hidden"
      >
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            aria-controls={`workspace-${v.id}`}
            onClick={() => setView(v.id)}
            className={cx(
              "rounded-full text-ui transition-colors duration-(--dur-hover) ease-rise shadow-none",
              view === v.id ? "bg-text text-space" : "text-text-soft hover:text-text",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div
        className={cx(
          "mt-5 grid flex-1 items-start gap-6 lg:mt-6",
          files
            ? "lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_340px]"
            : "xl:grid-cols-[minmax(0,1fr)_340px]",
        )}
      >
        {files ? (
          <div
            id="workspace-files"
            className={cx(
              "card min-w-0 lg:sticky lg:top-4",
              view === "files" ? null : "max-lg:hidden",
            )}
          >
            {files}
          </div>
        ) : null}
        <section
          id="workspace-document"
          aria-label="Draft"
          className={cx("relative min-w-0", view === "document" ? null : "max-lg:hidden")}
        >
          <div className="mb-4 hidden justify-end lg:max-xl:flex">
            <Button
              size="sm"
              variant="secondary"
              icon={ChatCircleTextIcon}
              onClick={() => setCoachOpen(true)}
            >
              Chat
            </Button>
          </div>
          {document}
        </section>
        {sheetMode ? null : (
          <aside
            id="workspace-coach"
            aria-label="Chat and notes"
            className={cx(
              "card flex min-w-0 flex-col overflow-hidden max-lg:min-h-[70dvh] lg:max-xl:hidden xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)]",
              view === "coach" ? null : "max-lg:hidden",
            )}
          >
            {coach}
          </aside>
        )}
      </div>

      {sheetMode ? (
        <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
          <SheetContent title="Chat and notes" className="[&>div:last-child]:p-0">
            {coach}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
