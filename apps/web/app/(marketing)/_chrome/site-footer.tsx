// The footer (SPEC §4, scene 13): dark, above a hairline. The wordmark and one line, then Product,
// Trust and Contact, then the copyright and the affiliation disclaimer on a last hairline. Server
// markup, no client code: the marketing site is dark only, so the theme switch is gone.

import { Wordmark } from "@admitstory/ui";
import Link from "next/link";
import {
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  FOOTER_LINE,
  HELLO_EMAIL,
  NAV_COPY,
  copyrightLine,
} from "../_copy/chrome";
import { SECTION_GRID } from "../_ui/section";

const LINK =
  "inline-flex min-h-11 items-center text-ui font-normal text-text-soft transition-colors duration-(--dur-hover) hover:text-text";

export function SiteFooter() {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="border-t border-edge">
      <div className={`${SECTION_GRID} gap-y-12 pt-16 pb-10 lg:pt-24`}>
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <Link href="/" aria-label={NAV_COPY.home} className="inline-flex min-h-11 items-center">
            <Wordmark size={22} />
          </Link>
          <p className="mt-2 text-sm text-text-soft">{FOOTER_LINE}</p>
        </div>
        {FOOTER_COLUMNS.map((column, index) => (
          <nav
            key={column.heading}
            aria-label={column.heading}
            className={`col-span-2 sm:col-span-2 lg:col-span-2 ${index === 0 ? "lg:col-start-6" : ""}`}
          >
            <h2 className="label mb-2">{column.heading}</h2>
            <ul role="list">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="col-span-4 sm:col-span-4 lg:col-span-3">
          <h2 className="label mb-2">{FOOTER_CONTACT.heading}</h2>
          <ul role="list">
            <li>
              <a href={`mailto:${HELLO_EMAIL}`} className={LINK}>
                {HELLO_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${HELLO_EMAIL}?subject=${encodeURIComponent(FOOTER_CONTACT.coverSchoolSubject)}`}
                className={LINK}
              >
                {FOOTER_CONTACT.coverSchool}
              </a>
            </li>
          </ul>
        </div>
        <p className="col-span-4 border-t border-edge pt-6 text-sm text-text-label sm:col-span-8 lg:col-span-12">
          {copyrightLine(year)} {FOOTER_LEGAL}
        </p>
      </div>
    </footer>
  );
}
