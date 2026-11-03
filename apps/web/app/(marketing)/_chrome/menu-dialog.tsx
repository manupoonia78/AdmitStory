"use client";

// The phone menu (direction §4.1, deviation D9): a native <dialog> styled as a full-height sheet
// (radius 28 at the top, rising on glide), not Radix. The word "Menu" is the control, 44 px.
// Escape and the Close button close it; focus returns to "Menu".

import Link from "next/link";
import { useRef } from "react";
import { NAV_COPY, NAV_LINKS } from "../_copy/chrome";
import { SIGN_IN } from "../_copy/shared";

const ITEMS = [...NAV_LINKS, { href: "/sign-in", label: SIGN_IN }] as const;

export function MenuDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    dialog.current?.close();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-base text-text lg:hidden"
      >
        {NAV_COPY.menu}
      </button>
      <dialog
        ref={dialog}
        aria-label={NAV_COPY.menuTitle}
        className="site-menu"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop (the dialog element itself, outside the sheet) closes it.
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="site-menu-sheet flex h-full flex-col px-4 pb-8 pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-base text-text"
            >
              {NAV_COPY.closeMenu}
            </button>
          </div>
          <nav aria-label={NAV_COPY.menuTitle} className="mt-8">
            <ul role="list" className="divide-y divide-edge border-y border-edge">
              {ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-16 items-center text-display-sm text-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
