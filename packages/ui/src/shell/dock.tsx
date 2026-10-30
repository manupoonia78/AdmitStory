"use client";

import { APP_NAME } from "@admitstory/shared";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { EdgeLight, useEdgeLight } from "../lib/edge-light";
import { cx } from "../lib/cx";
import type { ThemePreference } from "../theme-preference";
import { AccountMenu, type AccountUser } from "./account-menu";
import { preloadCommandPalette } from "./command-palette-host";
import { DOCK_ICON, DOCK_LABEL } from "./dock-styles";
import { useShortcutHint } from "./keyboard-shortcut";
import { NAV_ITEMS, isActivePath } from "./nav-items";
import { ROUTE_TRANSITION_TYPE } from "./route-transition";
import { PALETTE_LABEL } from "./types";

/**
 * The dock's icons as finished elements. AppShell renders them on the server, so no icon code ships
 * to the browser (app-shell.tsx). All are decorative: every item is named by its label.
 */
export interface DockIcons {
  /** Keyed by NavItem id. */
  nav: Readonly<Record<string, ReactNode>>;
  search: ReactNode;
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

// See dock-styles.ts for the open/closed behaviour. Width moves on the glide spring; with reduced
// motion the dock opens at once and only the labels fade (spec §6.6).
const DOCK = cx(
  "group/dock contents",
  "sm:fixed sm:left-3 sm:top-1/2 sm:z-30 sm:flex sm:max-h-[calc(100dvh-1.5rem)] sm:w-16 sm:-translate-y-1/2 sm:flex-col sm:gap-2",
  "sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-contain sm:p-2 sm:plane sm:[scrollbar-width:none]",
  "sm:transition-[width] sm:duration-(--spring-glide-duration) sm:ease-glide sm:motion-reduce:transition-none",
  "sm:hover:w-52 sm:has-[:focus-visible]:w-52 sm:has-[[aria-expanded=true]]:w-52 sm:data-[folded]:w-16!",
  "sm:[view-transition-name:dock]",
);

// One element per destination: a labelled tab in the bottom dock below 640px, an icon row in the
// side dock above it. The current page is marked by weight, colour and the gliding veil behind
// it, not colour alone. No hover lift (spec §6.6).
const NAV_LINK = cx(
  "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-control px-0.5",
  "text-sm font-medium text-text-soft hover:text-text",
  "aria-[current=page]:font-semibold aria-[current=page]:text-signal",
  "sm:min-h-11 sm:w-full sm:flex-none sm:flex-row sm:justify-start sm:gap-0 sm:px-0 sm:hover:bg-veil",
);

// The veil under the current destination. It is one element that glides between items on the
// glide spring when the route changes (a 48px pitch in the side dock, one slot in the bottom dock).
const INDICATOR = cx(
  "pointer-events-none absolute left-0 top-0 h-full w-[calc(100%/var(--dock-count))] rounded-control bg-veil",
  "[transform:translateX(calc(var(--dock-index)*100%))]",
  "sm:h-11 sm:w-full sm:[transform:translateY(calc(var(--dock-index)*3rem))]",
  "transition-[transform,opacity] duration-(--spring-glide-duration) ease-glide motion-reduce:transition-opacity",
  "data-[idle]:opacity-0",
);

const DIVIDER = "mx-1 hidden h-px shrink-0 bg-edge sm:block";

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
        "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-control bg-depth px-3 text-text-soft hover:text-text",
        "sm:w-full sm:flex-none sm:gap-0 sm:border-0 sm:bg-transparent sm:px-0 sm:hover:bg-veil",
      )}
    >
      <span aria-hidden className={DOCK_ICON}>
        {icon}
      </span>
      <span className="truncate sm:hidden">{PALETTE_LABEL}</span>
      <span className={cx("hidden text-sm font-medium sm:inline", DOCK_LABEL)}>Search</span>
      {/* The hint is CSS-generated content, so it isn't text inside the button: the visible
          text then stays part of the accessible name (WCAG 2.5.3). The shortcut itself is
          announced through aria-keyshortcuts. */}
      <kbd
        aria-hidden
        data-shortcut={hint.label}
        className={cx(
          "ml-auto hidden font-ui text-sm before:content-[attr(data-shortcut)] sm:inline",
          DOCK_LABEL,
        )}
      />
    </button>
  );
}

/**
 * The navigation plane (spec §6.5): a slim floating dock on the left from 640px, a floating bottom
 * dock plus a slim top bar (brand, search, account) below it. DOM order matches the side dock's
 * visual order (search, destinations, account), so keyboard focus moves down it.
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
  const dockRef = useRef<HTMLDivElement>(null);
  const edgeLight = useEdgeLight<HTMLDivElement>();
  const [folded, setFolded] = useState(false);
  const dockNode = useCallback(
    (node: HTMLDivElement | null) => {
      dockRef.current = node;
      return edgeLight(node);
    },
    [edgeLight],
  );
  const current = NAV_ITEMS.findIndex((item) => isActivePath(pathname, item.href));

  // Escape folds an open dock away until the pointer or focus leaves it. A menu or the palette
  // closing on the same Escape has already handled it (Radix marks it defaultPrevented).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const dock = dockRef.current;
      if (event.key !== "Escape" || event.defaultPrevented || !dock) return;
      if (dock.matches(":hover") || dock.contains(document.activeElement)) setFolded(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={dockNode}
      data-slot="dock"
      data-folded={folded ? "" : undefined}
      onPointerLeave={() => setFolded(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFolded(false);
      }}
      className={DOCK}
    >
      <EdgeLight className="hidden sm:block" />

      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-space pl-4 pr-16 grain max-sm:[view-transition-name:top-bar] sm:contents">
        <span className="shrink-0 text-sm font-semibold text-text sm:hidden">{APP_NAME}</span>
        <SearchTrigger open={paletteOpen} onOpen={onOpenPalette} icon={icons.search} />
      </div>

      <span aria-hidden className={DIVIDER} />

      <nav
        aria-label="Main"
        className={cx(
          "fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 p-1",
          "max-sm:plane max-sm:[view-transition-name:dock] sm:static sm:p-0",
        )}
      >
        <div
          className="relative"
          style={
            {
              "--dock-index": Math.max(current, 0),
              "--dock-count": NAV_ITEMS.length,
            } as CSSProperties
          }
        >
          <span aria-hidden data-idle={current < 0 ? "" : undefined} className={INDICATOR} />
          <ul className="relative flex sm:flex-col sm:gap-1">
            {NAV_ITEMS.map((item, index) => (
              <li key={item.id} className="flex flex-1 sm:flex-none">
                <Link
                  href={item.href}
                  // Full prefetch: the next page is ready before the click, so the view changes
                  // at once and shared elements can pair up (spec §6.1, §6.6).
                  prefetch
                  transitionTypes={[ROUTE_TRANSITION_TYPE]}
                  aria-current={index === current ? "page" : undefined}
                  className={NAV_LINK}
                >
                  <span aria-hidden className={DOCK_ICON}>
                    {icons.nav[item.id]}
                  </span>
                  {/* Icons only in the bottom dock; the label stays the accessible name. */}
                  <span className={cx("sr-only sm:not-sr-only sm:max-w-none", DOCK_LABEL)}>
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <span aria-hidden className={DIVIDER} />

      <div className="fixed right-2 top-1.5 z-40 sm:static sm:shrink-0">
        <AccountMenu user={user} onSignOut={onSignOut} themeServerValue={themeServerValue} />
      </div>
    </div>
  );
}
