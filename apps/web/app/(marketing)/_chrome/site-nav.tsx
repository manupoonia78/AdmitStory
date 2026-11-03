// The floating nav (direction §4.1, plan §8.6). Server markup; two tiny client leaves:
// NavCompact (marks the header once the hero has scrolled past) and MenuDialog (phones).
//
// Over the landing hero the plane is transparent with no edge. Past the hero, and on pages
// without a hero from the first paint, it is --depth at 88% with a faint blur and a 1px --edge,
// changing on glide (marketing.css, .site-header). view-transition-name: site-header keeps it
// still between pages.

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { NAV_COPY, NAV_LINKS, WORDMARK } from "../_copy/chrome";
import { SIGN_IN, START_FREE } from "../_copy/shared";
import { trackAttributes } from "../_lib/track";
import { START_FREE_HREF } from "../_ui/cta-link";
import { MenuDialog } from "./menu-dialog";
import { NavCompact } from "./nav-compact";

const LINK =
  "inline-flex min-h-11 items-center rounded-control px-3 text-base text-text-soft transition-colors duration-(--spring-snap-duration) ease-snap hover:text-text";

export function SiteNav() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-4">
      <div className="site-header-plane mx-auto flex h-14 max-w-[1416px] items-center gap-2 rounded-plane pl-3 pr-2 sm:h-16 sm:pl-5 sm:pr-3">
        <Link
          href="/"
          aria-label={NAV_COPY.home}
          className="inline-flex min-h-11 items-center text-lg font-semibold tracking-[-0.01em] text-text"
        >
          {WORDMARK}
        </Link>
        <nav aria-label={NAV_COPY.label} className="ml-auto flex items-center gap-1">
          <ul className="hidden items-center gap-1 lg:flex" role="list">
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
          <Link
            href={START_FREE_HREF}
            className={cx(buttonStyles({ variant: "primary" }), "ml-1 min-h-10 px-4 lg:ml-3")}
            {...trackAttributes("cta_start_free", { location: "nav" })}
          >
            {START_FREE}
          </Link>
          <MenuDialog />
        </nav>
      </div>
      <NavCompact />
    </header>
  );
}
