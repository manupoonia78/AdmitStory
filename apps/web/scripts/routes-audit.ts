// Route guard inventory (Phase 9b §9): lists every app/api/**/route.ts and fails when a handler
// that changes state (POST, PUT, PATCH, DELETE) calls none of the known guards, and carries no
// `// public-route: <why>` comment. A static lint, not a test: it reads source text.
//
//   pnpm --filter @admitstory/web routes:audit          # failures only
//   pnpm --filter @admitstory/web routes:audit --all    # the whole inventory

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = fileURLToPath(new URL("../app/api", import.meta.url));
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;
const GUARDS = [
  "requireUser",
  "requireOnboardedUser",
  "requireAdmin",
  "adminRoute",
  "requireAdminApi",
  "resolvePortalToken",
  "portalAccess", // the recommender portal: the token in the path is the credential
  "portalRoute",
  "verifyWebhook",
  "verifySignature",
  "verifyPaddle",
  "processWebhook", // verifies the provider signature over the raw body
  "serve(", // Inngest's handler verifies its own signing key
  "toNextJsHandler", // Better Auth
  "getAuth().handler", // Better Auth, which checks its own trusted origins
  "devOnly",
  "isLocalAppUrl", // development-only routes: a 404 unless APP_URL is localhost
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return name === "route.ts" ? [path] : [];
  });
}

interface Row {
  route: string;
  methods: string[];
  guards: string[];
  publicWhy: string | null;
  ok: boolean;
}

const rows: Row[] = walk(APP_DIR)
  .sort()
  .map((file) => {
    const source = readFileSync(file, "utf8");
    const route = `/api/${relative(APP_DIR, file).replace(/\/?route\.ts$/, "")}`;
    const methods = [
      ...source.matchAll(
        /export\s+(?:async\s+)?(?:function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g,
      ),
    ].map((m) => m[1] ?? "");
    // Re-exported handlers: `export const { GET, POST } = …`.
    const destructured = /export\s+const\s+\{([^}]+)\}/.exec(source)?.[1];
    if (destructured)
      for (const name of destructured.split(",").map((s) => s.trim()))
        if (/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(name)) methods.push(name);
    const guards = GUARDS.filter((g) => source.includes(g));
    const publicWhy = /\/\/\s*public-route:\s*(.+)/.exec(source)?.[1]?.trim() ?? null;
    const mutates = methods.some((m) => (MUTATING as readonly string[]).includes(m));
    return {
      route,
      methods,
      guards,
      publicWhy,
      ok: !mutates || guards.length > 0 || publicWhy !== null,
    };
  });

const all = process.argv.includes("--all");
for (const row of rows) {
  if (!all && row.ok) continue;
  const mark = row.ok ? "ok  " : "FAIL";
  const why = row.publicWhy ? `public: ${row.publicWhy}` : row.guards.join(", ") || "no guard";
  console.log(`${mark} ${row.route.padEnd(60)} ${row.methods.join(",").padEnd(18)} ${why}`);
}
const failures = rows.filter((r) => !r.ok);
console.log(`\n${rows.length} routes, ${failures.length} unguarded mutating handlers.`);
process.exit(failures.length > 0 ? 1 : 0);
