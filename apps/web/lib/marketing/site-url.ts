// The public origin of the marketing site: SITE_URL (the production domain Manu provides), else
// APP_URL. Read straight from the environment rather than through serverEnv(), so the sitemap and
// robots.txt, which are built ahead of time, don't need the database or auth secrets.

type Env = Record<string, string | undefined>;

const FALLBACK = "http://localhost:3000";

function parse(value: string | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** The site's origin as a URL (for `metadataBase`), with no path. */
export function siteUrl(env: Env = process.env): URL {
  const url = parse(env.SITE_URL) ?? parse(env.APP_URL) ?? new URL(FALLBACK);
  return new URL(url.origin);
}

/** An absolute URL on the site for a path such as "/pricing". */
export function absoluteUrl(path: string, env: Env = process.env): string {
  return new URL(path, siteUrl(env)).toString();
}
