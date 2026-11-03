import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as portal from "../src/repos/recommender-portal";

// Phase 6 AC "no applicant-facing route returns letter prose or recommender notes", the structural
// half (plan §9): what a recommender writes lives in three encrypted workspace columns, and only
// the token-side repository touches them. This scan keeps it that way:
//   1. the column names appear only in the schema, the migration and its snapshot, and
//      repos/recommender-portal.ts (plus tests);
//   2. the token-side repository is imported only by the portal's own code (apps/web/lib/portal,
//      app/api/r, app/r), by packages/db itself, and by tests.

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "coverage",
  ".git",
  ".outbox",
]);
const CODE = /\.(ts|tsx|mts|cts|js|mjs|sql|json)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (CODE.test(name)) out.push(relative(ROOT, path).split(sep).join("/"));
  }
  return out;
}

const files = [...walk(join(ROOT, "apps")), ...walk(join(ROOT, "packages"))];
const isTest = (path: string) =>
  /\.(test|int\.test|spec)\.(ts|tsx)$/.test(path) || /(^|\/)(test|tests|e2e)\//.test(path);

describe("the recommender's writing stays behind the portal repository", () => {
  it("scans the code base", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain("packages/db/src/repos/recommender-portal.ts");
  });

  it("names the encrypted workspace columns only in the schema, the migration and the portal repo", () => {
    const columns =
      /private_notes_encrypted|letter_draft_encrypted|voice_encrypted|privateNotesEncrypted|letterDraftEncrypted|voiceEncrypted/;
    const allowed = (path: string) =>
      path === "packages/db/src/schema/recommenders.ts" ||
      path === "packages/db/src/repos/recommender-portal.ts" ||
      /^packages\/db\/migrations\/(\d{4}_[a-z_]+\.sql|meta\/\d{4}_snapshot\.json)$/.test(path) ||
      isTest(path);
    const offenders = files.filter(
      (path) => !allowed(path) && columns.test(readFileSync(join(ROOT, path), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("is imported only by the portal's own code, packages/db and tests", () => {
    const names = [
      ...Object.keys(portal),
      "PortalAccess",
      "PortalResolution",
      "PortalClosedReason",
      "PortalWorkspace",
    ];
    expect(names).toContain("resolvePortalToken");
    const allowed = (path: string) =>
      path.startsWith("apps/web/lib/portal/") ||
      path.startsWith("apps/web/app/api/r/") ||
      path.startsWith("apps/web/app/r/") ||
      path.startsWith("packages/db/src/") ||
      isTest(path);
    const importFrom = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
    const offenders: string[] = [];
    for (const path of files) {
      if (allowed(path) || !/\.(ts|tsx)$/.test(path)) continue;
      const source = readFileSync(join(ROOT, path), "utf8");
      if (/recommender-portal["']/.test(source)) offenders.push(`${path}: imports the module`);
      for (const match of source.matchAll(importFrom)) {
        if (match[3] !== "@admitstory/db") continue;
        const imported = (match[2] ?? "")
          .split(",")
          .map((part) =>
            part
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0]!
              .trim(),
          )
          .filter(Boolean);
        for (const name of imported)
          if (names.includes(name)) offenders.push(`${path}: imports ${name}`);
      }
      if (/import\s+\*\s+as\s+\w+\s+from\s+["']@admitstory\/db["']/.test(source))
        offenders.push(`${path}: imports @admitstory/db as a namespace`);
    }
    expect(offenders).toEqual([]);
  });
});
