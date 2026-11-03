/**
 * Sets the front matter's `version:` of a canon document or a prompt template, so the parsed file
 * names the version it is stored as (the registry overlay checks it). Plain TS.
 */
export function withFrontMatterVersion(source: string, version: number): string {
  const text = source.replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return text;
  const head = text.slice(0, end);
  const next = /^version:.*$/m.test(head)
    ? head.replace(/^version:.*$/m, `version: ${version}`)
    : `${head}\nversion: ${version}`;
  return next + text.slice(end);
}
