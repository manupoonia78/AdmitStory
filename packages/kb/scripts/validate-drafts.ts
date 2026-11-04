// Validates every knowledge/schools/<slug>/<cycle>/pack.draft.json against the pack schema and its
// integrity rules (the check the admin "import draft" route runs), then compiles it and reports the
// token count against PACK_TOKEN_TARGET and what the compiler left out.
//
//   pnpm --filter @admitstory/kb exec tsx scripts/validate-drafts.ts [slug…]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compilePack, PACK_TOKEN_TARGET } from "../src/compiler";
import { SchoolPack } from "../src/schema/school-pack";

const root = join(import.meta.dirname, "../../../knowledge/schools");
const only = new Set(process.argv.slice(2));
let failed = 0;

for (const slug of readdirSync(root).sort()) {
  if (slug.startsWith(".")) continue;
  if (only.size > 0 && !only.has(slug)) continue;
  for (const cycle of readdirSync(join(root, slug))) {
    const file = join(root, slug, cycle, "pack.draft.json");
    if (!existsSync(file)) continue;
    const result = SchoolPack.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (result.success) {
      const compiled = compilePack(result.data, { cycle, now: new Date() });
      const reasons = new Map<string, number>();
      for (const e of compiled.excluded) reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);
      const inRange =
        compiled.tokenCount >= PACK_TOKEN_TARGET.min && compiled.tokenCount <= PACK_TOKEN_TARGET.max;
      console.log(
        `ok    ${slug}/${cycle}: ${compiled.tokenCount} tokens${inRange ? "" : " (outside target)"}, ` +
          `${Object.keys(compiled.itemIndex).length} citable, excluded ${JSON.stringify(Object.fromEntries(reasons))}`,
      );
    } else {
      failed++;
      console.log(`FAIL  ${slug}/${cycle}`);
      for (const issue of result.error.issues.slice(0, 20))
        console.log(`      ${issue.path.join(".")}: ${issue.message}`);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
