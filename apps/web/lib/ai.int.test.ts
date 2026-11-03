// Phase 0 acceptance (spec §16): a sample util.title call records tokens and cost in the ledger.
// packages/ai proves this against an in-memory ledger; this test runs the app's own ai()
// singleton against the real usage_ledger table.

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCost, REPLAY_DIR, tokenUsageFromApi } from "@admitstory/ai";
import { closeDb, createDb, users } from "@admitstory/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UTIL_TITLE_SAMPLE } from "../../../packages/ai/scripts/util-title-sample";

vi.mock("server-only", () => ({}));

process.env.AI_MODE = "replay";
const { ai } = await import("./ai");

interface Fixture {
  meta: { model: string };
  request: unknown;
  response: { body: string };
}

function fixtureForSample(): Fixture {
  const dir = join(REPLAY_DIR, "util.title");
  const needle = JSON.stringify(UTIL_TITLE_SAMPLE).slice(1, -1);
  const fixture = readdirSync(dir)
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as Fixture)
    .find((f) => JSON.stringify(f.request).includes(needle));
  if (!fixture) throw new Error("No util.title fixture for the sample passage");
  return fixture;
}

// The test's own connection, for setup, reading the ledger and cleanup. The app's ai() singleton
// writes through getDb(), its own pool, exactly as it does in a request.
const handle = createDb(process.env.DATABASE_URL ?? "", { max: 2 });
let userId: string;

beforeAll(async () => {
  const tag = randomUUID();
  const [row] = await handle.db
    .insert(users)
    .values({ name: "Test User", email: `test-${tag}@example.test`, emailVerified: true })
    .returning({ id: users.id });
  if (!row) throw new Error("user insert returned no row");
  userId = row.id;
});

afterAll(async () => {
  if (userId) {
    // Ledger rows outlive users by design (user_id is set to null), so remove ours first.
    // apps/web has no drizzle-orm dependency, so cleanup uses parameterised SQL on the pool.
    await handle.pool.query("delete from usage_ledger where user_id = $1", [userId]);
    await handle.pool.query("delete from users where id = $1", [userId]);
  }
  await handle.pool.end();
  await closeDb();
});

describe("Phase 0 ledger acceptance (apps/web ai singleton, real database)", () => {
  it("records exactly one util.title row with the fixture's tokens and a matching cost", async () => {
    const output = await ai().run("util.title", { text: UTIL_TITLE_SAMPLE }, { userId });
    await ai().flush();
    expect(output.title.length).toBeGreaterThan(0);

    const rows = await handle.db.query.usageLedger.findMany({
      where: (ledger, { eq }) => eq(ledger.userId, userId),
    });
    expect(rows).toHaveLength(1);
    const [row] = rows;

    const fixture = fixtureForSample();
    const response = JSON.parse(fixture.response.body) as {
      model: string;
      usage: Parameters<typeof tokenUsageFromApi>[0];
    };
    const usage = tokenUsageFromApi(response.usage);

    expect(row).toMatchObject({
      task: "util.title",
      model: fixture.meta.model,
      servedModel: response.model,
      attemptKind: "primary",
      aiMode: "replay",
      promptVersion: "util.title@v1",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWrite5mTokens: usage.cacheWrite5mTokens,
      cacheWrite1hTokens: usage.cacheWrite1hTokens,
    });
    expect(row?.inputTokens).toBeGreaterThan(0);
    expect(row?.outputTokens).toBeGreaterThan(0);

    const expected = computeCost({ modelId: fixture.meta.model, usage });
    expect(expected).toBeGreaterThan(0);
    // cost_usd is numeric(10,5): the stored value is the computed cost rounded to 5 places.
    expect(row?.costUsd).toBe(Number(expected.toFixed(5)));
    expect(row?.costUsd).toBeGreaterThan(0);
  });
});
