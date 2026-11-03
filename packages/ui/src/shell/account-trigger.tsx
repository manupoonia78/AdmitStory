import { cx } from "../lib/cx";
import type { AccountUser } from "./account-menu";

// Shared by the placeholder trigger (account-menu.tsx) and the real one (account-menu-dropdown.tsx)
// so the hand-over between them is invisible. An initials disc in the mobile top bar; the foot of
// the sidebar from 1024px, with the name and email beside it.

export const ACCOUNT_TRIGGER_CLASSES =
  "flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-control text-left text-sm text-text-soft " +
  "hover:bg-veil hover:text-text data-[state=open]:bg-veil " +
  "lg:w-full lg:justify-start lg:px-2 lg:py-1.5";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1) ?? "") : "";
  return (last ? (first[0] ?? "") + (last[0] ?? "") : first.slice(0, 2)).toUpperCase();
}

export function AccountTriggerContent({ user }: { user?: AccountUser }) {
  return (
    <>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-text font-mono text-[11px] font-medium text-space"
      >
        {user ? initials(user.name || user.email) : "·"}
      </span>
      <span className="sr-only lg:not-sr-only lg:flex lg:min-w-0 lg:flex-col">
        <span className="sr-only">Account: </span>
        <span className={cx("truncate font-medium text-text")}>{user?.name ?? "Account"}</span>
        {user ? (
          <span className="truncate text-[12px] leading-4 text-text-soft">{user.email}</span>
        ) : null}
      </span>
    </>
  );
}
