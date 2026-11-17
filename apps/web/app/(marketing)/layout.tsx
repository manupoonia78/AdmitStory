// The public marketing site (spec §16 Phase 9a; direction §2, §9; plan §2.1). No app shell, no
// dock, no Radix: server markup with a handful of tiny client leaves.
//
// Theme: dark only (SPEC §4). The marketing site is the instrument whatever the visitor's app
// preference is; a scene that is about reading turns to paper by carrying data-theme="day" itself.
// The grain is painted once, here, so every dark scene shares one field.

import { APP_NAME } from "@admitstory/shared/brand";
import { SkipLink, ViewTransitionStyles, themeColors } from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { absoluteUrl, siteUrl } from "@/lib/marketing/site-url";
import { PageTransition } from "./_chrome/page-transition";
import { SiteFooter } from "./_chrome/site-footer";
import { SiteNav } from "./_chrome/site-nav";
import { TrackClicks } from "./_chrome/track-clicks";
import { HELLO_EMAIL } from "./_copy/chrome";
import { JsonLd } from "./_ui/json-ld";
import "./_chrome/marketing.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    // The root layout keeps app pages out of search; these five pages opt back in.
    robots: { index: true, follow: true },
  };
}

export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    colorScheme: "dark",
    themeColor: themeColors("night"),
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

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="night" className="marketing grain min-h-dvh bg-space text-text">
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
      <SiteFooter />
      <JsonLd data={organization()} />
      <ViewTransitionStyles />
      <TrackClicks />
    </div>
  );
}
