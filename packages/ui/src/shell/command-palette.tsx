"use client";

// The heavy half of the palette (cmdk). Only command-palette-host.tsx imports it, lazily,
// so it stays out of every route's initial JS (spec §6.11: ≤ 160 KB gz per route).

import { MagnifyingGlassIcon, MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Command, useCommandState } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { setThemePreference } from "../components/theme-store";
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

// Group heads in the label type (SPEC §6.1).
const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 " +
  "[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:leading-4 " +
  "[&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] " +
  "[&_[cmdk-group-heading]]:text-text-label";

// The highlight moves with the keyboard as a step of frost, never a lift.
const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-[14px] text-text-80 [&_svg]:text-text-faint " +
  "data-[selected=true]:bg-frost data-[selected=true]:text-text data-[selected=true]:[&_svg]:text-text " +
  "data-[disabled=true]:opacity-60";

// Night in both themes (part of the casing), high on the screen so the list grows downwards, and
// a fixed height so nothing jumps as results narrow. No animation at all (SPEC §2.10: a keyboard
// action used many times a day appears and goes at once).
const PLANE =
  "casing-overlay fixed left-1/2 top-[max(16px,14dvh)] z-50 flex max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),35rem)] -translate-x-1/2 flex-col " +
  "overflow-hidden rounded-card text-text shadow-overlay focus:outline-none";

const KBD =
  "inline-grid h-5 min-w-5 place-items-center rounded-full border border-edge bg-frost px-1.5 font-mono text-[10px] text-text";

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

  function choose(entry: { href?: string; onSelect?: () => void }) {
    onOpenChange(false);
    if (entry.href) router.push(entry.href, { transitionTypes: [ROUTE_TRANSITION_TYPE] });
    entry.onSelect?.();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(11_10_9/0.56)]" />
        <DialogPrimitive.Content
          data-theme="night"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
          className={PLANE}
        >
          <DialogPrimitive.Title className="sr-only">{PALETTE_LABEL}</DialogPrimitive.Title>
          {/* vimBindings off: Ctrl K must stay the open/close shortcut, not "move up". */}
          <Command label={PALETTE_LABEL} loop vimBindings={false} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-edge px-5 transition-colors duration-200 focus-within:border-text-faint">
              <MagnifyingGlassIcon size={18} aria-hidden className="shrink-0 text-text-faint" />
              <Command.Input
                placeholder={PALETTE_LABEL}
                className="h-14 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-faint sm:text-[17px]"
              />
            </div>
            <ResultCount />
            <Command.List className="h-[min(50dvh,24rem)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="px-3 py-6 text-[14px] text-text-soft">
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
                      <ItemIcon size={18} aria-hidden className="shrink-0" />
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
                          <ActionIcon size={18} aria-hidden className="shrink-0" />
                        ) : (
                          <span aria-hidden className="size-[18px] shrink-0" />
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
                      <ThemeIcon size={18} aria-hidden className="shrink-0" />
                      {action.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
            {/* How to drive it without a pointer. Hidden on touch-first phones, where it doesn't apply. */}
            <p
              aria-hidden
              className="label hidden items-center gap-5 border-t border-edge px-5 py-3 text-text-label sm:flex"
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
