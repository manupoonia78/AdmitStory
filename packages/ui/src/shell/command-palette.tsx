"use client";

// The heavy half of the palette (cmdk). Only command-palette-host.tsx imports it, lazily,
// so it stays out of every route's initial JS (spec §6.11: ≤ 160 KB gz per route).

import { MagnifyingGlassIcon, MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Command, useCommandState } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { OVERLAY_CLASSES } from "../components/dialog";
import { setThemePreference } from "../components/theme-store";
import { EdgeLight, useEdgeLight } from "../lib/edge-light";
import { THEME_LABELS, type ThemePreference } from "../theme-preference";
import { NAV_ICONS } from "./nav-icons";
import { NAV_ITEMS } from "./nav-items";
import { ROUTE_TRANSITION_TYPE } from "./route-transition";
import { PALETTE_LABEL, type CommandAction } from "./types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: readonly CommandAction[];
  /** Where focus goes back to on close (the element focused before ⌘K). */
  returnFocusTo?: HTMLElement | null;
}

const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 " +
  "[&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-soft";

// The highlight moves with the keyboard as a veil, never a lift (spec §6.6).
const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-text " +
  "data-[selected=true]:bg-veil data-[selected=true]:text-signal data-[disabled=true]:opacity-60";

// Centred plane: a fixed height, so it neither jumps as results narrow nor shifts the list.
// It glides in from 98% scale (opacity only with reduced motion) and fades out.
const PLANE =
  "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),40rem)] -translate-x-1/2 -translate-y-1/2 flex-col " +
  "overflow-hidden plane text-text shadow-overlay focus:outline-none " +
  "transition-[opacity,scale] duration-(--spring-glide-duration) ease-glide starting:scale-[0.98] starting:opacity-0 " +
  "motion-reduce:starting:scale-100 data-[state=closed]:animate-fade-out";

const KBD = "rounded-control border border-edge px-1.5 font-ui text-text";

/** Keyboard-first actions that need no page: the theme (spec §6.12). */
const THEME_ACTIONS: { preference: ThemePreference; label: string; keywords: string[] }[] = [
  { preference: "night", label: "Switch to Night", keywords: ["dark", "theme"] },
  { preference: "day", label: "Switch to Day", keywords: ["light", "theme"] },
  { preference: "system", label: `${THEME_LABELS.system} theme`, keywords: ["auto", "theme"] },
];
const THEME_ICONS = { night: MoonIcon, day: SunIcon, system: MonitorIcon } as const;

function groupActions(actions: readonly CommandAction[]): [string, CommandAction[]][] {
  const groups = new Map<string, CommandAction[]>();
  for (const action of actions) {
    const name = action.group ?? "Actions";
    groups.set(name, [...(groups.get(name) ?? []), action]);
  }
  return [...groups];
}

/** "3 results" for screen readers as the list narrows (live results, spec §6.5). */
export function resultCountMessage(count: number): string {
  if (count === 0) return "No results";
  return count === 1 ? "1 result" : `${count} results`;
}

function ResultCount() {
  const count = useCommandState((state) => state.filtered.count);
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {resultCountMessage(count)}
    </p>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  returnFocusTo,
}: CommandPaletteProps) {
  const router = useRouter();
  const edgeLight = useEdgeLight<HTMLDivElement>();

  function choose(entry: { href?: string; onSelect?: () => void }) {
    onOpenChange(false);
    if (entry.href) router.push(entry.href, { transitionTypes: [ROUTE_TRANSITION_TYPE] });
    entry.onSelect?.();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
        <DialogPrimitive.Content
          ref={edgeLight}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
          className={PLANE}
        >
          <EdgeLight />
          <DialogPrimitive.Title className="sr-only">{PALETTE_LABEL}</DialogPrimitive.Title>
          {/* vimBindings off: Ctrl K must stay the open/close shortcut, not "move up". */}
          <Command label={PALETTE_LABEL} loop vimBindings={false} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-edge px-4 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-signal">
              <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0 text-text-soft" />
              <Command.Input
                placeholder={PALETTE_LABEL}
                className="h-14 flex-1 bg-transparent text-lg text-text outline-none placeholder:text-text-soft sm:text-base"
              />
            </div>
            <ResultCount />
            <Command.List className="h-[min(50dvh,24rem)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="px-3 py-6 text-text-soft">
                No matches. Try a school, a story or an action.
              </Command.Empty>
              <Command.Group heading="Go to" className={GROUP}>
                {/* The six destinations come from here, not props: this chunk loads lazily, so
                    the icons cost nothing until the palette first opens. */}
                {NAV_ITEMS.map((item) => {
                  const ItemIcon = NAV_ICONS[item.id];
                  return (
                    <Command.Item
                      key={item.id}
                      value={`nav:${item.id}`}
                      keywords={[item.label, item.id]}
                      onSelect={() => choose(item)}
                      className={ITEM}
                    >
                      <ItemIcon size={20} aria-hidden className="shrink-0" />
                      {item.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              {groupActions(actions).map(([group, entries]) => (
                <Command.Group key={group} heading={group} className={GROUP}>
                  {entries.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Command.Item
                        key={action.id}
                        value={`action:${action.id}`}
                        keywords={[action.label, ...(action.keywords ?? [])]}
                        onSelect={() => choose(action)}
                        className={ITEM}
                      >
                        {ActionIcon ? (
                          <ActionIcon size={20} aria-hidden className="shrink-0" />
                        ) : (
                          <span aria-hidden className="size-5 shrink-0" />
                        )}
                        {action.label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
              <Command.Group heading="Appearance" className={GROUP}>
                {THEME_ACTIONS.map((action) => {
                  const ThemeIcon = THEME_ICONS[action.preference];
                  return (
                    <Command.Item
                      key={action.preference}
                      value={`theme:${action.preference}`}
                      keywords={[action.label, ...action.keywords]}
                      onSelect={() =>
                        choose({ onSelect: () => setThemePreference(action.preference) })
                      }
                      className={ITEM}
                    >
                      <ThemeIcon size={20} aria-hidden className="shrink-0" />
                      {action.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
            {/* How to drive it without a pointer. Hidden on touch-first phones, where it doesn't apply. */}
            <p
              aria-hidden
              className="hidden items-center gap-4 border-t border-edge px-4 py-2.5 text-sm text-text-soft sm:flex"
            >
              <span>
                <kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> to move
              </span>
              <span>
                <kbd className={KBD}>Enter</kbd> to open
              </span>
              <span>
                <kbd className={KBD}>Esc</kbd> to close
              </span>
            </p>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
