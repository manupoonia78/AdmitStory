import type { Icon } from "@phosphor-icons/react";

/** Accessible name and placeholder for the palette and its trigger. */
export const PALETTE_LABEL = "Search or jump to…";

/** A command palette entry beyond the navigation destinations (spec §6.5). */
export interface CommandAction {
  id: string;
  /** Names the action: "Record a new story", "Start a mock interview". */
  label: string;
  /** Group heading, e.g. "Schools" or "Stories". Defaults to "Actions". */
  group?: string;
  keywords?: string[];
  icon?: Icon;
  /** Navigate here when chosen… */
  href?: string;
  /** …and/or run this. */
  onSelect?: () => void;
}
