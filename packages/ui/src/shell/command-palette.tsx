"use client";

// The heavy half of the palette (cmdk). Only command-palette-host.tsx imports it, lazily,
// so it stays out of every route's initial JS (spec §6.9: ≤ 180 KB gz per route).

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { OVERLAY_CLASSES } from "../components/dialog";
import type { NavItem } from "./nav-items";
import { PALETTE_LABEL, type CommandAction } from "./types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: readonly NavItem[];
  actions: readonly CommandAction[];
  /** Where focus goes back to on close (the element focused before ⌘K). */
  returnFocusTo?: HTMLElement | null;
}

const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 " +
  "[&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate";

const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-graphite " +
  "data-[selected=true]:bg-ink-soft data-[selected=true]:text-ink data-[disabled=true]:opacity-60";

function groupActions(actions: readonly CommandAction[]): [string, CommandAction[]][] {
  const groups = new Map<string, CommandAction[]>();
  for (const action of actions) {
    const name = action.group ?? "Actions";
    groups.set(name, [...(groups.get(name) ?? []), action]);
  }
  return [...groups];
}

export function CommandPalette({
  open,
  onOpenChange,
  navItems,
  actions,
  returnFocusTo,
}: CommandPaletteProps) {
  const router = useRouter();

  function choose(entry: { href?: string; onSelect?: () => void }) {
    onOpenChange(false);
    if (entry.href) router.push(entry.href);
    entry.onSelect?.();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(calc(100%-2rem),40rem)] -translate-x-1/2 overflow-hidden rounded-panel border border-line bg-paper text-graphite shadow-overlay focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{PALETTE_LABEL}</DialogPrimitive.Title>
          {/* vimBindings off: Ctrl K must stay the open/close shortcut, not "move up". */}
          <Command label={PALETTE_LABEL} loop vimBindings={false}>
            <div className="flex items-center gap-3 border-b border-line px-4 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink">
              <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0 text-slate" />
              <Command.Input
                placeholder={PALETTE_LABEL}
                className="h-14 flex-1 bg-transparent text-base text-graphite outline-none placeholder:text-slate"
              />
            </div>
            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-slate">
                No matches. Try a school, a story or an action.
              </Command.Empty>
              <Command.Group heading="Go to" className={GROUP}>
                {navItems.map((item) => {
                  const ItemIcon = item.icon;
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
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
