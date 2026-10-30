// No icons here: the client dock imports this module, and every Phosphor icon carries all six of
// its weights (about 0.8 KB gz each). The icons live in nav-icons.ts, which only the server-side
// AppShell and the lazy palette import (spec §6.11: 160 KB per route).

export interface NavItem {
  id: NavId;
  /**
   * Short label: beside the icon in the open side dock, and the accessible name everywhere. The
   * bottom dock shows icons only — seven labels do not fit a 375px screen at the 13px minimum —
   * so this is what a screen reader reads there.
   */
  label: string;
  href: string;
}

export type NavId = "home" | "studio" | "dossier" | "schools" | "interview" | "connect" | "tracker";

/** The destinations of the dock (spec §6.5), in the order of §4's journey. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/home" },
  { id: "studio", label: "Story", href: "/studio" },
  { id: "dossier", label: "Dossier", href: "/dossier" },
  { id: "schools", label: "Schools", href: "/schools" },
  { id: "interview", label: "Interview", href: "/interview" },
  { id: "connect", label: "Connect", href: "/connect" },
  { id: "tracker", label: "Tracker", href: "/tracker" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
