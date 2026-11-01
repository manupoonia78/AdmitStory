// Seeds the Appendix H schools (each with a draft 2026-27 cycle) and the §14.2 AI policies as
// unverified drafts. Safe to re-run.
//
//     pnpm --filter @admitstory/db seed:schools

import { createDb } from "../src/client";
import { loadRootEnv } from "../src/env";
import { recordAudit, systemContext } from "../src/repos";
import { SEED_CYCLE, seedAiPolicies, seedSchools } from "../src/seed/schools";

async function main(): Promise<void> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  const { db, pool } = createDb(url, { max: 1 });
  try {
    const seeded = await seedSchools(db);
    const policies = await seedAiPolicies(db);
    await recordAudit(systemContext(db, "cli:seed:schools"), {
      action: "schools.seed",
      targetType: "school",
      meta: {
        cycle: SEED_CYCLE,
        newSchools: seeded.schools,
        newCycles: seeded.cycles,
        newPolicies: policies.inserted,
      },
    });
    console.log(
      `[db] ${seeded.schoolIds.length} schools (${seeded.schools} new), ${seeded.cycles} new ${SEED_CYCLE} cycles, ` +
        `${policies.inserted} new unverified AI policies (${policies.skipped} skipped)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[db] seed:schools failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
