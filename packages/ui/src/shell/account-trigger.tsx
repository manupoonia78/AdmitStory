import { UserCircleIcon } from "@phosphor-icons/react/ssr";

// Shared by the placeholder trigger (account-menu.tsx) and the real one (account-menu-dropdown.tsx)
// so the hand-over between them is invisible.

export const ACCOUNT_TRIGGER_CLASSES =
  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-control text-sm font-medium text-slate " +
  "hover:bg-ink-soft hover:text-graphite data-[state=open]:bg-ink-soft data-[state=open]:text-ink sm:min-h-14 sm:w-18";

export function AccountTriggerContent() {
  return (
    <>
      <UserCircleIcon size={20} aria-hidden />
      <span className="sr-only sm:not-sr-only">Account</span>
    </>
  );
}
