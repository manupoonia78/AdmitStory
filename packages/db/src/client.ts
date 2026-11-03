import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Repositories accept either a database or an open transaction. */
export type DbExecutor = Database | DbTransaction;

export interface DbHandle {
  db: Database;
  pool: Pool;
}

export interface CreateDbOptions {
  /** Pool size. Serverless functions each hold their own pool, so keep it small. */
  max?: number;
}

// node-postgres over a TCP pool (not Neon's HTTP driver) so the same code runs
// against Neon in production and a plain Postgres 16/17 locally and in CI.
// With Neon, use the pooled ("-pooler") connection string.
export function createDb(connectionString: string, options: CreateDbOptions = {}): DbHandle {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  // Neon closes idle connections; without a listener the pool's error event crashes the process.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error.message);
  });
  return { db: drizzle({ client: pool, schema }), pool };
}

// Cached on globalThis so Next.js dev reloads don't open a new pool per edit.
const globalForDb = globalThis as typeof globalThis & { __admitstoryDb?: DbHandle };

export function getDb(): Database {
  if (!globalForDb.__admitstoryDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (see .env.example) or the deployment environment.",
      );
    }
    globalForDb.__admitstoryDb = createDb(url);
  }
  return globalForDb.__admitstoryDb.db;
}

/** Ends the shared pool from getDb(); for scripts and test teardown. */
export async function closeDb(): Promise<void> {
  const handle = globalForDb.__admitstoryDb;
  globalForDb.__admitstoryDb = undefined;
  await handle?.pool.end();
}
