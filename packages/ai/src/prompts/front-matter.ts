/**
 * Parses the small YAML subset used in prompt headers: `key: value` scalars, inline lists
 * (`key: [a, b]`) and block lists (`key:` followed by `  - item` lines). Values may be quoted.
 */
export type FrontMatterValue = string | string[];

export interface ParsedFrontMatter {
  meta: Record<string, FrontMatterValue>;
  body: string;
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first)) return value.slice(1, -1);
  }
  return value;
}

function parseInlineList(raw: string): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map(unquote)
    .filter((item) => item !== "");
}

export function parseFrontMatter(source: string, fileLabel: string): ParsedFrontMatter {
  const text = source.replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n"))
    throw new Error(`${fileLabel}: missing front matter (must start with ---)`);
  const end = text.indexOf("\n---", 4);
  if (end === -1) throw new Error(`${fileLabel}: front matter is not closed with ---`);

  const header = text.slice(4, end).split("\n");
  const body = text.slice(end + "\n---".length).replace(/^[^\n]*\n/, "");
  const meta: Record<string, FrontMatterValue> = {};
  let openList: string[] | null = null;

  header.forEach((line, index) => {
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (!openList)
        throw new Error(`${fileLabel}: list item outside a list on header line ${index + 1}`);
      openList.push(unquote(item[1] ?? ""));
      return;
    }
    const pair = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (!pair) throw new Error(`${fileLabel}: cannot parse header line ${index + 1}: "${line}"`);
    const key = pair[1] ?? "";
    const raw = (pair[2] ?? "").trim();
    if (Object.hasOwn(meta, key)) throw new Error(`${fileLabel}: duplicate header key "${key}"`);

    if (raw === "") {
      openList = [];
      meta[key] = openList;
    } else if (raw.startsWith("[") && raw.endsWith("]")) {
      openList = null;
      meta[key] = parseInlineList(raw);
    } else {
      openList = null;
      meta[key] = unquote(raw);
    }
  });

  return { meta, body: body.trim() };
}
