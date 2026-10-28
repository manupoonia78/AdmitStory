"use client";

// The account menu itself (Radix DropdownMenu + floating-ui, ~30 KB gz). Only account-menu.tsx
// imports it, lazily, so it stays out of every route's first load (spec §6.9).

import { CheckIcon, GearIcon, SignOutIcon } from "@phosphor-icons/react";
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

const ITEM =
  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-control px-3 text-graphite " +
  "focus-visible:-outline-offset-2 data-[highlighted]:bg-ink-soft data-[highlighted]:text-ink";

const SEPARATOR = "my-1 h-px bg-line";

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
        <AccountTriggerContent />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="z-50 min-w-64 max-w-[calc(100vw-1rem)] rounded-panel border border-line bg-paper p-1 text-graphite shadow-overlay"
        >
          <div className="px-3 py-2">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-slate">{user.email}</p>
          </div>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Item asChild className={ITEM}>
            <Link href="/settings">
              <GearIcon size={20} aria-hidden />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Label className="px-3 pb-1 pt-2 text-sm font-medium text-slate">
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
                    <CheckIcon size={20} aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </span>
                {THEME_LABELS[option]}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className={SEPARATOR} />
          <DropdownMenu.Item className={ITEM} onSelect={() => void onSignOut()}>
            <SignOutIcon size={20} aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
