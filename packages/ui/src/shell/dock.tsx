"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "../brand/wordmark";
import { buttonStyles } from "../components/button-styles";
import { cx } from "../lib/cx";
import type { ThemePreference } from "../theme-preference";
import { AccountMenu, type AccountUser } from "./account-menu";
import { preloadCommandPalette } from "./command-palette-host";
import { DOCK_ICON, DOCK_LABEL } from "./dock-styles";
import { useShortcutHint } from "./keyboard-shortcut";
import { NAV_ITEMS, SETTINGS_PATHS, isActivePath } from "./nav-items";
import { ROUTE_TRANSITION_TYPE } from "./route-transition";
import { PALETTE_LABEL } from "./types";

/**
 * The sidebar's icons as finished elements. AppShell renders them on the server, so no icon code
 * ships to the browser (app-shell.tsx). All are decorative: every item is named by its label.
 */
export interface DockIcons {
  /** Keyed by NavItem id. */
  nav: Readonly<Record<string, ReactNode>>;
  search: ReactNode;
  settings: ReactNode;
  newStory: ReactNode;
}

export interface DockProps {
  pathname: string;
  user: AccountUser;
  onSignOut: () => void | Promise<void>;
  themeServerValue?: ThemePreference;
  paletteOpen: boolean;
  onOpenPalette: () => void;
  icons: DockIcons;
}

// One element serves both layouts (see dock-styles.ts). Below 1024px it is `contents`, so its
// parts place themselves: a sticky top bar, a fixed bottom tab bar, the account at the top right.
const SIDEBAR = cx(
  "contents",
  "lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-edge lg:bg-rail",
  "lg:[view-transition-name:dock]",
);

// Sidebar rows from 1024px; equal-width icon tabs in the bottom bar below it. The current page
// is marked by a paper sheet, ink text and the accent icon, not colour alone.
const NAV_LINK = cx(
  "group/nav relative flex flex-1 items-center justify-center rounded-control text-text-soft",
  "transition-colors duration-(--spring-snap-duration) ease-snap hover:text-text",
  "aria-[current=page]:text-text",
  "lg:h-9 lg:w-full lg:flex-none lg:justify-start lg:gap-3 lg:px-2.5 lg:text-[14px] lg:hover:bg-veil",
  "lg:aria-[current=page]:bg-depth lg:aria-[current=page]:font-medium lg:aria-[current=page]:shadow-paper",
  "lg:aria-[current=page]:ring-1 lg:aria-[current=page]:ring-edge",
);

const NAV_ICON = cx(DOCK_ICON, "group-aria-[current=page]/nav:text-accent");

function SearchTrigger({
  open,
  onOpen,
  icon,
}: {
  open: boolean;
  onOpen: () => void;
  icon: ReactNode;
}) {
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
        "ml-auto mr-12 flex size-11 items-center justify-center rounded-control text-text-soft hover:bg-veil hover:text-text",
        "lg:m-0 lg:h-9 lg:w-full lg:justify-start lg:gap-3 lg:border lg:border-edge lg:bg-depth lg:px-2.5 lg:text-[14px]",
        "lg:hover:border-control lg:hover:bg-depth",
      )}
    >
      <span aria-hidden className="grid size-5 place-items-center">
        {icon}
      </span>
      <span className="hidden lg:inline">Search</span>
      {/* CSS-generated, so the visible text stays the accessible name (WCAG 2.5.3); the shortcut
          is announced through aria-keyshortcuts. */}
      <kbd
        aria-hidden
        data-shortcut={hint.label}
        className="meta ml-auto hidden rounded-[5px] border border-edge px-1.5 before:content-[attr(data-shortcut)] lg:inline"
      />
    </button>
  );
}

/**
 * The navigation: a light sidebar from 1024px, a top bar and bottom tab bar below it. DOM order
 * matches the sidebar's visual order (brand, new story, search, destinations, settings, account),
 * so keyboard focus moves down it.
 */
export function Dock({
  pathname,
  user,
  onSignOut,
  themeServerValue,
  paletteOpen,
  onOpenPalette,
  icons,
}: DockProps) {
  const current = NAV_ITEMS.findIndex((item) => isActivePath(pathname, item.href));
  const inSettings = SETTINGS_PATHS.some((href) => isActivePath(pathname, href));

  return (
    <div data-slot="dock" className={SIDEBAR}>
      <div
        className={cx(
          "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-edge bg-space/92 px-4 backdrop-blur-md",
          "max-lg:[view-transition-name:top-bar]",
          "lg:static lg:h-auto lg:flex-col lg:items-stretch lg:gap-3 lg:border-0 lg:bg-transparent lg:px-3 lg:pb-2 lg:pt-5 lg:backdrop-blur-none",
        )}
      >
        <Link
          href="/home"
          className="rounded-control lg:mb-3 lg:px-2"
          aria-label="AdmitStories home"
        >
          <Wordmark size={22} />
        </Link>
        <Link
          href="/studio"
          prefetch
          transitionTypes={[ROUTE_TRANSITION_TYPE]}
          className={cx(buttonStyles({ size: "sm" }), "w-full max-lg:hidden")}
        >
          <span aria-hidden className="grid size-4 place-items-center">
            {icons.newStory}
          </span>
          New story
        </Link>
        <SearchTrigger open={paletteOpen} onOpen={onOpenPalette} icon={icons.search} />
      </div>

      <nav
        aria-label="Main"
        className={cx(
          "fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-space/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
          "max-lg:[view-transition-name:dock]",
          "lg:static lg:flex-1 lg:overflow-y-auto lg:border-0 lg:bg-transparent lg:px-3 lg:pb-0 lg:pt-4 lg:backdrop-blur-none",
        )}
      >
        <p className="eyebrow mb-2 hidden px-2.5 before:hidden lg:flex">Workspace</p>
        <ul className="flex lg:flex-col lg:gap-0.5">
          {NAV_ITEMS.map((item, index) => (
            <li key={item.id} className="flex flex-1 lg:flex-none">
              <Link
                href={item.href}
                // Full prefetch: the next page is ready before the click (spec §6.1, §6.6).
                prefetch
                transitionTypes={[ROUTE_TRANSITION_TYPE]}
                aria-current={index === current ? "page" : undefined}
                className={cx(NAV_LINK, "min-h-14 lg:min-h-0")}
              >
                <span aria-hidden className={NAV_ICON}>
                  {icons.nav[item.id]}
                </span>
                <span className={DOCK_LABEL}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="fixed right-2 top-1.5 z-40 lg:static lg:flex lg:flex-col lg:gap-1 lg:border-t lg:border-edge lg:p-3">
        <Link
          href="/settings"
          prefetch
          transitionTypes={[ROUTE_TRANSITION_TYPE]}
          aria-current={inSettings ? "page" : undefined}
          className={cx(NAV_LINK, "hidden lg:flex")}
        >
          <span aria-hidden className={NAV_ICON}>
            {icons.settings}
          </span>
          <span className={DOCK_LABEL}>Settings</span>
        </Link>
        <AccountMenu user={user} onSignOut={onSignOut} themeServerValue={themeServerValue} />
      </div>
    </div>
  );
}
