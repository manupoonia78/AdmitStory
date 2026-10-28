import { createDb } from "@admitstory/db";
import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./support/paths";

// Phase 0 acceptance inside the built app (spec §16): a sample util.title call made by the running
// app records tokens and cost in usage_ledger. POST /api/dev/ai-smoke only exists on localhost
// with a session (ADR 0002's rule) and runs in replay mode.

interface SmokeResponse {
  title: string;
  ledger: {
    id: string;
    task: string;
    aiMode: string;
    attemptKind: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

test("signed out, the smoke route is a 404", async ({ request }) => {
  const response = await request.post("/api/dev/ai-smoke");
  expect(response.status()).toBe(404);
});

test.describe("signed in", () => {
  test.use({ storageState: AUTH_STATE });

  test("a util.title call records tokens and cost in usage_ledger", async ({ page }) => {
    const response = await page.request.post("/api/dev/ai-smoke");
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as SmokeResponse;

    expect(body.title.length).toBeGreaterThan(0);
    expect(body.ledger).toMatchObject({
      task: "util.title",
      aiMode: "replay",
      attemptKind: "primary",
    });
    expect(body.ledger.inputTokens).toBeGreaterThan(0);
    expect(body.ledger.outputTokens).toBeGreaterThan(0);
    expect(body.ledger.costUsd).toBeGreaterThan(0);

    // Read the row back from the database the app wrote it to.
    const handle = createDb(process.env.DATABASE_URL ?? "", { max: 1 });
    try {
      const row = await handle.db.query.usageLedger.findFirst({
        where: (ledger, { eq }) => eq(ledger.id, body.ledger.id),
      });
      expect(row, "usage_ledger row").toBeDefined();
      expect(row).toMatchObject({
        task: "util.title",
        aiMode: "replay",
        inputTokens: body.ledger.inputTokens,
        outputTokens: body.ledger.outputTokens,
        costUsd: body.ledger.costUsd,
      });
      expect(row?.userId).not.toBeNull();
      expect(row?.costUsd).toBeGreaterThan(0);
      expect((row?.inputTokens ?? 0) + (row?.outputTokens ?? 0)).toBeGreaterThan(0);
    } finally {
      // Leave no test rows behind in a shared dev database.
      await handle.pool.query("delete from usage_ledger where id = $1", [body.ledger.id]);
      await handle.pool.end();
    }
  });
});
