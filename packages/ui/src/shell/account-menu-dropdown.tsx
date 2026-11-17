"use client";

// The account menu itself (Radix DropdownMenu + floating-ui, ~30 KB gz). Only account-menu.tsx
// imports it, lazily, so it stays out of every route's first load (spec §6.11).

import { CardsThreeIcon, CheckIcon, GearIcon, SignOutIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef } from "react";
import { setThemePreference, useThemePreference } from "../components/theme-store";
import { cx } from "../lib/cx";
import { THEME_LABELS, THEME_PREFERENCES, parseThemePreference } from "../theme-preference";
import type { AccountMenuProps } from "./account-menu";
import { ACCOUNT_TRIGGER_CLASSES, AccountTriggerContent } from "./account-trigger";

export interface AccountMenuDropdownProps extends AccountMenuProps {
  /** Open on mount: the first click or key press on the placeholder trigger loaded this menu. */
  defaultOpen?: boolean;
  /** The placeholder trigger had keyboard focus when this replaced it. */
  focusTriggerOnMount?: boolean;
}

// SPEC §6.1: rows on the frost, 44px (the tap minimum), the highlight a step of frost.
const ITEM =
  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-full px-3 text-[14px] text-text-80 " +
  "outline-none [&_svg]:text-text-faint data-[highlighted]:bg-frost data-[highlighted]:text-text " +
  "data-[highlighted]:[&_svg]:text-text";

const SEPARATOR = "mx-3 my-1.5 h-px bg-edge";

export function AccountMenuDropdown({
  user,
  onSignOut,
  themeServerValue,
  className,
  defaultOpen = false,
  focusTriggerOnMount = false,
}: AccountMenuDropdownProps) {
  const preference = useThemePreference(themeServerValue);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The hand-over from the placeholder trigger; both props are fixed for this mount.
  useEffect(() => {
    if (focusTriggerOnMount && !defaultOpen) triggerRef.current?.focus();
  }, [focusTriggerOnMount, defaultOpen]);

  return (
    <DropdownMenu.Root defaultOpen={defaultOpen}>
      <DropdownMenu.Trigger ref={triggerRef} className={cx(ACCOUNT_TRIGGER_CLASSES, className)}>
        <AccountTriggerContent user={user} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        {/* Night in both themes: part of the casing. Opens from its trigger, closes faster. */}
        <DropdownMenu.Content
          data-theme="night"
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={cx(
            "casing-overlay z-50 min-w-64 max-w-[calc(100vw-1rem)] rounded-card p-1.5 text-text shadow-overlay",
            "origin-(--radix-dropdown-menu-content-transform-origin) transition-[opacity,scale] duration-150 ease-rise",
            "starting:scale-[0.97] starting:opacity-0 motion-reduce:starting:scale-100",
            "data-[state=closed]:animate-[fade-out_100ms_linear_both]",
          )}
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[13px] leading-[18px] font-medium">{user.name}</p>
            <p className="truncate font-mono text-[11px] leading-4 text-text-soft">{user.email}</p>
          </div>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Item asChild className={ITEM}>
            <Link href="/settings">
              <GearIcon size={18} aria-hidden />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={ITEM}>
            <Link href="/dossier">
              <CardsThreeIcon size={18} aria-hidden />
              Your dossier
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Label className="label px-3 pb-1 pt-2 text-text-label">
            Theme
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) => setThemePreference(parseThemePreference(value))}
          >
            {THEME_PREFERENCES.map((option) => (
              <DropdownMenu.RadioItem
                key={option}
                value={option}
                // Keep the menu open so the change can be seen and adjusted.
                onSelect={(event) => event.preventDefault()}
                className={ITEM}
              >
                <span className="flex size-5 items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <CheckIcon size={16} aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </span>
                {THEME_LABELS[option]}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Item className={ITEM} onSelect={() => void onSignOut()}>
            <SignOutIcon size={18} aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
