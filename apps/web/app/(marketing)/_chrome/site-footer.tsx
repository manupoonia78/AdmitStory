// The footer (direction §4.10): on --space in the page theme, a 1px --edge above, four columns on
// desktop and two on phones: Product, Trust, Contact and the theme switch. No social icons until
// accounts exist. Server markup; the theme switch is the only client leaf.

import type { ThemePreference } from "@admitstory/ui";
import Link from "next/link";
import {
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  HELLO_EMAIL,
  copyrightLine,
} from "../_copy/chrome";
import { SECTION_GRID } from "../_ui/section";
import { ThemeSwitch } from "./theme-switch";

const LINK =
  "inline-flex min-h-11 items-center text-base text-text-soft underline-offset-4 hover:text-text hover:underline";

export function SiteFooter({ theme }: { theme: ThemePreference }) {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="border-t border-edge bg-space">
      <div className={`${SECTION_GRID} gap-y-12 py-16 sm:py-20`}>
        {FOOTER_COLUMNS.map((column) => (
          <nav
            key={column.heading}
            aria-label={column.heading}
            className="col-span-2 sm:col-span-2 lg:col-span-3"
          >
            <h2 className="mb-3 text-sm text-text-soft">{column.heading}</h2>
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
        <div className="col-span-2 sm:col-span-2 lg:col-span-3">
          <h2 className="mb-3 text-sm text-text-soft">{FOOTER_CONTACT.heading}</h2>
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
        <div className="col-span-2 sm:col-span-2 lg:col-span-3">
          <ThemeSwitch initial={theme} />
        </div>
        <div className="col-span-4 border-t border-edge pt-6 text-sm text-text-soft sm:col-span-8 lg:col-span-12">
          <p>
            {copyrightLine(year)} {FOOTER_LEGAL}
          </p>
        </div>
      </div>
    </footer>
  );
}
