// First-load JavaScript per route, gzipped (spec §6.11: initial JS ≤ 160 KB gz per app route).
// Next 16 no longer prints sizes after `next build`; it writes the chunk list per route to
// .next/diagnostics/route-bundle-stats.json, and this script gzips and adds them up.
//
//   pnpm --filter @admitstory/web bundle:check     (after `pnpm build`)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { z } from "zod";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BUDGET_KB = 160;

const RouteStats = z.array(
  z.object({
    route: z.string(),
    firstLoadUncompressedJsBytes: z.number(),
    firstLoadChunkPaths: z.array(z.string()),
  }),
);

const gzCache = new Map<string, number>();
function gzipBytes(chunk: string): number {
  let size = gzCache.get(chunk);
  if (size === undefined) {
    size = gzipSync(readFileSync(join(WEB_ROOT, chunk)), { level: 9 }).length;
    gzCache.set(chunk, size);
  }
  return size;
}

const kb = (bytes: number) => (bytes / 1024).toFixed(1);

const stats = RouteStats.parse(
  JSON.parse(readFileSync(join(WEB_ROOT, ".next/diagnostics/route-bundle-stats.json"), "utf8")),
);

const rows = stats
  .filter((s) => !s.route.startsWith("/_"))
  .map((s) => ({
    route: s.route,
    raw: s.firstLoadUncompressedJsBytes,
    gz: s.firstLoadChunkPaths.reduce((sum, chunk) => sum + gzipBytes(chunk), 0),
  }))
  .sort((a, b) => a.route.localeCompare(b.route));

console.log(`First-load JS per route (budget ${BUDGET_KB} KB gz)\n`);
console.log("Route".padEnd(24), "Raw KB".padStart(9), "Gzip KB".padStart(9));
for (const row of rows) {
  const flag = row.gz / 1024 > BUDGET_KB ? "  over budget" : "";
  console.log(row.route.padEnd(24), kb(row.raw).padStart(9), kb(row.gz).padStart(9) + flag);
}

const over = rows.filter((row) => row.gz / 1024 > BUDGET_KB);
if (over.length > 0) {
  console.error(`\n${over.length} route(s) over the ${BUDGET_KB} KB gz budget.`);
  process.exit(1);
}
