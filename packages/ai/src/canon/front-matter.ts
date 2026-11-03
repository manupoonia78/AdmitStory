export interface FrontMatter {
  slug: string;
  title: string;
  version: number;
}

const KEYS = new Set(["slug", "title", "version"]);

/**
 * Parses the small `key: value` front matter every canon file starts with.
 * Deliberately strict (no YAML dependency): exactly slug, title and version.
 */
export function parseFrontMatter(
  source: string,
  fileName: string,
): { meta: FrontMatter; content: string } {
  const fail = (reason: string): never => {
    throw new Error(`Canon file ${fileName}: invalid front matter (${reason})`);
  };

  const lines = source.split("\n");
  if (lines[0] !== "---") fail("file must start with a '---' line");
  const close = lines.indexOf("---", 1);
  if (close === -1) fail("missing closing '---' line");

  const values = new Map<string, string>();
  for (const line of lines.slice(1, close)) {
    const match = /^([a-z]+):\s*(.*?)\s*$/.exec(line);
    if (!match) fail(`malformed line "${line}"`);
    const [, key = "", value = ""] = match ?? [];
    if (!KEYS.has(key)) fail(`unknown key "${key}"`);
    if (values.has(key)) fail(`duplicate key "${key}"`);
    if (value === "") fail(`empty value for "${key}"`);
    values.set(key, value);
  }

  const slug = values.get("slug") ?? fail('missing "slug"');
  const title = values.get("title") ?? fail('missing "title"');
  const rawVersion = values.get("version") ?? fail('missing "version"');
  if (!/^[1-9]\d*$/.test(rawVersion))
    fail(`version must be a positive integer, got "${rawVersion}"`);

  return {
    meta: { slug, title, version: Number(rawVersion) },
    content: lines.slice(close + 1).join("\n"),
  };
}
