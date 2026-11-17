"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, Wordmark } from "../brand/wordmark";
import { buttonStyles } from "../components/button-styles";
import { cx } from "../lib/cx";
import type { ThemePreference } from "../theme-preference";
import { AccountMenu, type AccountUser } from "./account-menu";
import { preloadCommandPalette } from "./command-palette-host";
import { DOCK_ICON, DOCK_LABEL } from "./dock-styles";
import { useShortcutHint } from "./keyboard-shortcut";
import { NAV_ITEMS, SETTINGS_PATHS, isActivePath, pageTitle } from "./nav-items";
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
      className="casing-search"
    >
      <span aria-hidden className="grid size-4 place-items-center">
        {icon}
      </span>
      <span aria-hidden className="casing-search-text">
        Search
      </span>
      {/* CSS-generated, so the visible text stays the accessible name (WCAG 2.5.3); the shortcut
          is announced through aria-keyshortcuts. */}
      <kbd
        aria-hidden
        data-shortcut={hint.label}
        className="before:content-[attr(data-shortcut)]"
      />
    </button>
  );
}

/**
 * The casing's navigation (SPEC §6.1): the dark sidebar from 1024px (a 64px rail on immersive
 * screens), a top bar and a floating dock below it. Night in both themes. DOM order matches the
 * sidebar's visual order (brand, new story, search, destinations, settings, account), so
 * keyboard focus moves down it.
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
    <div data-slot="dock" data-theme="night" className="casing-side">
      <div className="casing-head casing-wash">
        <Link href="/home" className="casing-home" aria-label="AdmitStories home">
          <span className="casing-home-mark">
            <BrandMark size={24} />
          </span>
          <span className="casing-home-word">
            <Wordmark size={23} />
          </span>
        </Link>
        <span aria-hidden className="casing-title">
          {pageTitle(pathname)}
        </span>
        <Link
          href="/studio"
          prefetch
          transitionTypes={[ROUTE_TRANSITION_TYPE]}
          className={cx(buttonStyles({ size: "md" }), "casing-new gap-2")}
        >
          <span aria-hidden className="grid size-4 place-items-center">
            {icons.newStory}
          </span>
          <span className={DOCK_LABEL}>New story</span>
        </Link>
        <SearchTrigger open={paletteOpen} onOpen={onOpenPalette} icon={icons.search} />
      </div>

      {/* lg:overflow-y-auto: a short laptop screen scrolls the list, never the casing. */}
      <nav aria-label="Main" className="casing-nav casing-wash lg:overflow-y-auto">
        <p aria-hidden className="casing-nav-head label">
          Workspace
        </p>
        <ul className="casing-list">
          {NAV_ITEMS.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                // Full prefetch: the next page is ready before the click.
                prefetch
                transitionTypes={[ROUTE_TRANSITION_TYPE]}
                aria-current={index === current ? "page" : undefined}
                className="casing-link"
              >
                <span aria-hidden className={DOCK_ICON}>
                  {icons.nav[item.id]}
                </span>
                <span className={DOCK_LABEL}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="casing-foot">
        <Link
          href="/settings"
          prefetch
          transitionTypes={[ROUTE_TRANSITION_TYPE]}
          aria-current={inSettings ? "page" : undefined}
          className="casing-link casing-settings"
        >
          <span aria-hidden className={DOCK_ICON}>
            {icons.settings}
          </span>
          <span className={DOCK_LABEL}>Settings</span>
        </Link>
        <AccountMenu user={user} onSignOut={onSignOut} themeServerValue={themeServerValue} />
      </div>
    </div>
  );
}
