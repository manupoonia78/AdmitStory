import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/client";
import {
  confirmAgeAndTerms,
  costForKit,
  costForUser,
  createUsageLedgerSink,
  getProfile,
  grantRole,
  hasRole,
  listRoles,
  onUserCreated,
  recordUsage,
  updateProfile,
} from "../src/repos";
import { accounts, passkeys, profiles, roles, sessions, usageLedger, users } from "../src/schema";
import type { UsageEntry } from "../src/types";
import { connectTestDb, createUserFactory } from "./support/db";

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const ledgerRunIds: string[] = [];

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
});

afterAll(async () => {
  if (!handle) return;
  await factory.cleanup();
  // Ledger rows outlive users by design (SET NULL), so remove ours explicitly.
  if (ledgerRunIds.length > 0)
    await handle.db.delete(usageLedger).where(inArray(usageLedger.runId, ledgerRunIds));
  await handle.pool.end();
});

function entry(overrides: Partial<UsageEntry>): UsageEntry {
  const runId = overrides.runId ?? randomUUID();
  ledgerRunIds.push(runId);
  return {
    userId: null,
    kitId: null,
    schoolPackId: null,
    task: "util.title",
    model: "model-under-test",
    servedModel: "model-under-test",
    effort: null,
    attemptKind: "primary",
    aiMode: "replay",
    inputTokens: 100,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    outputTokens: 10,
    webSearches: 0,
    costUsd: 0,
    latencyMs: 200,
    promptVersion: "util.title@v1",
    traceId: null,
    stopReason: "end_turn",
    ...overrides,
    runId,
  };
}

describe("onUserCreated", () => {
  it("creates exactly one profile and one applicant role, even when called twice", async () => {
    const userId = await factory.create();
    await onUserCreated(handle.db, userId);
    await onUserCreated(handle.db, userId);

    const profileRows = await handle.db.select().from(profiles).where(eq(profiles.userId, userId));
    const roleRows = await handle.db.select().from(roles).where(eq(roles.userId, userId));
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0]).toMatchObject({
      programType: "full_time_mba",
      keepAudio: false,
      readAloud: true,
      languages: [],
    });
    expect(roleRows.map((r) => r.role)).toEqual(["applicant"]);
  });

  it("is safe under concurrent calls", async () => {
    const userId = await factory.create();
    await Promise.all([onUserCreated(handle.db, userId), onUserCreated(handle.db, userId)]);
    expect(await handle.db.select().from(profiles).where(eq(profiles.userId, userId))).toHaveLength(
      1,
    );
    expect(await listRoles(handle.db, userId)).toEqual(["applicant"]);
  });
});

describe("profile ownership", () => {
  it("never lets one user read or change another user's profile", async () => {
    const userA = await factory.create();
    const userB = await factory.create();
    await onUserCreated(handle.db, userA);
    await onUserCreated(handle.db, userB);
    await updateProfile(handle.db, userA, { displayName: "Applicant A", country: "IN" });

    const updatedB = await updateProfile(handle.db, userB, {
      displayName: "Applicant B",
      keepAudio: true,
    });
    expect(updatedB?.userId).toBe(userB);

    const profileA = await getProfile(handle.db, userA);
    expect(profileA).toMatchObject({
      userId: userA,
      displayName: "Applicant A",
      country: "IN",
      keepAudio: false,
    });
    expect((await getProfile(handle.db, userB))?.userId).toBe(userB);
  });

  it("returns null for a user without a profile and writes nothing", async () => {
    const stranger = randomUUID();
    expect(await getProfile(handle.db, stranger)).toBeNull();
    expect(await updateProfile(handle.db, stranger, { displayName: "Nobody" })).toBeNull();
  });

  it("maintains updated_at on update", async () => {
    const userId = await factory.create();
    await onUserCreated(handle.db, userId);
    const before = await getProfile(handle.db, userId);
    await new Promise((resolve) => setTimeout(resolve, 15));
    const after = await updateProfile(handle.db, userId, { studioMode: "deep" });
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
    expect(after!.createdAt.getTime()).toBe(before!.createdAt.getTime());
  });

  it("round-trips numeric and json fields as numbers", async () => {
    const userId = await factory.create();
    await onUserCreated(handle.db, userId);
    const profile = await updateProfile(handle.db, userId, {
      yearsExperience: 5.5,
      gpa: 8.4,
      gpaScale: 10,
      testType: "gmat_focus",
      testScore: 705,
      testBreakdown: { quant: 85, verbal: 84, data_insights: 82 },
      languages: ["English", "Hindi"],
    });
    expect(profile).toMatchObject({
      yearsExperience: 5.5,
      gpa: 8.4,
      gpaScale: 10,
      testScore: 705,
      testBreakdown: { quant: 85, verbal: 84, data_insights: 82 },
      languages: ["English", "Hindi"],
    });
  });

  it("records 18+ and terms acceptance, keeping the first age confirmation", async () => {
    const userId = await factory.create();
    await onUserCreated(handle.db, userId);
    const first = await confirmAgeAndTerms(handle.db, userId, "2026-10");
    expect(first).toMatchObject({ termsVersion: "2026-10" });
    expect(first!.ageConfirmedAt).toBeInstanceOf(Date);

    const second = await confirmAgeAndTerms(handle.db, userId, "2027-01");
    expect(second!.termsVersion).toBe("2027-01");
    expect(second!.ageConfirmedAt!.getTime()).toBe(first!.ageConfirmedAt!.getTime());
  });
});

describe("roles", () => {
  it("grants idempotently and scopes lookups by user", async () => {
    const userA = await factory.create();
    const userB = await factory.create();
    await onUserCreated(handle.db, userA);
    await grantRole(handle.db, userA, "expert");
    await grantRole(handle.db, userA, "expert");

    expect(await listRoles(handle.db, userA)).toEqual(["applicant", "expert"]);
    expect(await hasRole(handle.db, userA, "expert")).toBe(true);
    expect(await hasRole(handle.db, userB, "expert")).toBe(false);
    expect(await listRoles(handle.db, userB)).toEqual([]);
  });
});

describe("usage ledger", () => {
  it("sums cost per user and per kit", async () => {
    const userA = await factory.create();
    const userB = await factory.create();
    const kitId = randomUUID();
    const runId = randomUUID();

    await recordUsage(handle.db, entry({ userId: userA, kitId, runId, costUsd: 0.00123 }));
    await recordUsage(
      handle.db,
      entry({ userId: userA, kitId, runId, attemptKind: "repair", costUsd: 0.0456 }),
    );
    await recordUsage(handle.db, entry({ userId: userA, costUsd: 0.5 }));
    await recordUsage(handle.db, entry({ userId: userB, kitId: randomUUID(), costUsd: 1.25 }));

    expect(await costForUser(handle.db, userA)).toBeCloseTo(0.54683, 5);
    expect(await costForUser(handle.db, userB)).toBeCloseTo(1.25, 5);
    expect(await costForKit(handle.db, kitId)).toBeCloseTo(0.04683, 5);
    expect(await costForKit(handle.db, randomUUID())).toBe(0);

    const attempts = await handle.db.select().from(usageLedger).where(eq(usageLedger.runId, runId));
    expect(attempts.map((a) => a.attemptKind).sort()).toEqual(["primary", "repair"]);
  });

  it("works through the LedgerSink adapter", async () => {
    const userId = await factory.create();
    const sink = createUsageLedgerSink(handle.db);
    await sink.write(entry({ userId, costUsd: 0.002, cacheWrite1hTokens: 4096, aiMode: "live" }));
    expect(await sink.spentByUser(userId)).toBeCloseTo(0.002, 5);
  });
});

describe("account deletion (spec §14.4)", () => {
  it("cascades auth and profile rows and anonymises ledger rows", async () => {
    const userId = await factory.create();
    await onUserCreated(handle.db, userId);
    await handle.db
      .insert(sessions)
      .values({ userId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) });
    await handle.db
      .insert(accounts)
      .values({ userId, accountId: randomUUID(), providerId: "google" });
    await handle.db.insert(passkeys).values({
      userId,
      publicKey: "synthetic-public-key",
      credentialID: randomUUID(),
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });
    const usage = entry({ userId, costUsd: 0.01 });
    await recordUsage(handle.db, usage);

    await handle.db.delete(users).where(eq(users.id, userId));

    for (const table of [profiles, roles, sessions, accounts, passkeys]) {
      expect(await handle.db.select().from(table).where(eq(table.userId, userId))).toHaveLength(0);
    }
    const [ledgerRow] = await handle.db
      .select()
      .from(usageLedger)
      .where(eq(usageLedger.runId, usage.runId));
    expect(ledgerRow).toBeDefined();
    expect(ledgerRow!.userId).toBeNull();
    expect(ledgerRow!.costUsd).toBeCloseTo(0.01, 5);
  });
});

describe("database conventions (spec §10)", () => {
  it("every table has id uuid default gen_random_uuid(), created_at and updated_at", async () => {
    const result = await handle.db.execute<{
      table_name: string;
      column_name: string;
      data_type: string;
      column_default: string | null;
      is_nullable: string;
    }>(sql`
      select c.table_name, c.column_name, c.data_type, c.column_default, c.is_nullable
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and c.column_name in ('id', 'created_at', 'updated_at')
    `);
    const tablesResult = await handle.db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
    `);
    const tableNames = tablesResult.rows.map((r) => r.table_name);
    expect(tableNames).toEqual(
      expect.arrayContaining(["users", "profiles", "roles", "usage_ledger"]),
    );

    for (const name of tableNames) {
      const cols = new Map(
        result.rows.filter((r) => r.table_name === name).map((r) => [r.column_name, r]),
      );
      expect(cols.get("id"), `${name}.id`).toMatchObject({ data_type: "uuid", is_nullable: "NO" });
      expect(cols.get("id")?.column_default, `${name}.id default`).toMatch(/gen_random_uuid\(\)/);
      for (const ts of ["created_at", "updated_at"]) {
        expect(cols.get(ts), `${name}.${ts}`).toMatchObject({
          data_type: "timestamp with time zone",
          is_nullable: "NO",
        });
        expect(cols.get(ts)?.column_default, `${name}.${ts} default`).toMatch(/now\(\)/);
      }
    }
  });
});
