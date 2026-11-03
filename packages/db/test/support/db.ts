import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { createDb, type DbHandle } from "../../src/client";
import { runMigrations } from "../../src/migrate";
import { users } from "../../src/schema";

/**
 * Connects to the integration database and applies migrations. Throws rather
 * than skipping when DATABASE_URL is absent, so a misconfigured CI run fails loudly.
 */
export async function connectTestDb(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Integration tests need DATABASE_URL in the repo-root .env.local (a disposable Postgres 16+/Neon dev branch).",
    );
  }
  const handle = createDb(url, { max: 2 });
  await runMigrations(handle.db);
  return handle;
}

/** Synthetic users only (spec §0): random addresses on the reserved .test TLD. */
export function createUserFactory(handle: DbHandle) {
  const created: string[] = [];
  return {
    async create(): Promise<string> {
      const tag = randomUUID();
      const [row] = await handle.db
        .insert(users)
        .values({ name: `Test User ${tag.slice(0, 8)}`, email: `test-${tag}@example.test` })
        .returning({ id: users.id });
      if (!row) throw new Error("user insert returned no row");
      created.push(row.id);
      return row.id;
    },
    async cleanup(): Promise<void> {
      if (created.length > 0)
        await handle.db.delete(users).where(inArray(users.id, created.splice(0)));
    },
  };
}
