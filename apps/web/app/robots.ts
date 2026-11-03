// robots.txt (plan §3.8): the marketing pages are open to crawlers; the app, the API, the admin,
// the prototypes and the recommender portal are not. App pages also carry their own noindex.

import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/marketing/site-url";

export const ROBOTS_DISALLOW = [
  "/api/",
  "/admin",
  "/prototype",
  "/r/",
  "/home",
  "/studio",
  "/workspace",
  "/kits",
  "/schools",
  "/settings",
  "/welcome",
  "/first-run",
  "/dossier",
  "/profile-read",
  "/resume",
  "/tracker",
  "/interview",
  "/connect",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
