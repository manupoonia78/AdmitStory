"use client";

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { cx } from "../lib/cx";
import type { ThemePreference } from "../theme-preference";
import type { AccountMenuDropdownProps } from "./account-menu-dropdown";
import { ACCOUNT_TRIGGER_CLASSES, AccountTriggerContent } from "./account-trigger";
import { whenIdle } from "./when-idle";

export interface AccountUser {
  name: string;
  email: string;
}

export interface AccountMenuProps {
  user: AccountUser;
  onSignOut: () => void | Promise<void>;
  themeServerValue?: ThemePreference;
  className?: string;
}

const loadDropdown = () => import("./account-menu-dropdown").then((m) => m.AccountMenuDropdown);

/**
 * Account menu (name, email, Settings, theme, sign out). The Radix menu is ~30 KB gz, so until
 * it has loaded a placeholder trigger with the same look and name stands in. The menu loads when
 * the page is idle, or on first hover, focus or press. A press opens it as soon as it arrives, and
 * if the placeholder had keyboard focus at the swap, the real trigger takes it over.
 */
export function AccountMenu(props: AccountMenuProps) {
  const [Dropdown, setDropdown] = useState<ComponentType<AccountMenuDropdownProps> | null>(null);
  const [openOnMount, setOpenOnMount] = useState(false);
  const [focusOnMount, setFocusOnMount] = useState(false);
  const placeholderRef = useRef<HTMLButtonElement>(null);
  const loading = useRef(false);

  function load() {
    if (loading.current) return;
    loading.current = true;
    void loadDropdown().then(
      (component) => {
        setFocusOnMount(document.activeElement === placeholderRef.current);
        setDropdown(() => component);
      },
      () => {
        loading.current = false;
      },
    );
  }

  useEffect(() => whenIdle(load), []);

  function openNow() {
    setOpenOnMount(true);
    load();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Radix menu triggers also open with the down arrow.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openNow();
    }
  }

  if (Dropdown) {
    return <Dropdown {...props} defaultOpen={openOnMount} focusTriggerOnMount={focusOnMount} />;
  }

  return (
    <button
      ref={placeholderRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={load}
      onFocus={load}
      onClick={openNow}
      onKeyDown={onKeyDown}
      className={cx(ACCOUNT_TRIGGER_CLASSES, props.className)}
    >
      <AccountTriggerContent />
    </button>
  );
}
