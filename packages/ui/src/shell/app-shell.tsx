"use client";

import { APP_NAME } from "@admitstory/shared";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SkipLink } from "../components/skip-link";
import { cx } from "../lib/cx";
import type { ThemePreference } from "../theme-preference";
import { AccountMenu, type AccountUser } from "./account-menu";
import { CommandPaletteHost, preloadCommandPalette } from "./command-palette-host";
import { useCommandK, useShortcutHint } from "./keyboard-shortcut";
import { NAV_ITEMS, isActivePath } from "./nav-items";
import { PALETTE_LABEL, type CommandAction } from "./types";

export interface AppShellProps {
  children: ReactNode;
  user: AccountUser;
  onSignOut: () => void | Promise<void>;
  /** Extra palette entries ("Record a new story", schools, stories) beyond the six destinations. */
  actions?: readonly CommandAction[];
  /** The theme cookie as read on the server, so the account menu hydrates without a flicker. */
  themeServerValue?: ThemePreference;
}

// One element per destination: a rail item from 640px up, a tab below it (spec §6.4, §6.9).
// The current page gets a filled background, ink text and bold weight, not colour alone.
const NAV_LINK =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-sm font-medium text-slate " +
  "hover:bg-ink-soft hover:text-graphite aria-[current=page]:bg-ink-soft aria-[current=page]:font-bold aria-[current=page]:text-ink " +
  "sm:w-18 sm:flex-none sm:rounded-control";

function SearchTrigger({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const hint = useShortcutHint();
  return (
    <button
      type="button"
      aria-label={PALETTE_LABEL}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts={hint.ariaKeyShortcuts}
      onClick={onOpen}
      onPointerEnter={preloadCommandPalette}
      onFocus={preloadCommandPalette}
      className={cx(
        "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-slate bg-paper px-3 text-slate hover:text-graphite",
        "sm:min-h-14 sm:w-18 sm:flex-none sm:flex-col sm:justify-center sm:gap-0.5 sm:border-0 sm:bg-transparent sm:px-0 sm:hover:bg-ink-soft",
      )}
    >
      <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0" />
      <span className="truncate sm:hidden">{PALETTE_LABEL}</span>
      <span className="hidden text-sm font-medium sm:inline">Search</span>
      {/* The hint is CSS-generated content, so it isn't text inside the button: the visible
          text then stays part of the accessible name (WCAG 2.5.3). The shortcut itself is
          announced through aria-keyshortcuts. */}
      <kbd
        aria-hidden
        data-shortcut={hint.label}
        className="hidden font-ui text-sm before:content-[attr(data-shortcut)] sm:inline"
      />
    </button>
  );
}

/**
 * Signed-in frame: slim left rail from 640px, top bar + bottom tab bar below it.
 * DOM order matches the rail's visual order (brand, search, destinations, account),
 * so keyboard focus moves down the rail.
 */
export function AppShell({
  children,
  user,
  onSignOut,
  actions = [],
  themeServerValue,
}: AppShellProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);

  function changePalette(open: boolean) {
    if (open) {
      const active = document.activeElement;
      setReturnFocusTo(active instanceof HTMLElement && active !== document.body ? active : null);
    }
    setPaletteOpen(open);
  }

  useCommandK(() => changePalette(!paletteOpen));

  return (
    <div className="min-h-dvh bg-mist text-graphite">
      <SkipLink targetId="main" />

      {/* The rail is the viewport's height and scrolls on its own when its content is taller (a
          landscape phone, a short window), so the lower destinations and the account menu are
          always reachable. Focusing an item scrolls it into view. Thin scrollbars leave the 72px
          items room inside the 88px rail even where scrollbars take up space. */}
      <div
        data-slot="rail"
        className="contents sm:fixed sm:inset-y-0 sm:left-0 sm:z-30 sm:flex sm:w-22 sm:flex-col sm:items-center sm:gap-3 sm:overflow-y-auto sm:overscroll-contain sm:border-r sm:border-line sm:bg-mist sm:py-4 sm:[scrollbar-width:thin]"
      >
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-mist pl-4 pr-16 sm:static sm:h-auto sm:flex-col sm:border-0 sm:p-0">
          <span className="shrink-0 text-sm font-bold text-graphite">{APP_NAME}</span>
          <SearchTrigger open={paletteOpen} onOpen={() => changePalette(true)} />
        </div>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] sm:static sm:border-0 sm:bg-transparent sm:pb-0"
        >
          <ul className="flex sm:flex-col sm:gap-1">
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const current = isActivePath(pathname, item.href);
              return (
                <li key={item.id} className="flex flex-1 sm:flex-none">
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={NAV_LINK}
                  >
                    <ItemIcon size={20} aria-hidden />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="fixed right-2 top-1.5 z-40 sm:static sm:mt-auto sm:shrink-0">
          <AccountMenu user={user} onSignOut={onSignOut} themeServerValue={themeServerValue} />
        </div>
      </div>

      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] outline-none sm:pb-0 sm:pl-22"
      >
        {children}
      </main>

      <CommandPaletteHost
        open={paletteOpen}
        onOpenChange={changePalette}
        navItems={NAV_ITEMS}
        actions={actions}
        returnFocusTo={returnFocusTo}
      />
    </div>
  );
}
