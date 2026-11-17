// Server-safe class names shared by the sidebar's parts (dock.tsx, account-trigger.tsx). The
// styles themselves are in casing.css (SPEC §6.1): one element serves the sidebar from 1024px
// (or the 64px rail on immersive screens) and, below it, a top bar and a floating dock.

/** A label beside an icon: visible in the sidebar, screen-reader only in the dock and the rail. */
export const DOCK_LABEL = "casing-label";

/** The square an icon sits in: 44px in the dock, 18px in the sidebar. */
export const DOCK_ICON = "casing-icon";
