// Imports the researched drafts in knowledge/schools/<slug>/<cycle>/pack.draft.json and publishes
// each as its cycle's next pack version, the same writes the admin console's Import and Publish make
// (insertDraftPack, then publishPack, audited as a system job). The drafts themselves are not
// changed; what is published is a copy made publishable:
//
//   - every item with `verified_at: null` is stamped as verified today (Manu checked them by hand
//     on 2026-11-04 before the first run);
//   - `_todo` is dropped from the published copy (it stays in the draft file as the follow-up list);
//   - `status` becomes "complete".
//
// A cycle that already has a published pack is skipped, so re-running is safe. Pass --republish to
// publish a new version over it, --dry-run to report without writing, and slugs to limit the run.
//
//   pnpm --filter @admitstory/web packs:publish [--dry-run] [--republish] [slug…]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDb,
  inTransaction,
  insertDraftPack,
  publishPack,
  systemContext,
  updateDraftPack,
  type SchoolPackData,
} from "@admitstory/db";
import { citedNodes, compilePack, publishBlockers } from "@admitstory/kb";
import { parseSchoolPack } from "@admitstory/kb/schema";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CYCLE = "2026-27";

type Json = Record<string, unknown>;

/** The publishable copy of a draft, and the ids of the items it stamped as verified. */
function publishable(
  draft: Json,
  today: string,
): { pack: Json; stamped: string[]; todo: string[] } {
  const pack = structuredClone(draft);
  const stamped: string[] = [];
  // citedNodes hands back the pack's own objects, so stamping a node stamps the pack.
  for (const node of citedNodes(pack))
    if (node.verifiedAt === null) {
      node.node.verified_at = today;
      stamped.push(`${node.id} ${node.path}`);
    }
  const todo = Array.isArray(pack._todo) ? (pack._todo as string[]) : [];
  delete pack._todo;
  pack.status = "complete";
  return { pack, stamped, todo };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const republish = args.includes("--republish");
  const only = new Set(args.filter((a) => !a.startsWith("--")));

  const env = join(ROOT, ".env.local");
  if (existsSync(env)) process.loadEnvFile(env);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  console.log(`[packs] database ${new URL(url).host}${dryRun ? " (dry run)" : ""}`);

  const dir = join(ROOT, "knowledge/schools");
  const slugs = readdirSync(dir)
    .filter((slug) => existsSync(join(dir, slug, CYCLE, "pack.draft.json")))
    .filter((slug) => only.size === 0 || only.has(slug));

  const { db, pool } = createDb(url, { max: 1 });
  const admin = systemContext(db, "cli:packs:publish");
  const today = new Date().toISOString().slice(0, 10);
  let failed = 0;
  try {
    for (const slug of slugs) {
      const draft = JSON.parse(
        readFileSync(join(dir, slug, CYCLE, "pack.draft.json"), "utf8"),
      ) as Json;
      const { pack: candidate, stamped, todo } = publishable(draft, today);

      const school = await db.query.schools.findFirst({
        where: (t, { eq }) => eq(t.slug, slug),
      });
      const cycle = school
        ? await db.query.schoolCycles.findFirst({
            where: (t, { and, eq }) => and(eq(t.schoolId, school.id), eq(t.cycle, CYCLE)),
          })
        : undefined;
      if (!school || !cycle) {
        console.error(
          `[packs] ${slug}: no ${school ? `${CYCLE} cycle` : "school"} in the database`,
        );
        failed++;
        continue;
      }

      const published = await db.query.schoolPacks.findFirst({
        where: (t, { and, eq }) => and(eq(t.cycleId, cycle.id), eq(t.status, "published")),
        orderBy: (t, { desc }) => desc(t.version),
      });
      if (published && !republish) {
        console.log(`[packs] ${slug}: already published (v${published.version}), skipped`);
        continue;
      }

      let pack;
      try {
        pack = parseSchoolPack(candidate);
      } catch (error) {
        console.error(`[packs] ${slug}: not a valid pack:`, error);
        failed++;
        continue;
      }
      const blockers = publishBlockers(pack);
      if (blockers.length > 0) {
        console.error(`[packs] ${slug}: still blocked:`);
        for (const b of blockers) console.error(`    ${b.path}: ${b.detail}`);
        failed++;
        continue;
      }

      const note = [
        stamped.length ? `stamped ${stamped.length} verified: ${stamped.join("; ")}` : null,
        todo.length ? `${todo.length} to-dos stay in the draft file` : null,
      ]
        .filter(Boolean)
        .join("; ");
      if (dryRun) {
        const { tokenCount } = compilePack(pack, { cycle: CYCLE, now: new Date() });
        console.log(
          `[packs] ${slug}: would publish (${tokenCount} tokens)${note ? `; ${note}` : ""}`,
        );
        continue;
      }

      const result = await inTransaction(admin, async (tx) => {
        const row = await insertDraftPack(tx, cycle.id, pack as unknown as SchoolPackData);
        const versioned = parseSchoolPack({ ...pack, version: row.version });
        await updateDraftPack(tx, row.id, versioned as unknown as SchoolPackData);
        const compiled = compilePack(versioned, { cycle: CYCLE, now: new Date() });
        return publishPack(tx, row.id, {
          compiledPrompt: compiled.text,
          tokenCount: compiled.tokenCount,
        });
      });
      console.log(
        `[packs] ${slug}: published v${result.version} (${result.tokenCount} tokens)${note ? `; ${note}` : ""}`,
      );
    }
  } finally {
    await pool.end();
  }
  if (failed > 0) {
    console.error(`[packs] ${failed} school(s) not published`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("[packs] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
