import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDb, type Database } from "./client";
import { loadRootEnv } from "./env";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

async function main(): Promise<void> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to the repo-root .env.local.");
  const { db, pool } = createDb(url, { max: 1 });
  try {
    await runMigrations(db);
    console.log("[db] migrations applied");
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error("[db] migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
