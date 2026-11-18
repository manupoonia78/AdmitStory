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

export type NavId = "home" | "studio" | "schools" | "resume" | "interview" | "connect" | "tracker";

/**
 * The destinations of the sidebar, in the order of §4's journey. The Dossier is not here: it lives
 * under Settings (SETTINGS_PATHS), reached from the Settings page and the account menu.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/home" },
  { id: "studio", label: "Story Studio", href: "/studio" },
  { id: "schools", label: "Schools", href: "/schools" },
  { id: "resume", label: "Résumé", href: "/resume" },
  { id: "interview", label: "Interview", href: "/interview" },
  { id: "connect", label: "Connect", href: "/connect" },
  { id: "tracker", label: "Tracker", href: "/tracker" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Routes that light the sidebar's Settings entry. */
export const SETTINGS_PATHS = ["/settings", "/dossier"] as const;

/**
 * Immersive screens: the sidebar folds to a 64px rail and the bay runs edge to edge (SPEC §6.1).
 * Phase 6 adds the essay editor.
 */
export const RAIL_PATHS = ["/studio", "/workspace"] as const;

/** Rail screens whose bay is the Night instrument in both themes; the rest keep the desk (SPEC §6.9). */
export const NIGHT_RAIL_PATHS = ["/studio"] as const;

/** Names the top bar shows for pages that are not one of the seven destinations. */
const OTHER_TITLES: readonly (readonly [string, string])[] = [
  ["/settings", "Settings"],
  ["/dossier", "Your dossier"],
  ["/recommenders", "Recommenders"],
  ["/profile-read", "Profile Read"],
  ["/workspace", "Your draft"],
  ["/kits", "Your kit"],
];

/** The page's name in the top bar below 1024px. */
export function pageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((entry) => isActivePath(pathname, entry.href));
  if (item) return item.label;
  return OTHER_TITLES.find(([href]) => isActivePath(pathname, href))?.[1] ?? "AdmitStories";
}
