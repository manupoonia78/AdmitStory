// Server-safe class lists shared by the dock's parts (app-shell.tsx, account-trigger.tsx).
//
// From 640px the dock is a slim floating plane on the left: icons only, 64px wide. Hovering it
// (fine pointers), keyboard focus inside it, or an open menu or palette glides it open to 208px
// and fades its labels in; Escape folds a hover-opened dock away again (WCAG 1.4.13). The labels
// are always in the DOM, so each item's accessible name is its label whether it shows or not.
// Below 640px the destinations sit in a floating bottom dock with their labels always visible.

/** The dock's open state, keyed off the dock (`group/dock`). */
const OPEN = [
  "sm:group-hover/dock:opacity-100",
  "sm:group-has-[:focus-visible]/dock:opacity-100",
  "sm:group-has-[[aria-expanded=true]]/dock:opacity-100",
  "sm:group-data-[folded]/dock:opacity-0!",
].join(" ");

/** A label beside an icon in the open dock. Fades on the glide curve (120 ms when reduced). */
export const DOCK_LABEL =
  "whitespace-nowrap sm:pr-3 sm:opacity-0 sm:transition-opacity sm:duration-(--spring-glide-duration) sm:ease-glide " +
  OPEN;

/** The fixed 44px square each dock icon sits in, so icons never move as the dock opens. */
export const DOCK_ICON = "grid shrink-0 place-items-center sm:size-11";
