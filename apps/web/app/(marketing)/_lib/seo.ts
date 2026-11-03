// Page metadata for the marketing site (direction §9, plan §3.8). Every page gets a title, one
// plain description, its canonical URL, Open Graph and a large Twitter card. The OG image itself
// comes from ../opengraph-image.tsx by file convention, so it isn't named here.

import { APP_NAME } from "@admitstory/shared/brand";
import type { Metadata } from "next";
import type { MarketingRoute } from "@/lib/marketing/routes";

/** The landing page's title, used as is (not through the "%s | AdmitStory" template). */
export const HOME_TITLE = `${APP_NAME}: your MBA application, in your own words`;
export const HOME_DESCRIPTION =
  "Talk about your life and work, and AdmitStory turns it into your MBA application, school by school, in your own words.";

export interface PageMetadataInput {
  /** A page title ("Pricing"), or `{ absolute }` for the landing page. */
  title: string | { absolute: string };
  description: string;
  path: MarketingRoute;
}

export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const plainTitle = typeof title === "string" ? `${title} | ${APP_NAME}` : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      url: path,
      title: plainTitle,
      description,
      locale: "en",
    },
    twitter: { card: "summary_large_image", title: plainTitle, description },
  };
}
