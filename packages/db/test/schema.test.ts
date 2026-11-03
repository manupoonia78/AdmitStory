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
        // Phase 3: schools, knowledge, registries, the audit log and the applicant's school list.
        "ai_policies",
        "audit_log",
        "canon_docs",
        "kb_chunks",
        "kb_proposals",
        "kb_refresh_snapshots",
        "kb_sources",
        "kits",
        "profile_reads",
        "prompt_versions",
        "school_cycles",
        "school_interest_votes",
        "school_packs",
        "schools",
        "user_schools",
        // Phase 4: checkout, entitlements, the kit pipeline and the Workspace.
        "angles",
        "checkouts",
        "checks",
        "deliverables",
        "drafts",
        "entitlements",
        "feedback",
        "kit_stages",
        "need_items",
        "purchases",
        "revision_requests",
        "verify_items",
        "webhook_events",
        // Phase 5: the Form Advisor, the Résumé Pass and the consistency check.
        "consistency_dismissals",
        "form_advice",
        "resume_reviews",
        // Phase 6: the Recommender Kit and the recommender portal.
        "lor_briefs",
        "lor_plans",
        "lor_stories",
        "recommender_invites",
        "recommender_reminders",
        "recommender_workspaces",
        "recommenders",
        // Phase 9b: operations (kill switches, alerts, evals, break-glass, account deletion).
        "account_deletions",
        "admin_alerts",
        "break_glass_grants",
        "eval_ratings",
        "eval_runs",
        "eval_samples",
        "feature_switches",
        "route_overrides",
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

describe("Phase 3 tables", () => {
  const indexedColumns = (name: string) =>
    table(name).indexes.map((i) =>
      i.config.columns.map((c) => ("name" in c ? c.name : "")).join(","),
    );
  const uniqueColumns = (name: string) =>
    table(name).uniqueConstraints.map((u) => u.columns.map((c) => c.name).join(","));

  it.each(["user_schools", "school_interest_votes", "profile_reads", "kits"])(
    "%s is user-owned: user_id → users.id cascades and leads an index or unique key",
    (name) => {
      expect(column(name, "user_id").notNull).toBe(true);
      expect(onDelete(name, "user_id")).toBe("cascade");
      const leading = [...indexedColumns(name), ...uniqueColumns(name)].some((cols) =>
        cols.startsWith("user_id"),
      );
      expect(leading, name).toBe(true);
    },
  );

  it("stores 1024-dimension embeddings with an HNSW cosine index and a GIN full-text index", () => {
    expect(column("kb_chunks", "embedding").getSQLType()).toBe("vector(1024)");
    expect(column("kb_chunks", "tsv").getSQLType()).toBe("tsvector");
    expect(column("kb_chunks", "tsv").generated?.type).toBe("always");
    const methods = table("kb_chunks").indexes.map((i) => i.config.method);
    expect(methods).toEqual(expect.arrayContaining(["hnsw", "gin"]));
  });

  it("encrypts knowledge-source text rather than storing it in the clear", () => {
    const names = table("kb_sources").columns.map((c) => c.name);
    expect(names).toContain("text_encrypted");
    expect(names).not.toContain("text");
  });

  it("keeps slugs, cycles, pack versions and votes unique", () => {
    expect(column("schools", "slug").isUnique).toBe(true);
    expect(uniqueColumns("school_cycles")).toContain("school_id,cycle");
    expect(uniqueColumns("school_packs")).toContain("cycle_id,version");
    expect(uniqueColumns("school_interest_votes")).toContain("user_id,school_id");
    expect(uniqueColumns("user_schools")).toContain("user_id,school_cycle_id");
    expect(column("ai_policies", "school_cycle_id").isUnique).toBe(true);
  });

  it("never cascades a cycle delete into applicants' lists", () => {
    expect(onDelete("user_schools", "school_cycle_id")).toBe("no action");
  });

  it("defaults AI policies to unverified and unknown", () => {
    expect(column("ai_policies", "verified_at").notNull).toBe(false);
    expect(column("ai_policies", "verified_at").hasDefault).toBe(false);
    expect(column("ai_policies", "stance").default).toBe("unknown");
  });
});

describe("Phase 4 tables (§10 applications and kits)", () => {
  const owned = [
    "checkouts",
    "purchases",
    "entitlements",
    "kit_stages",
    "deliverables",
    "angles",
    "drafts",
    "checks",
    "need_items",
    "verify_items",
    "revision_requests",
    "feedback",
  ];

  it.each(owned)("%s has an indexed user_id that cascades with the user", (name) => {
    expect(column(name, "user_id").notNull).toBe(true);
    expect(onDelete(name, "user_id")).toBe("cascade");
    const config = table(name);
    const indexed = [
      ...config.indexes.map((i) => i.config.columns.map((c) => ("name" in c ? c.name : ""))),
      ...config.uniqueConstraints.map((u) => u.columns.map((c) => c.name)),
    ];
    expect(indexed.some((cols) => cols[0] === "user_id")).toBe(true);
  });

  it("makes purchases idempotent on the provider transaction and webhooks on the event id", () => {
    expect(column("purchases", "provider_txn_id").isUnique).toBe(true);
    expect(column("checkouts", "provider_checkout_id").isUnique).toBe(true);
    expect(
      table("webhook_events").uniqueConstraints.map((u) => u.columns.map((c) => c.name)),
    ).toContainEqual(["provider", "event_id"]);
    expect(column("entitlements", "purchase_id").isUnique).toBe(true);
  });

  it("keeps one stage row per kit and numbers draft versions per deliverable", () => {
    const uniques = (name: string) =>
      table(name).uniqueConstraints.map((u) => u.columns.map((c) => c.name));
    expect(uniques("kit_stages")).toContainEqual(["kit_id", "stage"]);
    expect(uniques("drafts")).toContainEqual(["deliverable_id", "version"]);
    expect(uniques("deliverables")).toContainEqual(["kit_id", "pack_key"]);
    const current = table("drafts").indexes.find(
      (i) => i.config.name === "drafts_one_current_per_deliverable",
    );
    expect(current?.config.unique).toBe(true);
  });

  it("stores the §5.6 fair-use defaults", () => {
    expect(schema.DEFAULT_KIT_LIMITS).toEqual({
      revisions: 150,
      voice_mocks: 5,
      drills: 150,
      kit_regenerations: 1,
    });
    expect(schema.kitStageKeys).toHaveLength(10);
  });
});

describe("Phase 5 tables (§5.10 forms, résumé, consistency)", () => {
  const uniques = (name: string) =>
    table(name).uniqueConstraints.map((u) => u.columns.map((c) => c.name));

  it.each(["form_advice", "resume_reviews", "consistency_dismissals"])(
    "%s has an indexed user_id that cascades with the user",
    (name) => {
      expect(column(name, "user_id").notNull).toBe(true);
      expect(onDelete(name, "user_id")).toBe("cascade");
      const config = table(name);
      const indexed = [
        ...config.indexes.map((i) => i.config.columns.map((c) => ("name" in c ? c.name : ""))),
        ...config.uniqueConstraints.map((u) => u.columns.map((c) => c.name)),
      ];
      expect(indexed.some((cols) => cols[0] === "user_id")).toBe(true);
    },
  );

  it("keeps one advice per kit, one review per résumé and one dismissal per finding", () => {
    expect(uniques("form_advice")).toContainEqual(["kit_id"]);
    expect(onDelete("form_advice", "kit_id")).toBe("cascade");
    expect(uniques("resume_reviews")).toContainEqual(["source_id"]);
    expect(onDelete("resume_reviews", "source_id")).toBe("cascade");
    expect(uniques("consistency_dismissals")).toContainEqual(["user_id", "finding_id"]);
  });
});

describe("Phase 6 tables (§5.11 Recommender Kit)", () => {
  const uniques = (name: string) =>
    table(name).uniqueConstraints.map((u) => u.columns.map((c) => c.name));
  const indexed = (name: string) =>
    table(name).indexes.map((i) => i.config.columns.map((c) => ("name" in c ? c.name : "")));
  const owned = [
    "recommenders",
    "lor_stories",
    "lor_plans",
    "lor_briefs",
    "recommender_invites",
    "recommender_workspaces",
    "recommender_reminders",
  ];

  it.each(owned)("%s has an indexed user_id that cascades with the user", (name) => {
    expect(column(name, "user_id").notNull).toBe(true);
    expect(onDelete(name, "user_id")).toBe("cascade");
    expect([...indexed(name), ...uniques(name)].some((cols) => cols[0] === "user_id")).toBe(true);
  });

  it.each([
    "lor_stories",
    "lor_briefs",
    "recommender_invites",
    "recommender_workspaces",
    "recommender_reminders",
  ])("%s.recommender_id cascades with the recommender", (name) => {
    expect(column(name, "recommender_id").notNull).toBe(true);
    expect(onDelete(name, "recommender_id")).toBe("cascade");
  });

  it("keeps refs, R codes, plans, briefs, tokens, workspaces and reminders unique", () => {
    expect(uniques("recommenders")).toContainEqual(["user_id", "ref"]);
    expect(uniques("lor_stories")).toContainEqual(["user_id", "code"]);
    expect(uniques("lor_plans")).toContainEqual(["user_id"]);
    expect(uniques("lor_briefs")).toContainEqual(["recommender_id", "group_key"]);
    expect(uniques("recommender_invites")).toContainEqual(["token_hash"]);
    expect(uniques("recommender_workspaces")).toContainEqual(["recommender_id", "email_hash"]);
    expect(uniques("recommender_reminders")).toContainEqual(["recommender_id", "kind", "deadline"]);
    expect(indexed("recommender_invites")).toContainEqual(["previous_token_hash"]);
    expect(indexed("recommender_reminders")).toContainEqual(["status", "send_at"]);
    expect(indexed("lor_stories")).toContainEqual(["recommender_id"]);
  });

  it("keeps a workspace when its invite goes, and stores only token hashes", () => {
    expect(onDelete("recommender_workspaces", "invite_id")).toBe("set null");
    const inviteColumns = table("recommender_invites").columns.map((c) => c.name);
    expect(inviteColumns).toEqual(expect.arrayContaining(["token_hash", "previous_token_hash"]));
    expect(inviteColumns.some((c) => c === "token" || c === "raw_token")).toBe(false);
  });

  it("encrypts what the recommender writes rather than storing it in the clear", () => {
    const names = table("recommender_workspaces").columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "private_notes_encrypted",
        "letter_draft_encrypted",
        "voice_encrypted",
      ]),
    );
    for (const plain of ["notes", "private_notes", "letter", "letter_draft", "voice"])
      expect(names).not.toContain(plain);
  });

  it("starts reminders switched off and adds the intake source kind", () => {
    expect(column("recommender_reminders", "status").default).toBe("suggested");
    expect(schema.sourceKindEnum.enumValues).toContain("recommender_intake");
    expect(schema.sourceKinds.at(-1)).toBe("recommender_intake");
  });
});
