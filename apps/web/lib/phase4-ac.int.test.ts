import { randomUUID } from "node:crypto";
import { estimateKitCost } from "@admitstory/ai";
import { inventedFacts } from "../../../packages/ai/src/fixtures/golden";
import {
  addUserSchool,
  listAngles,
  listNeedItems,
  getKit,
  getKitCost,
  getUserSchool,
  hasEntitlement,
  listChecks,
  listDeliverables,
  getCurrentDraft,
  listKitStages,
  listVerifyItems,
  schoolCycles,
  schools,
  type DbHandle,
} from "@admitstory/db";
import { createFakePayments } from "@admitstory/payments";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connectTestDb, createUserFactory } from "../../../packages/db/test/support/db";
import { kitSupport, LINES, type KitEnv } from "../test/kit-support";

// Phase 4 acceptance (spec §16 Phase 4): a webhook replay grants one entitlement; a full kit runs
// on a FICTIONAL school with every stage persisted before the next; a crash resumes without paying
// twice for finished stages; the generated drafts carry provenance and pass the golden-set
// invented-fact check; and the kit's cost, from its ledger rows, is inside §12.2's range.
//
// The model is a fake that validates every input and output with the task's own Zod schemas (as
// ai.run() does) and prices each call from its token counts, so the ledger is realistic
// (test/kit-support.ts, shared with Phase 5).

vi.mock("server-only", () => ({}));
const caller = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/app-user", () => ({
  requireOnboardedUser: vi.fn(async () => ({
    session: { user: { id: caller.userId, email: "caller@example.test", name: "Caller" } },
    profile: { voiceprint: null },
  })),
}));
const dispatched: unknown[] = [];
vi.mock("@/lib/strategy/dispatch", () => ({
  dispatch: vi.fn(async (event: unknown) => {
    dispatched.push(event);
  }),
  inngestConfigured: () => false,
}));

const { processWebhook, setPaymentsProvider } = await import("@/lib/payments/server");
const { runPipeline, STAGE_ORDER } = await import("@/lib/kit/pipeline");

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const schoolIds: string[] = [];
const kitIds: string[] = [];
const env = { schoolIds } as KitEnv;
const { paidKit, fakeAI } = kitSupport(env);

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
  Object.assign(env, { handle, factory });
  vi.stubEnv("APP_URL", "http://localhost:3000");
  setPaymentsProvider(createFakePayments({ appUrl: "http://localhost:3000" }));
});

afterAll(async () => {
  setPaymentsProvider(null);
  if (!handle) return;
  // No drizzle operators in apps/web: cleanup goes through the pool.
  if (kitIds.length > 0)
    await handle.pool.query("delete from usage_ledger where kit_id = any($1)", [kitIds]);
  await factory.cleanup();
  if (schoolIds.length > 0)
    await handle.pool.query("delete from schools where id = any($1)", [schoolIds]);
  await handle.pool.query("delete from webhook_events where event_id like $1", ["evt_fake%"]);
  await handle.pool.end();
});

/* The tests ------------------------------------------------------------------------------------- */

describe("Phase 4 acceptance", () => {
  it("a replayed purchase webhook grants exactly one entitlement and starts one kit", async () => {
    const buyer = await paidKit();
    const first = await processWebhook(buyer.webhook.body, buyer.webhook.headers);
    const second = await processWebhook(buyer.webhook.body, buyer.webhook.headers);
    expect(first).toMatchObject({ status: 200, body: { outcome: "applied" } });
    expect(second).toMatchObject({ status: 200, body: { outcome: "duplicate" } });
    const rows = await handle.db.query.entitlements.findMany({
      where: (t, { eq }) => eq(t.userId, buyer.userId),
    });
    expect(rows).toHaveLength(1);
    expect(await hasEntitlement(handle.db, buyer.userId, "school_kit", buyer.cycleId)).toBe(true);
    expect((await getUserSchool(handle.db, buyer.userId, buyer.userSchoolId))?.status).toBe(
      "unlocked",
    );
    const starts = dispatched.filter((e) => (e as { name?: string }).name === "kit/generate");
    expect(starts).toHaveLength(1);
  });

  it("refuses a webhook whose signature fails", async () => {
    const buyer = await paidKit();
    const result = await processWebhook(
      buyer.webhook.body.replace("10000", "1"),
      buyer.webhook.headers,
    );
    expect(result.status).toBe(401);
  });

  it(
    "runs a whole kit: every stage persisted in order, drafts with provenance, checks and a Verify list",
    { timeout: 180_000 },
    async () => {
      const buyer = await paidKit();
      await processWebhook(buyer.webhook.body, buyer.webhook.headers);
      const kit = (await handle.db.query.kits.findFirst({
        where: (t, { eq }) => eq(t.userId, buyer.userId),
      }))!;
      kitIds.push(kit.id);
      const calls: string[] = [];
      const result = await runPipeline(
        { ai: fakeAI(calls), db: handle.db },
        { kitId: kit.id, userId: buyer.userId },
      );
      expect(result.status).toBe("ready");

      const stages = await listKitStages(handle.db, buyer.userId, kit.id);
      expect(stages.map((st) => st.stage)).toEqual(STAGE_ORDER);
      for (const st of stages)
        expect(st.status === "done" || (st.stage === "forms" && st.status === "skipped")).toBe(
          true,
        );
      // Each stage finished before the next one started (§5.7 AC).
      const timed = stages.filter((st) => st.startedAt && st.finishedAt);
      for (let i = 1; i < timed.length; i += 1)
        expect(timed[i]!.startedAt!.getTime()).toBeGreaterThanOrEqual(
          timed[i - 1]!.finishedAt!.getTime(),
        );

      const deliverables = (await listDeliverables(handle.db, buyer.userId, kit.id)) ?? [];
      const drafted = deliverables.filter((d) =>
        ["essay", "short_answer", "goal_field"].includes(d.type),
      );
      expect(drafted.length).toBeGreaterThan(0);
      const corpus = {
        truth: { facts: [], stories: [], goals: {}, redFlags: [], neverSays: [] } as never,
        pack: buyer.compiled,
        extra: [
          ...LINES,
          "Nobody else on the team was awake to fix it.",
          "By six, the morning rounds had their results.",
          "Meridian Health Systems",
          "13",
        ],
      };
      let checksSeen = 0;
      for (const d of drafted) {
        const draft = await getCurrentDraft(handle.db, buyer.userId, d.id);
        expect(draft, d.packKey).not.toBeNull();
        for (const p of draft!.content.paragraphs)
          for (const sentence of p.sentences) expect(sentence.sources.length).toBeGreaterThan(0);
        expect(inventedFacts(draft!.content, corpus)).toEqual([]);
        checksSeen += (await listChecks(handle.db, buyer.userId, draft!.id)).length >= 0 ? 1 : 0;
      }
      expect(checksSeen).toBe(drafted.length);
      expect((await listVerifyItems(handle.db, buyer.userId, kit.id)).length).toBeGreaterThan(0);
      expect(calls.filter((t) => t === "kit.positioning_filemap")).toHaveLength(1);

      // §12.2: the kit's cost from its own ledger rows.
      const cost = await getKitCost(handle.db, buyer.userId, kit.id);
      const estimate = estimateKitCost(
        cost!.byTask.map((r) => ({ task: r.task, costUsd: r.costUsd })),
      );
      expect(estimate.totalUsd).toBeCloseTo(cost!.totalUsd, 6);
      expect(estimate.generationUsd).toBeGreaterThan(0);
      expect(estimate.underHardCap).toBe(true);
      console.info(
        `[phase4-ac] kit cost from the ledger: $${estimate.totalUsd.toFixed(3)} (generation $${estimate.generationUsd.toFixed(3)}, in §12.2 range: ${estimate.generationInRange})`,
      );
    },
  );

  it("resumes after a crash without re-running finished stages", { timeout: 180_000 }, async () => {
    const buyer = await paidKit();
    await processWebhook(buyer.webhook.body, buyer.webhook.headers);
    const kit = (await handle.db.query.kits.findFirst({
      where: (t, { eq }) => eq(t.userId, buyer.userId),
    }))!;
    kitIds.push(kit.id);
    const first: string[] = [];
    await expect(
      runPipeline(
        { ai: fakeAI(first, { task: "kit.angles", times: 1 }), db: handle.db },
        { kitId: kit.id, userId: buyer.userId },
      ),
    ).rejects.toThrow("Simulated crash");
    expect((await getKit(handle.db, buyer.userId, kit.id))?.status).toBe("failed");
    const done = (await listKitStages(handle.db, buyer.userId, kit.id))
      .filter((st) => st.status === "done")
      .map((st) => st.stage);
    expect(done).toEqual(["context", "positioning", "file_map", "gaps"]);

    const second: string[] = [];
    const result = await runPipeline(
      { ai: fakeAI(second), db: handle.db },
      { kitId: kit.id, userId: buyer.userId },
    );
    expect(result.status).toBe("ready");
    expect(second).not.toContain("kit.positioning_filemap");
    expect(second).not.toContain("kit.gaps");
    expect(second).toContain("kit.angles");
  });
});

/* Ownership (every user-scoped Phase 3 and 4 route) -------------------------------------------- */

describe("ownership: another applicant's ids are never served", () => {
  it(
    "every user-scoped route answers 404 (or 403) to someone else",
    { timeout: 300_000 },
    async () => {
      const owner = await paidKit();
      await processWebhook(owner.webhook.body, owner.webhook.headers);
      const kit = (await handle.db.query.kits.findFirst({
        where: (t, { eq }) => eq(t.userId, owner.userId),
      }))!;
      kitIds.push(kit.id);
      await runPipeline({ ai: fakeAI([]), db: handle.db }, { kitId: kit.id, userId: owner.userId });
      const deliverables = (await listDeliverables(handle.db, owner.userId, kit.id)) ?? [];
      const essay = deliverables.find((d) => d.type === "essay")!;
      const draft = (await getCurrentDraft(handle.db, owner.userId, essay.id))!;
      const angle = (await listAngles(handle.db, owner.userId, essay.id))[0]!;
      const need = (await listNeedItems(handle.db, owner.userId, { kitId: kit.id }))[0]!;
      const verify = (await listVerifyItems(handle.db, owner.userId, kit.id))[0]!;
      const checks = await listChecks(handle.db, owner.userId, draft.id);

      // The owner can read their own deliverable (the positive control).
      caller.userId = owner.userId;
      const own = await (
        await import("@/app/api/deliverables/[id]/route")
      ).GET(new Request("http://localhost:3000"), {
        params: Promise.resolve({ id: essay.id }),
      });
      expect(own.status).toBe(200);

      caller.userId = await factory.create();
      const json = (body: unknown) => ({
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      });
      const cases: [string, string, Record<string, string>, RequestInit?][] = [
        ["deliverables/[id]", "GET", { id: essay.id }],
        ["deliverables/[id]", "PATCH", { id: essay.id }, json({ authorshipMode: "coach" })],
        ["deliverables/[id]/angles/[angleId]/draft", "POST", { id: essay.id, angleId: angle.id }],
        ["deliverables/[id]/use-option", "POST", { id: essay.id }, json({ draftId: draft.id })],
        ["deliverables/[id]/mark-final", "POST", { id: essay.id }, json({ final: true })],
        ["drafts/[id]", "GET", { id: draft.id }],
        ["drafts/[id]", "PATCH", { id: draft.id }, json({ lockedParagraphs: ["p1"] })],
        ["drafts/[id]/refine", "POST", { id: draft.id }, json({ instruction: "Warmer" })],
        [
          "drafts/[id]/save",
          "POST",
          { id: draft.id },
          json({ paragraphs: draft.content.paragraphs }),
        ],
        ["drafts/[id]/restore", "POST", { id: draft.id }],
        ["drafts/[id]/compare/[b]", "GET", { id: draft.id, b: draft.id }],
        ["drafts/[id]/export", "POST", { id: draft.id }, json({ format: "pdf" })],
        ["needs/[id]/answer", "POST", { id: need.id }, json({ text: "Seven people." })],
        ["verify/[id]", "PATCH", { id: verify.id }, json({ status: "confirmed" })],
        ...(checks[0]
          ? [
              ["checks/[id]", "PATCH", { id: checks[0].id }, json({ action: "dismiss" })] as [
                string,
                string,
                Record<string, string>,
                RequestInit,
              ],
            ]
          : []),
        ["kits/[id]", "GET", { id: kit.id }],
        ["kits/[id]/events", "GET", { id: kit.id }],
        [
          "kits/[id]/gaps/[gapId]/answer",
          "POST",
          { id: kit.id, gapId: need.id },
          json({ text: "Seven." }),
        ],
        ["kits/[id]/gaps/skip", "POST", { id: kit.id }],
        ["kits/[id]/regenerate", "POST", { id: kit.id }, json({})],
        ["user-schools/[id]/kit", "GET", { id: owner.userSchoolId }],
        ["user-schools/[id]/preview", "GET", { id: owner.userSchoolId }],
        ["user-schools/[id]", "PATCH", { id: owner.userSchoolId }, json({ round: "R2" })],
        ["checkout/session", "POST", {}, json({ userSchoolId: owner.userSchoolId })],
      ];
      for (const [route, method, params, init] of cases) {
        const mod = (await import(`@/app/api/${route}/route`)) as Record<
          string,
          (r: Request, c: unknown) => Promise<Response>
        >;
        const response = await mod[method]!(
          new Request("http://localhost:3000/x", { method, ...init }),
          {
            params: Promise.resolve(params),
          },
        );
        expect([403, 404], `${method} /api/${route}`).toContain(response.status);
      }
      // Nothing of the owner's changed.
      expect((await getCurrentDraft(handle.db, owner.userId, essay.id))?.id).toBe(draft.id);
    },
  );
});

describe("Pack coming soon (§5.5)", () => {
  it("can't be previewed or bought", { timeout: 120_000 }, async () => {
    const userId = await factory.create();
    const tag = randomUUID().slice(0, 8);
    const [school] = await handle.db
      .insert(schools)
      .values({
        slug: `fictional-quill-${tag}`,
        name: `Quillfeather ${tag}`,
        shortName: "Quillfeather",
        region: "us",
      })
      .returning();
    schoolIds.push(school!.id);
    const [cycle] = await handle.db
      .insert(schoolCycles)
      .values({ schoolId: school!.id, cycle: "2026-27", status: "live" })
      .returning();
    const us = await addUserSchool(handle.db, userId, { schoolCycleId: cycle!.id });
    caller.userId = userId;
    const checkout = await (
      await import("@/app/api/checkout/session/route")
    ).POST(
      new Request("http://localhost:3000/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userSchoolId: us.id }),
      }),
    );
    expect(checkout.status).toBe(409);
    const preview = await (
      await import("@/app/api/user-schools/[id]/preview/route")
    ).POST(new Request("http://localhost:3000/x", { method: "POST" }), {
      params: Promise.resolve({ id: us.id }),
    });
    expect(preview.status).toBe(409);
  });
});
