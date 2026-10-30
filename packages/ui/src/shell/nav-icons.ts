import type { Icon } from "@phosphor-icons/react";
// SSR-safe icons: AppShell renders them in a server component, where the client icon build (which
// creates a React context) cannot load.
import {
  BookOpenTextIcon,
  ChatsCircleIcon,
  GraduationCapIcon,
  HouseIcon,
  ListChecksIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import type { NavId } from "./nav-items";

/**
 * The icon of each dock destination. Kept apart from NAV_ITEMS so the client dock never bundles
 * icon code: the server renders these and hands the dock finished elements.
 */
export const NAV_ICONS: Readonly<Record<NavId, Icon>> = {
  home: HouseIcon,
  studio: BookOpenTextIcon,
  schools: GraduationCapIcon,
  interview: ChatsCircleIcon,
  connect: UsersThreeIcon,
  tracker: ListChecksIcon,
};
