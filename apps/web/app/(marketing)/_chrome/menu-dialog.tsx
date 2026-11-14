"use client";

// The phone menu (SPEC §3.3): a native <dialog> styled as a full-height sheet of the instrument
// (--bg with grain, 24px on top, rising on glide), not Radix. The trigger is a 40px round button
// with a 44px hit area. Escape, the backdrop and the Close button close it; focus returns to the
// trigger. The primary action sits at the bottom, above the safe-area inset.

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { useRef } from "react";
import { NAV_COPY, NAV_LINKS } from "../_copy/chrome";
import { SIGN_IN, START_STORY } from "../_copy/shared";
import { trackAttributes } from "../_lib/track";

const ITEMS = [...NAV_LINKS, { href: "/sign-in", label: SIGN_IN }] as const;

const ROUND =
  "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text frost-flat transition-colors duration-(--dur-hover) hover:bg-frost-hover before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-1/2";

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
        aria-label={NAV_COPY.menu}
        onClick={() => dialog.current?.showModal()}
        className={cx(ROUND, "ml-1 lg:hidden")}
      >
        <span aria-hidden="true" className="site-menu-glyph" />
      </button>
      <dialog
        ref={dialog}
        data-theme="night"
        aria-label={NAV_COPY.menuTitle}
        className="site-menu"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop (the dialog element itself, outside the sheet) closes it.
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="flex h-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <p className="label">{NAV_COPY.menuTitle}</p>
            <button type="button" aria-label={NAV_COPY.closeMenu} onClick={close} className={ROUND}>
              <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
              >
                <path d="M2 2l10 10M12 2 2 12" />
              </svg>
            </button>
          </div>
          <nav aria-label={NAV_COPY.menuTitle} className="mt-10">
            <ul role="list" className="divide-y divide-edge border-y border-edge">
              {ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-18 items-center font-display text-display-3 text-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/sign-in"
            onClick={close}
            className={cx(buttonStyles({ size: "lg", arrow: true }), "mt-auto w-full")}
            {...trackAttributes("cta_start_free", { location: "menu" })}
          >
            {START_STORY}
            <span aria-hidden="true" className="btn-arrow ml-auto" />
          </Link>
        </div>
      </dialog>
    </>
  );
}
