import type { Icon } from "@phosphor-icons/react";
// SSR-safe icons: this data module is also evaluated by server components that import the
// package barrel, where the client icon build (which creates a React context) cannot load.
import {
  BookOpenTextIcon,
  ChatsCircleIcon,
  GraduationCapIcon,
  HouseIcon,
  ListChecksIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";

export interface NavItem {
  id: string;
  /** Short label shown under the icon in the rail and the tab bar. */
  label: string;
  href: string;
  icon: Icon;
}

/** The six destinations of the left rail and mobile tab bar (spec §6.4). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/home", icon: HouseIcon },
  { id: "studio", label: "Story", href: "/studio", icon: BookOpenTextIcon },
  { id: "schools", label: "Schools", href: "/schools", icon: GraduationCapIcon },
  { id: "interview", label: "Interview", href: "/interview", icon: ChatsCircleIcon },
  { id: "connect", label: "Connect", href: "/connect", icon: UsersThreeIcon },
  { id: "tracker", label: "Tracker", href: "/tracker", icon: ListChecksIcon },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
