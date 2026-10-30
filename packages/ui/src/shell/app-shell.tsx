// Server-safe on purpose (no "use client"): this is where the dock's icons are rendered, so the
// browser receives finished <svg> elements and none of the icon code. Every Phosphor icon carries
// all six of its weights; the dock's seven cost about 5.5 KB gz of each app route's first load
// (spec §6.11: 160 KB per route). Import it from server components only, as (app)/layout does.

import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import type { ThemePreference } from "../theme-preference";
import type { AccountUser } from "./account-menu";
import { AppShellFrame } from "./app-shell-frame";
import type { DockIcons } from "./dock";
import { NAV_ICONS } from "./nav-icons";
import { NAV_ITEMS } from "./nav-items";
import type { CommandAction } from "./types";

export interface AppShellProps {
  children: ReactNode;
  user: AccountUser;
  onSignOut: () => void | Promise<void>;
  /** Extra palette entries ("Record a new story", schools, stories) beyond the six destinations. */
  actions?: readonly CommandAction[];
  /** The theme cookie as read on the server, so the account menu hydrates without a flicker. */
  themeServerValue?: ThemePreference;
}

function dockIcons(): DockIcons {
  const nav: Record<string, ReactNode> = {};
  for (const item of NAV_ITEMS) {
    const ItemIcon = NAV_ICONS[item.id];
    nav[item.id] = <ItemIcon size={20} aria-hidden />;
  }
  return { nav, search: <MagnifyingGlassIcon size={20} aria-hidden /> };
}

/**
 * Signed-in frame: the dock (spec §6.5), the routed content and the ⌘K palette. The body paints
 * --space and its film grain; the shell adds no background of its own. Dock and palette
 * navigations animate the content through View Transitions while the dock stays put.
 */
export function AppShell(props: AppShellProps) {
  return <AppShellFrame {...props} icons={dockIcons()} />;
}
