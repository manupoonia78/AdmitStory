"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SkipLink } from "../components/skip-link";
import type { ThemePreference } from "../theme-preference";
import type { AccountUser } from "./account-menu";
import { CommandPaletteHost } from "./command-palette-host";
import { Dock, type DockIcons } from "./dock";
import { useCommandK } from "./keyboard-shortcut";
import { NIGHT_RAIL_PATHS, RAIL_PATHS, isActivePath } from "./nav-items";
import { RouteTransition } from "./route-transition";
import type { CommandAction } from "./types";
import { ViewTransitionStyles } from "./view-transition-styles";

export interface AppShellFrameProps {
  children: ReactNode;
  user: AccountUser;
  onSignOut: () => void | Promise<void>;
  actions?: readonly CommandAction[];
  themeServerValue?: ThemePreference;
  /** The dock's icons as finished elements, rendered on the server by AppShell. */
  icons: DockIcons;
}

/** The client half of AppShell (app-shell.tsx): dock, routed content and the ⌘K palette. */
export function AppShellFrame({
  children,
  user,
  onSignOut,
  actions = [],
  themeServerValue,
  icons,
}: AppShellFrameProps) {
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
  const rail = RAIL_PATHS.some((href) => isActivePath(pathname, href))
    ? NIGHT_RAIL_PATHS.some((href) => isActivePath(pathname, href))
      ? "studio"
      : "desk"
    : undefined;

  // The casing (SPEC §6.1, casing.css): dark in both themes; the bay holds the page.
  return (
    <div data-slot="casing" data-rail={rail} className="casing">
      <ViewTransitionStyles />
      <SkipLink targetId="main" />

      <Dock
        pathname={pathname}
        user={user}
        onSignOut={onSignOut}
        themeServerValue={themeServerValue}
        paletteOpen={paletteOpen}
        onOpenPalette={() => changePalette(true)}
        icons={icons}
      />

      {/* The bay: right of the sidebar (or rail) from 1024px, above the floating dock below it. */}
      <main id="main" tabIndex={-1} className="app-main bay">
        <RouteTransition>{children}</RouteTransition>
      </main>

      <CommandPaletteHost
        open={paletteOpen}
        onOpenChange={changePalette}
        actions={actions}
        returnFocusTo={returnFocusTo}
      />
    </div>
  );
}
