// The sitemap lists the five public marketing pages only (direction §9, plan §3.8). App pages are
// private and noindex. lastModified is the build date until the legal pages carry their own
// "last updated" constants (package E).

import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { absoluteUrl } from "@/lib/marketing/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date();
  return MARKETING_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: built,
    changeFrequency: path === "/privacy" || path === "/terms" ? "yearly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
