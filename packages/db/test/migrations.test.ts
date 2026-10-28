import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as schema from "../src/schema";

const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));

interface Journal {
  entries: { idx: number; tag: string }[];
}
interface Snapshot {
  tables: Record<string, { name: string; columns: Record<string, unknown> }>;
}

const journal = JSON.parse(readFileSync(`${migrationsDir}meta/_journal.json`, "utf8")) as Journal;
const allSql = journal.entries
  .map((e) => readFileSync(`${migrationsDir}${e.tag}.sql`, "utf8"))
  .join("\n");
const latest = journal.entries.at(-1)!;
const snapshot = JSON.parse(
  readFileSync(`${migrationsDir}meta/${String(latest.idx).padStart(4, "0")}_snapshot.json`, "utf8"),
) as Snapshot;

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table));

describe("generated migrations", () => {
  it("has at least the initial migration", () => {
    expect(journal.entries.length).toBeGreaterThan(0);
    expect(journal.entries[0]!.tag).toBe("0000_init");
  });

  it.each(tables.map((t) => [t.name] as const))("creates table %s", (name) => {
    expect(allSql).toContain(`CREATE TABLE "${name}"`);
  });

  // Catches schema edits made without running `pnpm db:generate`.
  it.each(tables.map((t) => [t.name, t] as const))(
    "latest snapshot matches the %s columns",
    (name, config) => {
      const snapshotTable = snapshot.tables[`public.${name}`];
      expect(snapshotTable, `public.${name} missing from snapshot`).toBeDefined();
      expect(Object.keys(snapshotTable!.columns).sort()).toEqual(
        config.columns.map((c) => c.name).sort(),
      );
    },
  );
});
