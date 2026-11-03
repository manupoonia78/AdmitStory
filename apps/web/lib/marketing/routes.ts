// The public marketing site (spec §16 Phase 9a): the only pages that are indexed. The sitemap,
// robots.txt, the bundle budget and the Lighthouse run all read this list.

export const MARKETING_ROUTES = ["/", "/pricing", "/how-it-works", "/privacy", "/terms"] as const;

export type MarketingRoute = (typeof MARKETING_ROUTES)[number];

export function isMarketingRoute(path: string): path is MarketingRoute {
  return (MARKETING_ROUTES as readonly string[]).includes(path);
}
