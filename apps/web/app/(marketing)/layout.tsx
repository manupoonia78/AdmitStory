// The public marketing site (spec §16 Phase 9a; direction §2, §9; plan §2.1). No app shell, no
// dock, no Radix: server markup with a handful of tiny client leaves.
//
// Theme: Night by default, Day only when the visitor chose Day (immersiveTheme). The hero and the
// pinned sequence pin themselves to Night; essay sheets are Day paper in either theme.

import { APP_NAME } from "@admitstory/shared/brand";
import {
  SkipLink,
  THEME_COOKIE,
  ViewTransitionStyles,
  immersiveTheme,
  parseThemePreference,
  themeColors,
} from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { absoluteUrl, siteUrl } from "@/lib/marketing/site-url";
import { PageTransition } from "./_chrome/page-transition";
import { SiteFooter } from "./_chrome/site-footer";
import { SiteNav } from "./_chrome/site-nav";
import { TrackClicks } from "./_chrome/track-clicks";
import { HELLO_EMAIL } from "./_copy/chrome";
import { SmoothScrollHost } from "./_motion/smooth-scroll-host";
import { JsonLd } from "./_ui/json-ld";
import "./_chrome/marketing.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    // The root layout keeps app pages out of search; these five pages opt back in.
    robots: { index: true, follow: true },
  };
}

async function themePreference() {
  return parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  return {
    width: "device-width",
    initialScale: 1,
    colorScheme: "light dark",
    themeColor: themeColors(await themePreference(), { immersive: true }),
  };
}

function organization() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    // A placeholder address isn't published as contact data.
    ...(HELLO_EMAIL.includes("TODO") ? {} : { email: HELLO_EMAIL }),
  };
}

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const preference = await themePreference();
  return (
    <div
      data-marketing-theme=""
      data-theme={immersiveTheme(preference)}
      className="min-h-dvh bg-space text-text"
    >
      <SkipLink />
      <SiteNav />
      {/* Pages without the landing hero start below the floating nav. */}
      <main
        id="main"
        tabIndex={-1}
        className="pt-24 outline-none sm:pt-28 has-[#hero]:pt-0 sm:has-[#hero]:pt-0"
      >
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter theme={preference} />
      <JsonLd data={organization()} />
      <ViewTransitionStyles />
      <SmoothScrollHost />
      <TrackClicks />
    </div>
  );
}
