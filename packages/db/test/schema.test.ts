import { SQL, is } from "drizzle-orm";
import { PgDialect, PgTable, getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/schema";

const dialect = new PgDialect();
const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);
const configs = tables.map((table) => getTableConfig(table));
const byName = new Map(configs.map((config) => [config.name, config]));

function table(name: string) {
  const config = byName.get(name);
  if (!config) throw new Error(`table ${name} is not in the schema`);
  return config;
}

function column(tableName: string, columnName: string): PgColumn {
  const found = table(tableName).columns.find((c) => c.name === columnName);
  if (!found) throw new Error(`${tableName}.${columnName} is missing`);
  return found;
}

function defaultSql(col: PgColumn): string | undefined {
  return is(col.default, SQL) ? dialect.sqlToQuery(col.default).sql : undefined;
}

function onDelete(tableName: string, columnName: string): string | undefined {
  const fk = table(tableName).foreignKeys.find((f) =>
    f.reference().columns.some((c) => c.name === columnName),
  );
  return fk?.onDelete;
}

describe("schema conventions (spec §10)", () => {
  it("defines the tables of the phases built so far", () => {
    expect([...byName.keys()].sort()).toEqual(
      [
        // Phase 0: identity, profile and the usage ledger.
        "accounts",
        "passkeys",
        "profiles",
        "roles",
        "sessions",
        "usage_ledger",
        "users",
        "verifications",
        // Phase 1: Story Studio and the Dossier.
        "brand",
        "dossier_snapshots",
        "facts",
        "goals",
        "golden_lines",
        "people",
        "slots_state",
        "sources",
        "stories",
        "studio_sessions",
        "studio_turns",
        "voice_profiles",
      ].sort(),
    );
  });

  it.each(configs.map((c) => [c.name, c] as const))(
    "%s has id uuid pk default gen_random_uuid()",
    (_, config) => {
      const id = config.columns.find((c) => c.name === "id");
      expect(id?.columnType).toBe("PgUUID");
      expect(id?.primary).toBe(true);
      expect(defaultSql(id!)).toBe("gen_random_uuid()");
    },
  );

  it.each(configs.map((c) => [c.name, c] as const))(
    "%s has created_at and updated_at timestamptz",
    (_, config) => {
      for (const name of ["created_at", "updated_at"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col, name).toBeDefined();
        expect(col!.getSQLType()).toBe("timestamp with time zone");
        expect(col!.notNull).toBe(true);
        expect(col!.hasDefault).toBe(true);
      }
      expect(config.columns.find((c) => c.name === "updated_at")!.onUpdateFn).toBeTypeOf(
        "function",
      );
    },
  );

  it.each(configs.map((c) => [c.name, c] as const))(
    "%s uses snake_case column names",
    (_, config) => {
      for (const col of config.columns) expect(col.name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    },
  );
});

describe("Better Auth tables", () => {
  it("exposes the camelCase fields Better Auth reads and writes", () => {
    expect(Object.keys(schema.users)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "emailVerified",
        "image",
        "createdAt",
        "updatedAt",
      ]),
    );
    expect(Object.keys(schema.sessions)).toEqual(
      expect.arrayContaining(["token", "expiresAt", "ipAddress", "userAgent", "userId"]),
    );
    expect(Object.keys(schema.accounts)).toEqual(
      expect.arrayContaining([
        "accountId",
        "providerId",
        "userId",
        "accessToken",
        "refreshToken",
        "idToken",
        "accessTokenExpiresAt",
        "refreshTokenExpiresAt",
        "scope",
        "password",
      ]),
    );
    expect(Object.keys(schema.verifications)).toEqual(
      expect.arrayContaining(["identifier", "value", "expiresAt"]),
    );
    expect(Object.keys(schema.passkeys)).toEqual(
      expect.arrayContaining([
        "name",
        "publicKey",
        "userId",
        "credentialID",
        "counter",
        "deviceType",
        "backedUp",
        "transports",
        "aaguid",
      ]),
    );
  });

  it("keeps unique emails and session tokens", () => {
    expect(column("users", "email").isUnique).toBe(true);
    expect(column("sessions", "token").isUnique).toBe(true);
  });
});

describe("profiles and roles", () => {
  it("has the §10 profile columns plus the approved consent columns", () => {
    const names = table("profiles").columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "user_id",
        "display_name",
        "country",
        "timezone",
        "program_type",
        "target_intake",
        "years_experience",
        "test_type",
        "test_score",
        "test_breakdown",
        "gpa",
        "gpa_scale",
        "languages",
        "studio_mode",
        "read_aloud",
        "tone_setting",
        "keep_audio",
        "improve_product_opt_in",
        "age_confirmed_at",
        "terms_version",
        "terms_accepted_at",
      ]),
    );
    expect(names).not.toContain("improve_folio_opt_in");
  });

  it("defaults privacy-sensitive settings safely", () => {
    expect(column("profiles", "keep_audio").default).toBe(false);
    expect(column("profiles", "improve_product_opt_in").default).toBe(false);
    expect(column("profiles", "read_aloud").default).toBe(true);
    expect(column("profiles", "program_type").default).toBe("full_time_mba");
  });

  it("allows one profile per user and one row per (user, role)", () => {
    expect(column("profiles", "user_id").isUnique).toBe(true);
    const unique = table("roles").uniqueConstraints.map((u) => u.columns.map((c) => c.name));
    expect(unique).toContainEqual(["user_id", "role"]);
    expect(column("roles", "role").getSQLType()).toBe("app_role");
    expect(schema.appRoleEnum.enumValues).toEqual(["applicant", "expert", "guide", "admin"]);
    expect(schema.studioModeEnum.enumValues).toEqual(["express", "standard", "deep"]);
  });
});

describe("usage_ledger", () => {
  it("has the §10 columns with the approved additions", () => {
    const names = table("usage_ledger").columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "user_id",
        "kit_id",
        "school_pack_id",
        "run_id",
        "task",
        "model",
        "served_model",
        "effort",
        "attempt_kind",
        "ai_mode",
        "input_tokens",
        "cache_read_tokens",
        "cache_write_5m_tokens",
        "cache_write_1h_tokens",
        "output_tokens",
        "stt_seconds",
        "tts_chars",
        "livekit_minutes",
        "web_searches",
        "cost_usd",
        "latency_ms",
        "prompt_version",
        "trace_id",
        "stop_reason",
      ]),
    );
    expect(names).not.toContain("cache_write_tokens");
  });

  it("stores cost as numeric(10,5)", () => {
    expect(column("usage_ledger", "cost_usd").getSQLType()).toBe("numeric(10, 5)");
  });

  it("indexes user_id, kit_id, run_id and created_at", () => {
    const indexed = table("usage_ledger").indexes.map((i) =>
      i.config.columns.map((c) => ("name" in c ? c.name : "")).join(","),
    );
    expect(indexed).toEqual(expect.arrayContaining(["user_id", "kit_id", "run_id", "created_at"]));
  });

  it("has no FKs for kits or school packs yet", () => {
    expect(onDelete("usage_ledger", "kit_id")).toBeUndefined();
    expect(onDelete("usage_ledger", "school_pack_id")).toBeUndefined();
  });
});

describe("foreign keys on delete", () => {
  it.each([
    ["sessions", "cascade"],
    ["accounts", "cascade"],
    ["passkeys", "cascade"],
    ["profiles", "cascade"],
    ["roles", "cascade"],
    ["usage_ledger", "set null"],
  ])("%s.user_id → users.id is %s", (tableName, expected) => {
    expect(onDelete(tableName, "user_id")).toBe(expected);
    const fk = table(tableName).foreignKeys[0]!.reference();
    expect(getTableConfig(fk.foreignTable).name).toBe("users");
  });

  it("indexes user_id on every user-owned table", () => {
    for (const name of ["sessions", "accounts", "passkeys", "usage_ledger"]) {
      const indexed = table(name).indexes.some((i) =>
        i.config.columns.some((c) => "name" in c && c.name === "user_id"),
      );
      expect(indexed, name).toBe(true);
    }
  });
});
