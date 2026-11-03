"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SkipLink } from "../components/skip-link";
import type { ThemePreference } from "../theme-preference";
import type { AccountUser } from "./account-menu";
import { CommandPaletteHost } from "./command-palette-host";
import { Dock, type DockIcons } from "./dock";
import { useCommandK } from "./keyboard-shortcut";
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

  return (
    <div className="min-h-dvh text-text">
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

      {/* Room for the docks: the 64px side dock and its 12px float on each side from 640px, the
          floating bottom dock below it. */}
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none sm:pb-0 sm:pl-22"
      >
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
