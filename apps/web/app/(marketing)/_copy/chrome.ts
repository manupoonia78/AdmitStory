// The nav, the phone menu, the footer and the theme switch (direction §4.1, §4.10, §9).

import { APP_NAME } from "@admitstory/shared/brand";

/**
 * The contact addresses on admitstories.com. TODO(Manu): the legal entity; until it is set, the
 * footer shows this placeholder; nothing here is invented.
 */
export const LEGAL_ENTITY = "TODO(Manu): legal entity";
export const HELLO_EMAIL = "hello@admitstories.com";
export const PRIVACY_EMAIL = "privacy@admitstories.com";

export const WORDMARK = APP_NAME;

export const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const NAV_COPY = {
  label: "Main",
  home: `${APP_NAME} home`,
  menu: "Menu",
  closeMenu: "Close menu",
  menuTitle: "Menu",
} as const;

export const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { href: "/#wont-do", label: "What it won't do" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/how-it-works#ai-policies", label: "AI policies" },
    ],
  },
] as const;

export const FOOTER_CONTACT = {
  heading: "Contact",
  coverSchool: "Ask us to cover a school",
  coverSchoolSubject: "Please cover a school",
} as const;

export const FOOTER_LEGAL = `AdmitStories is not affiliated with any school. School names are used only to describe which applications we support.`;

export function copyrightLine(year: number): string {
  return `© ${year} ${LEGAL_ENTITY}.`;
}

export const THEME_SWITCH = {
  label: "Theme",
  night: "Night",
  day: "Day",
  note: "Night is easier at 1 a.m.",
} as const;
