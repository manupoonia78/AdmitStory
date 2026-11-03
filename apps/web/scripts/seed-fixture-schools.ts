// Loads the six FICTIONAL fixture schools (fixtures/schools/*/pack.json) with a published pack each,
// so the whole Phase 3–4 flow (strategy, preview, unlock with the test checkout, kit, workspace)
// runs locally before any real pack is verified. Quillfeather is left without a published pack, to
// show "Pack coming soon". Refuses to run unless APP_URL is localhost. Safe to re-run.
//
//   pnpm --filter @admitstory/web seed:fixtures

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, schoolCycles, schoolPacks, schools } from "@admitstory/db";
import { compilePack } from "@admitstory/kb";
import { isLocalAppUrl } from "../lib/env";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const COMING_SOON = new Set(["quillfeather"]);
const REGION: Record<string, "us" | "europe" | "asia_other"> = {
  US: "us",
  CA: "us",
  GB: "europe",
  FR: "europe",
  SG: "asia_other",
};

async function main(): Promise<void> {
  const env = join(ROOT, ".env.local");
  if (existsSync(env)) process.loadEnvFile(env);
  const appUrl = process.env.APP_URL ?? "";
  if (!appUrl || !isLocalAppUrl(appUrl))
    throw new Error("Fixture schools load only when APP_URL is localhost.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  const { db, pool } = createDb(url, { max: 1 });
  try {
    const dir = join(ROOT, "fixtures/schools");
    for (const slug of readdirSync(dir).filter((d) => existsSync(join(dir, d, "pack.json")))) {
      const pack = JSON.parse(readFileSync(join(dir, slug, "pack.json"), "utf8"));
      const country = String(pack.school.country ?? "US");
      const [school] = await db
        .insert(schools)
        .values({
          slug: `fixture-${slug}`,
          name: `${pack.school.name} (fictional)`,
          shortName: pack.school.short_name,
          country,
          region: REGION[country] ?? "us",
          website: pack.school.website ?? null,
        })
        .onConflictDoUpdate({
          target: schools.slug,
          set: { name: `${pack.school.name} (fictional)` },
        })
        .returning();
      if (!school) continue;
      const existing = await db.query.schoolCycles.findFirst({
        where: (t, { and, eq }) => and(eq(t.schoolId, school.id), eq(t.cycle, pack.cycle)),
      });
      const cycle =
        existing ??
        (
          await db
            .insert(schoolCycles)
            .values({ schoolId: school.id, cycle: pack.cycle, status: "live" })
            .returning()
        )[0];
      if (!cycle) continue;
      if (COMING_SOON.has(slug)) {
        console.log(`[fixtures] ${pack.school.short_name}: pack coming soon`);
        continue;
      }
      const published = await db.query.schoolPacks.findFirst({
        where: (t, { and, eq }) => and(eq(t.cycleId, cycle.id), eq(t.status, "published")),
      });
      if (published) {
        console.log(
          `[fixtures] ${pack.school.short_name}: already published (v${published.version})`,
        );
        continue;
      }
      const compiled = compilePack(pack, { cycle: pack.cycle, now: new Date() });
      await db.insert(schoolPacks).values({
        cycleId: cycle.id,
        version: 1,
        status: "published",
        data: pack,
        compiledPrompt: compiled.text,
        tokenCount: compiled.tokenCount,
        publishedAt: new Date(),
      });
      console.log(
        `[fixtures] ${pack.school.short_name}: published v1 (${compiled.tokenCount} tokens)`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[fixtures] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
