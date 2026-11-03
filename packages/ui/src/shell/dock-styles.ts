// Server-safe class lists shared by the sidebar's parts (dock.tsx, account-trigger.tsx).
//
// From 1024px the navigation is a light sidebar on the left (256px): wordmark, New story, search,
// the destinations, then Settings and the account at the foot. Below 1024px the same element
// splits into a top bar (wordmark, search, account) and a bottom tab bar of icons, each named by
// its label for screen readers.

/** A label beside an icon: visible in the sidebar, screen-reader only in the bottom tab bar. */
export const DOCK_LABEL = "sr-only lg:not-sr-only lg:truncate";

/** The fixed square each icon sits in. */
export const DOCK_ICON = "grid size-11 shrink-0 place-items-center lg:size-5";
