// No icons here: the client dock imports this module, and every Phosphor icon carries all six of
// its weights (about 0.8 KB gz each). The icons live in nav-icons.ts, which only the server-side
// AppShell and the lazy palette import (spec §6.11: 160 KB per route).

export interface NavItem {
  id: NavId;
  /** Short label: beside the icon in the open dock, under it in the bottom dock. */
  label: string;
  href: string;
}

export type NavId = "home" | "studio" | "schools" | "interview" | "connect" | "tracker";

/** The six destinations of the dock (spec §6.5). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/home" },
  { id: "studio", label: "Story", href: "/studio" },
  { id: "schools", label: "Schools", href: "/schools" },
  { id: "interview", label: "Interview", href: "/interview" },
  { id: "connect", label: "Connect", href: "/connect" },
  { id: "tracker", label: "Tracker", href: "/tracker" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
