// The floating nav (SPEC §3.2, §3.3): one frosted pill, fixed, the same shape over every scene.
// Server markup; MenuDialog (phones) is its only client leaf.
//
// The pill is always the dark instrument (data-theme="night"), whatever the page beneath, and
// its edges sit on the page grid's margins. view-transition-name: site-header keeps it still
// between pages (marketing.css).

import { Wordmark, buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { NAV_COPY, NAV_LINKS, WORDMARK } from "../_copy/chrome";
import { SIGN_IN, START_STORY } from "../_copy/shared";
import { trackAttributes } from "../_lib/track";
import { START_FREE_HREF } from "../_ui/cta-link";
import { MenuDialog } from "./menu-dialog";

const LINK =
  "inline-flex min-h-11 items-center rounded-full px-3.5 text-ui text-text-80 transition-colors duration-(--dur-hover) ease-rise hover:text-text";

export function SiteNav() {
  return (
    <header className="site-header enter fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-8 lg:px-12 lg:pt-4">
      <div
        data-theme="night"
        className="site-header-plane mx-auto flex h-13 max-w-[1344px] items-center gap-1 rounded-full pl-4 pr-1.5 text-text lg:h-14 lg:pl-6 lg:pr-2"
      >
        <Link
          href="/"
          aria-label={NAV_COPY.home}
          className="inline-flex min-h-11 items-center rounded-full"
        >
          <Wordmark size={24} />
          <span className="sr-only">{WORDMARK}</span>
        </Link>
        <nav aria-label={NAV_COPY.label} className="ml-auto flex items-center gap-1">
          <ul className="hidden items-center lg:flex" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/sign-in" className={LINK}>
                {SIGN_IN}
              </Link>
            </li>
          </ul>
          {/* Laptops: 40px with the arrow circle. Phones: the small pill, no arrow. */}
          <Link
            href={START_FREE_HREF}
            className={cx(
              buttonStyles({ size: "md", arrow: true }),
              "ml-3 min-h-10 [--btn-arrow-size:1.75rem] max-lg:hidden",
            )}
            {...trackAttributes("cta_start_free", { location: "nav" })}
          >
            {START_STORY}
            <span aria-hidden="true" className="btn-arrow" />
          </Link>
          <Link
            href={START_FREE_HREF}
            className={cx(buttonStyles({ size: "sm" }), "max-[339px]:hidden lg:hidden")}
            {...trackAttributes("cta_start_free", { location: "nav" })}
          >
            {START_STORY}
          </Link>
          <MenuDialog />
        </nav>
      </div>
    </header>
  );
}
