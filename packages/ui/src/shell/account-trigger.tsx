import { UserCircleIcon } from "@phosphor-icons/react/ssr";
import { cx } from "../lib/cx";
import { DOCK_ICON, DOCK_LABEL } from "./dock-styles";

// Shared by the placeholder trigger (account-menu.tsx) and the real one (account-menu-dropdown.tsx)
// so the hand-over between them is invisible. A 44px icon in the mobile top bar; the bottom row of
// the dock from 640px, labelled when the dock is open.

export const ACCOUNT_TRIGGER_CLASSES =
  "flex min-h-11 min-w-11 items-center justify-center rounded-control text-sm font-medium text-text-soft " +
  "hover:bg-veil hover:text-text data-[state=open]:bg-veil data-[state=open]:text-signal " +
  "sm:w-full sm:justify-start";

export function AccountTriggerContent() {
  return (
    <>
      <span className={DOCK_ICON}>
        <UserCircleIcon size={20} aria-hidden />
      </span>
      <span className={cx("sr-only sm:not-sr-only", DOCK_LABEL)}>Account</span>
    </>
  );
}
