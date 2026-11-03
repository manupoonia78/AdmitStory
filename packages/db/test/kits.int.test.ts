import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/client";
import {
  addUserSchool,
  addVerifyItems,
  answerNeedItem,
  applyPurchaseCompleted,
  applyRefund,
  beginKitRegeneration,
  consumeEntitlement,
  createDraftVersion,
  createNeedItems,
  createRevisionRequest,
  createSource,
  getCheckout,
  getCurrentDraft,
  getDeliverable,
  getDraft,
  getDraftPair,
  getKit,
  getKitContext,
  getKitCost,
  getKitStage,
  getUserSchool,
  hasEntitlement,
  isPaidUser,
  listAngles,
  listChecks,
  listDeliverables,
  listDraftVersions,
  listKitStages,
  listNeedItems,
  listStoryUsage,
  listVerifyItems,
  markDraftFinal,
  markDraftsStale,
  recordCheckout,
  recordFeedback,
  recordUsage,
  releaseEntitlement,
  replaceChecks,
  resolveVerifyItem,
  restoreDraftVersion,
  saveAngles,
  saveKitOutputs,
  saveKitPreview,
  setCheckStatus,
  setCurrentDraft,
  setKitStatus,
  updateDeliverable,
  updateDraftState,
  updateRevisionRequest,
  upsertDeliverables,
  upsertKitStage,
  type NewDraftVersion,
} from "../src/repos";
import {
  dossierSnapshots,
  entitlements,
  purchases,
  schoolCycles,
  schools,
  usageLedger,
  webhookEvents,
} from "../src/schema";
import { connectTestDb, createUserFactory } from "./support/db";

// Phase 4 repositories against a real database: the checkout → webhook → entitlement → kit path
// and its idempotency, refunds, fair-use counters, the resumable kit stages, and the Workspace's
// deliverables, versions, checks, NEED and Verify items. Every school is FICTIONAL, every user
// synthetic, and all of it is removed afterwards.

const EVENT_PREFIX = `test-evt-${randomUUID().slice(0, 8)}`;
const tag = () => randomUUID().slice(0, 8);

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const schoolIds: string[] = [];
const kitIds: string[] = [];

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
});

afterAll(async () => {
  if (!handle) return;
  const { db } = handle;
  if (kitIds.length > 0) await db.delete(usageLedger).where(inArray(usageLedger.kitId, kitIds));
  // Users cascade to user_schools, checkouts, purchases, entitlements, kits and everything under them.
  await factory.cleanup();
  if (schoolIds.length > 0) await db.delete(schools).where(inArray(schools.id, schoolIds));
  await db.delete(webhookEvents).where(like(webhookEvents.eventId, `${EVENT_PREFIX}%`));
  await handle.pool.end();
});

async function fictionalCycle() {
  const t = tag();
  const [school] = await handle.db
    .insert(schools)
    .values({
      slug: `fictional-kestrel-${t}`,
      name: `Fictional Kestrel ${t}`,
      shortName: "Kestrel",
      region: "us",
    })
    .returning();
  schoolIds.push(school!.id);
  const [cycle] = await handle.db
    .insert(schoolCycles)
    .values({ schoolId: school!.id, cycle: "2026-27", status: "live" })
    .returning();
  return { school: school!, cycle: cycle! };
}

async function snapshot(userId: string, version: number) {
  await handle.db
    .insert(dossierSnapshots)
    .values({ userId, version, compactText: "synthetic", tokenCount: 1 });
}

const eventId = () => `${EVENT_PREFIX}-${tag()}`;

/** A user with a school on their list and a recorded checkout for it. */
async function buyer() {
  const userId = await factory.create();
  const { cycle } = await fictionalCycle();
  const us = await addUserSchool(handle.db, userId, { schoolCycleId: cycle.id });
  const txn = `txn_${tag()}`;
  const checkout = await recordCheckout(handle.db, userId, {
    provider: "fake",
    providerCheckoutId: txn,
    userSchoolId: us.id,
    amountCents: 10_000,
    currency: "usd",
  });
  return { userId, cycleId: cycle.id, userSchoolId: us.id, txn, checkout: checkout! };
}

function completed(b: { userId: string; cycleId: string; txn: string }, id = eventId()) {
  return {
    provider: "fake",
    eventId: id,
    type: "transaction.completed",
    providerTxnId: b.txn,
    productKey: `school_kit:${b.cycleId}`,
    userId: b.userId,
    schoolCycleId: b.cycleId,
    amountCents: 10_000,
    currency: "USD",
    discountId: null,
    raw: { synthetic: true },
  };
}

async function unlocked() {
  const b = await buyer();
  const result = await applyPurchaseCompleted(handle.db, completed(b));
  if (result.outcome !== "applied") throw new Error("purchase not applied");
  kitIds.push(result.kitId);
  return { ...b, kitId: result.kitId };
}

const PREVIEW = {
  positioning: { must_see: [] },
  fileMap: { items: [{ deliverable_key: "essay_1", primary_story: "S01", supporting: ["S02"] }] },
  packVersion: 1,
};

function draftInput(text: string, extra: Partial<NewDraftVersion> = {}): NewDraftVersion {
  return {
    author: "ai",
    content: {
      paragraphs: [
        { id: "p1", sentences: [{ text, kind: "adapted", sources: ["S01", "F02", "L003"] }] },
        {
          id: "p2",
          sentences: [{ text: "I learned to listen.", kind: "verbatim", sources: ["L004"] }],
        },
      ],
    },
    ...extra,
  };
}

/* Checkout and webhook ----------------------------------------------------------------------- */

describe("checkout", () => {
  it("takes the product and cycle from the applicant's own school row", async () => {
    const b = await buyer();
    expect(b.checkout).toMatchObject({
      productKey: `school_kit:${b.cycleId}`,
      schoolCycleId: b.cycleId,
      currency: "USD",
      status: "open",
    });
    // Recording it again returns the same row.
    const again = await recordCheckout(handle.db, b.userId, {
      provider: "fake",
      providerCheckoutId: b.txn,
      userSchoolId: b.userSchoolId,
      amountCents: 10_000,
      currency: "USD",
    });
    expect(again?.id).toBe(b.checkout.id);
  });

  it("refuses another user's school and hides another user's checkout", async () => {
    const b = await buyer();
    const stranger = await factory.create();
    expect(
      await recordCheckout(handle.db, stranger, {
        provider: "fake",
        providerCheckoutId: `txn_${tag()}`,
        userSchoolId: b.userSchoolId,
        amountCents: 1,
        currency: "USD",
      }),
    ).toBeNull();
    expect(await getCheckout(handle.db, stranger, b.txn)).toBeNull();
  });
});

describe("applyPurchaseCompleted", () => {
  it("grants once: a replayed event and a second event for the same transaction change nothing", async () => {
    const b = await buyer();
    const event = completed(b);
    const first = await applyPurchaseCompleted(handle.db, event);
    expect(first).toMatchObject({ outcome: "applied", created: true, keptPreview: false });
    if (first.outcome !== "applied") return;
    kitIds.push(first.kitId);

    const replay = await applyPurchaseCompleted(handle.db, event);
    expect(replay).toEqual({
      outcome: "duplicate",
      created: false,
      purchaseId: first.purchaseId,
      kitId: first.kitId,
    });
    const otherEvent = await applyPurchaseCompleted(handle.db, completed(b));
    expect(otherEvent).toMatchObject({ outcome: "duplicate", kitId: first.kitId });

    // Concurrent deliveries of one event.
    const racing = completed(b);
    const both = await Promise.all([
      applyPurchaseCompleted(handle.db, racing),
      applyPurchaseCompleted(handle.db, racing),
    ]);
    expect(both.map((r) => r.outcome)).toEqual(["duplicate", "duplicate"]);

    const bought = await handle.db.select().from(purchases).where(eq(purchases.userId, b.userId));
    const granted = await handle.db
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, b.userId));
    expect(bought).toHaveLength(1);
    expect(granted).toHaveLength(1);
    expect(granted[0]!.limits).toEqual({
      revisions: 150,
      voice_mocks: 5,
      drills: 150,
      kit_regenerations: 1,
    });
    expect((await getUserSchool(handle.db, b.userId, b.userSchoolId))?.status).toBe("unlocked");
    expect((await getKit(handle.db, b.userId, first.kitId))?.status).toBe("pending");
    expect((await getCheckout(handle.db, b.userId, b.txn))?.status).toBe("completed");
    expect(await hasEntitlement(handle.db, b.userId, "school_kit", b.cycleId)).toBe(true);
    expect(await isPaidUser(handle.db, b.userId)).toBe(true);
  });

  it("rejects custom data that disagrees with the checkout, and keeps rejecting its replays", async () => {
    const b = await buyer();
    const other = await factory.create();
    const forged = { ...completed(b), userId: other };
    expect(await applyPurchaseCompleted(handle.db, forged)).toMatchObject({
      outcome: "mismatch",
      reason: "user differs from the checkout",
    });
    expect(await applyPurchaseCompleted(handle.db, forged)).toMatchObject({ outcome: "mismatch" });
    const wrongCycle = { ...completed(b), schoolCycleId: randomUUID() };
    expect(await applyPurchaseCompleted(handle.db, wrongCycle)).toMatchObject({
      outcome: "mismatch",
    });
    const noCheckout = { ...completed(b), providerTxnId: `txn_${tag()}` };
    expect(await applyPurchaseCompleted(handle.db, noCheckout)).toMatchObject({
      outcome: "mismatch",
      reason: "no checkout was recorded for this transaction",
    });
    expect(await hasEntitlement(handle.db, b.userId, "school_kit", b.cycleId)).toBe(false);
    expect(await hasEntitlement(handle.db, other, "school_kit", b.cycleId)).toBe(false);
    expect((await getCheckout(handle.db, b.userId, b.txn))?.status).toBe("mismatch");
    const [row] = await handle.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, forged.eventId));
    expect(row).toMatchObject({ outcome: "mismatch" });
    expect(row?.processedAt).toBeInstanceOf(Date);
  });

  it("keeps the preview's positioning and file map when the dossier is unchanged", async () => {
    const b = await buyer();
    await snapshot(b.userId, 1);
    const preview = await saveKitPreview(handle.db, b.userId, b.userSchoolId, {
      ...PREVIEW,
      dossierSnapshotVersion: 1,
    });
    const result = await applyPurchaseCompleted(handle.db, completed(b));
    expect(result).toMatchObject({ outcome: "applied", kitId: preview!.id, keptPreview: true });
    kitIds.push(preview!.id);
    const kit = await getKit(handle.db, b.userId, preview!.id);
    expect(kit).toMatchObject({ status: "pending", positioning: PREVIEW.positioning });
    const stages = await listKitStages(handle.db, b.userId, preview!.id);
    expect(stages.map((s) => [s.stage, s.status])).toEqual([
      ["positioning", "done"],
      ["file_map", "done"],
    ]);
  });

  it("drops the preview's plan when the dossier moved on", async () => {
    const b = await buyer();
    await snapshot(b.userId, 1);
    const preview = await saveKitPreview(handle.db, b.userId, b.userSchoolId, {
      ...PREVIEW,
      dossierSnapshotVersion: 1,
    });
    await snapshot(b.userId, 2);
    const result = await applyPurchaseCompleted(handle.db, completed(b));
    expect(result).toMatchObject({ outcome: "applied", kitId: preview!.id, keptPreview: false });
    kitIds.push(preview!.id);
    expect(await getKit(handle.db, b.userId, preview!.id)).toMatchObject({
      status: "pending",
      positioning: null,
      fileMap: null,
      dossierSnapshotVersion: 2,
    });
    expect(await listKitStages(handle.db, b.userId, preview!.id)).toEqual([]);
  });
});

describe("applyRefund", () => {
  it("revokes the entitlement, keeps the kit, and ignores a replay", async () => {
    const b = await unlocked();
    const refund = {
      provider: "fake",
      eventId: eventId(),
      type: "adjustment.updated",
      providerTxnId: b.txn,
      adjustmentId: `adj_${tag()}`,
      kind: "refund" as const,
      partial: false,
      amountCents: 10_000,
    };
    expect(await applyRefund(handle.db, refund)).toMatchObject({
      outcome: "revoked",
      userId: b.userId,
    });
    expect(await applyRefund(handle.db, refund)).toEqual({ outcome: "duplicate" });
    expect(await hasEntitlement(handle.db, b.userId, "school_kit", b.cycleId)).toBe(false);
    expect(await isPaidUser(handle.db, b.userId)).toBe(false);
    expect((await getUserSchool(handle.db, b.userId, b.userSchoolId))?.status).toBe("preview");
    expect(await getKit(handle.db, b.userId, b.kitId)).not.toBeNull();
    const [purchase] = await handle.db
      .select()
      .from(purchases)
      .where(eq(purchases.providerTxnId, b.txn));
    expect(purchase?.status).toBe("refunded");
    expect(
      await consumeEntitlement(handle.db, b.userId, { refId: b.cycleId, counter: "revisions" }),
    ).toEqual({ ok: false, reason: "no_entitlement" });
  });

  it("records a partial refund without revoking, and reports an unknown transaction", async () => {
    const b = await unlocked();
    const partial = await applyRefund(handle.db, {
      provider: "fake",
      eventId: eventId(),
      type: "adjustment.updated",
      providerTxnId: b.txn,
      adjustmentId: `adj_${tag()}`,
      kind: "refund",
      partial: true,
      amountCents: 2_000,
    });
    expect(partial.outcome).toBe("partial");
    expect(await hasEntitlement(handle.db, b.userId, "school_kit", b.cycleId)).toBe(true);
    expect(
      await applyRefund(handle.db, {
        provider: "fake",
        eventId: eventId(),
        type: "adjustment.updated",
        providerTxnId: `txn_${tag()}`,
        adjustmentId: `adj_${tag()}`,
        kind: "chargeback",
        partial: false,
        amountCents: 10_000,
      }),
    ).toEqual({ outcome: "unknown_purchase" });
  });
});

describe("consumeEntitlement", () => {
  it("counts up to the limit and refuses beyond it, atomically", async () => {
    const b = await unlocked();
    const input = { refId: b.cycleId, counter: "voice_mocks" as const };
    const results = await Promise.all(
      Array.from({ length: 7 }, () => consumeEntitlement(handle.db, b.userId, input)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toEqual(
      Array.from({ length: 2 }, () =>
        expect.objectContaining({ ok: false, reason: "limit_reached", used: 5, limit: 5 }),
      ),
    );
    expect(await releaseEntitlement(handle.db, b.userId, input)).toBe(true);
    expect(await consumeEntitlement(handle.db, b.userId, input)).toMatchObject({
      ok: true,
      used: 5,
      remaining: 0,
    });
    expect(
      await consumeEntitlement(handle.db, b.userId, { ...input, amount: 3, counter: "drills" }),
    ).toMatchObject({ ok: true, used: 3, limit: 150, remaining: 147 });
  });

  it("does not let another user spend the entitlement", async () => {
    const b = await unlocked();
    const stranger = await factory.create();
    expect(
      await consumeEntitlement(handle.db, stranger, { refId: b.cycleId, counter: "revisions" }),
    ).toEqual({ ok: false, reason: "no_entitlement" });
  });
});

/* Kit lifecycle ------------------------------------------------------------------------------ */

describe("kit pipeline state", () => {
  it("persists each stage, tracks progress and attempts, and scopes to the owner", async () => {
    const b = await unlocked();
    const stranger = await factory.create();
    expect(
      await upsertKitStage(handle.db, stranger, b.kitId, "context", { status: "running" }),
    ).toBeNull();
    expect(await setKitStatus(handle.db, stranger, b.kitId, "running")).toBeNull();

    const running = await setKitStatus(handle.db, b.userId, b.kitId, "running", {
      pipelineRunId: "run_1",
    });
    expect(running?.startedAt).toBeInstanceOf(Date);
    await upsertKitStage(handle.db, b.userId, b.kitId, "context", { status: "running" });
    await upsertKitStage(handle.db, b.userId, b.kitId, "context", {
      status: "done",
      output: { ok: 1 },
    });
    await upsertKitStage(handle.db, b.userId, b.kitId, "positioning", { status: "running" });
    await upsertKitStage(handle.db, b.userId, b.kitId, "positioning", {
      status: "failed",
      error: "timeout",
    });
    const retry = await upsertKitStage(handle.db, b.userId, b.kitId, "positioning", {
      status: "running",
    });
    expect(retry).toMatchObject({ attempts: 2, error: null, ordinal: 2, finishedAt: null });
    expect(await getKitStage(handle.db, b.userId, b.kitId, "context")).toMatchObject({
      status: "done",
      output: { ok: 1 },
      ordinal: 1,
    });
    expect(await getKitStage(handle.db, stranger, b.kitId, "context")).toBeNull();
    expect((await getKit(handle.db, b.userId, b.kitId))?.stage).toEqual({
      stage: "positioning",
      ordinal: 2,
      status: "running",
      done: 1,
      total: 10,
    });

    expect(await saveKitOutputs(handle.db, stranger, b.kitId, { gaps: [] })).toBeNull();
    expect(
      await saveKitOutputs(handle.db, b.userId, b.kitId, { positioning: { a: 1 } }),
    ).toMatchObject({
      positioning: { a: 1 },
    });
    const ready = await setKitStatus(handle.db, b.userId, b.kitId, "ready");
    expect(ready).toMatchObject({ status: "ready", pipelineRunId: "run_1" });
    expect(ready?.finishedAt).toBeInstanceOf(Date);
    expect(await getKitContext(handle.db, b.userId, b.kitId)).toMatchObject({
      schoolCycleId: b.cycleId,
      userSchoolId: b.userSchoolId,
    });
    expect(await getKitContext(handle.db, stranger, b.kitId)).toBeNull();
  });

  it("allows one whole-kit regeneration, then refuses", async () => {
    const b = await unlocked();
    expect(await beginKitRegeneration(handle.db, b.userId, b.kitId)).toEqual({
      ok: false,
      reason: "busy",
    });
    await upsertKitStage(handle.db, b.userId, b.kitId, "context", { status: "done" });
    await setKitStatus(handle.db, b.userId, b.kitId, "ready");
    const first = await beginKitRegeneration(handle.db, b.userId, b.kitId);
    expect(first).toMatchObject({
      ok: true,
      kit: { status: "pending", regenerations: 1, stage: null },
    });
    expect(await listKitStages(handle.db, b.userId, b.kitId)).toEqual([]);
    await setKitStatus(handle.db, b.userId, b.kitId, "ready");
    expect(await beginKitRegeneration(handle.db, b.userId, b.kitId)).toEqual({
      ok: false,
      reason: "limit_reached",
    });
    const stranger = await factory.create();
    expect(await beginKitRegeneration(handle.db, stranger, b.kitId)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("sums the kit's cost from the ledger, per task", async () => {
    const b = await unlocked();
    const entry = (task: string, costUsd: number) => ({
      runId: randomUUID(),
      userId: b.userId,
      kitId: b.kitId,
      schoolPackId: null,
      task,
      model: "test-model",
      servedModel: "test-model",
      effort: null,
      attemptKind: "primary" as const,
      aiMode: "replay" as const,
      inputTokens: 1,
      cacheReadTokens: 0,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0,
      outputTokens: 1,
      webSearches: 0,
      costUsd,
      latencyMs: 1,
      promptVersion: "v1",
      traceId: null,
      stopReason: null,
    });
    await recordUsage(handle.db, entry("kit.draft", 0.25));
    await recordUsage(handle.db, entry("kit.draft", 0.5));
    await recordUsage(handle.db, entry("kit.gaps", 0.05));
    const cost = await getKitCost(handle.db, b.userId, b.kitId);
    expect(cost?.totalUsd).toBeCloseTo(0.8, 5);
    expect(cost?.byTask).toEqual([
      { task: "kit.draft", costUsd: 0.75, calls: 2 },
      { task: "kit.gaps", costUsd: 0.05, calls: 1 },
    ]);
    expect(await getKitCost(handle.db, await factory.create(), b.kitId)).toBeNull();
  });
});

/* Workspace ---------------------------------------------------------------------------------- */

async function workspace() {
  const b = await unlocked();
  const [essay] = (await upsertDeliverables(handle.db, b.userId, b.kitId, [
    {
      type: "essay",
      packKey: "essay_1",
      title: "Essay 1",
      promptText: "What matters most to you, and why?",
      limitKind: "words",
      limitValue: 500,
      parts: [{ part: "What matters" }, { part: "Why" }],
    },
    {
      type: "short_answer",
      packKey: "short_1",
      promptText: "Describe a hobby.",
      limitKind: "words",
      limitValue: 50,
    },
  ]))!;
  return { ...b, essayId: essay!.id };
}

describe("deliverables and angles", () => {
  it("upserts deliverables on pack key and refuses other users' kits", async () => {
    const w = await workspace();
    const again = await upsertDeliverables(handle.db, w.userId, w.kitId, [
      {
        type: "essay",
        packKey: "essay_1",
        promptText: "What matters most to you, and why? (edited)",
      },
    ]);
    expect(again?.[0]?.id).toBe(w.essayId);
    expect((await listDeliverables(handle.db, w.userId, w.kitId)).map((d) => d.packKey)).toEqual([
      "essay_1",
      "short_1",
    ]);
    const stranger = await factory.create();
    expect(
      await upsertDeliverables(handle.db, stranger, w.kitId, [
        { type: "essay", packKey: "x", promptText: "x" },
      ]),
    ).toBeNull();
    expect(await listDeliverables(handle.db, stranger, w.kitId)).toEqual([]);
    expect(await getDeliverable(handle.db, stranger, w.essayId)).toBeNull();
    expect(await updateDeliverable(handle.db, stranger, w.essayId, { status: "final" })).toBeNull();
    expect(
      await updateDeliverable(handle.db, w.userId, w.essayId, { authorshipMode: "coach" }),
    ).toMatchObject({ authorshipMode: "coach" });
  });

  it("refuses deliverables under a preview kit", async () => {
    const b = await buyer();
    const preview = await saveKitPreview(handle.db, b.userId, b.userSchoolId, {
      ...PREVIEW,
      dossierSnapshotVersion: null,
    });
    expect(
      await upsertDeliverables(handle.db, b.userId, preview!.id, [
        { type: "essay", packKey: "e", promptText: "p" },
      ]),
    ).toBeNull();
  });

  it("saves angles per label", async () => {
    const w = await workspace();
    await saveAngles(handle.db, w.userId, w.essayId, [
      {
        label: "A",
        pitch: "Lead with the turnaround",
        opening: "The plant was losing money.",
        stories: ["S01"],
        recommended: true,
      },
      {
        label: "B",
        pitch: "Lead with the mentor",
        opening: "My manager pulled me aside.",
        stories: ["S02"],
      },
    ]);
    await saveAngles(handle.db, w.userId, w.essayId, [
      { label: "B", pitch: "Lead with the apprentice", opening: "I was new.", stories: ["S03"] },
    ]);
    const rows = await listAngles(handle.db, w.userId, w.essayId);
    expect(rows.map((a) => [a.label, a.pitch])).toEqual([
      ["A", "Lead with the turnaround"],
      ["B", "Lead with the apprentice"],
    ]);
    const stranger = await factory.create();
    expect(
      await saveAngles(handle.db, stranger, w.essayId, [{ label: "C", pitch: "x", opening: "x" }]),
    ).toBeNull();
    expect(await listAngles(handle.db, stranger, w.essayId)).toEqual([]);
  });
});

describe("draft versions", () => {
  it("numbers versions, keeps one current, chains parents, and restores by copying", async () => {
    const w = await workspace();
    const [angle] = (await saveAngles(handle.db, w.userId, w.essayId, [
      { label: "A", pitch: "p", opening: "o", stories: ["S01"] },
    ]))!;
    const v1 = await createDraftVersion(
      handle.db,
      w.userId,
      w.essayId,
      draftInput("We cut costs by 40%.", { angleId: angle!.id }),
    );
    expect(v1).toMatchObject({
      version: 1,
      isCurrent: true,
      parentDraftId: null,
      plainText: "We cut costs by 40%.\n\nI learned to listen.",
      wordCount: 9,
      usedFactCodes: ["F02"],
      usedStoryCodes: ["S01"],
      angleId: angle!.id,
    });
    await updateDraftState(handle.db, w.userId, v1!.id, { lockedParagraphs: ["p2"] });
    const v2 = await createDraftVersion(handle.db, w.userId, w.essayId, {
      ...draftInput("I cut costs by 40%."),
      author: "user",
      userEditedParagraphs: ["p1"],
      note: "Your edit",
    });
    expect(v2).toMatchObject({
      version: 2,
      isCurrent: true,
      parentDraftId: v1!.id,
      lockedParagraphs: ["p2"],
      angleId: angle!.id,
    });
    expect((await getDraft(handle.db, w.userId, v1!.id))?.isCurrent).toBe(false);

    const alt = await createDraftVersion(handle.db, w.userId, w.essayId, {
      ...draftInput("An alternative."),
      makeCurrent: false,
    });
    expect(alt).toMatchObject({ version: 3, isCurrent: false });
    expect((await getCurrentDraft(handle.db, w.userId, w.essayId))?.id).toBe(v2!.id);

    const restored = await restoreDraftVersion(handle.db, w.userId, v1!.id);
    expect(restored).toMatchObject({
      version: 4,
      isCurrent: true,
      author: "user",
      parentDraftId: v2!.id,
      plainText: v1!.plainText,
      note: "Restored version 1",
    });
    const timeline = await listDraftVersions(handle.db, w.userId, w.essayId);
    expect(timeline.map((d) => [d.version, d.isCurrent])).toEqual([
      [4, true],
      [3, false],
      [2, false],
      [1, false],
    ]);
    expect(await setCurrentDraft(handle.db, w.userId, alt!.id)).toMatchObject({ isCurrent: true });
    expect((await getCurrentDraft(handle.db, w.userId, w.essayId))?.id).toBe(alt!.id);

    const pair = await getDraftPair(handle.db, w.userId, v1!.id, v2!.id);
    expect(pair?.a.id).toBe(v1!.id);
    expect(pair?.b.id).toBe(v2!.id);
  });

  it("marks one version final and moves the deliverable to final", async () => {
    const w = await workspace();
    const v1 = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("One."));
    const v2 = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Two."));
    await markDraftFinal(handle.db, w.userId, v1!.id);
    expect(await getDraft(handle.db, w.userId, v1!.id)).toMatchObject({
      isFinal: true,
      isCurrent: true,
    });
    expect((await getDraft(handle.db, w.userId, v1!.id))?.markedFinalAt).toBeInstanceOf(Date);
    expect((await getDeliverable(handle.db, w.userId, w.essayId))?.status).toBe("final");
    await markDraftFinal(handle.db, w.userId, v2!.id);
    expect((await getDraft(handle.db, w.userId, v1!.id))?.isFinal).toBe(false);
    await markDraftFinal(handle.db, w.userId, v2!.id, false);
    expect((await getDraft(handle.db, w.userId, v2!.id))?.isFinal).toBe(false);
    expect((await getDeliverable(handle.db, w.userId, w.essayId))?.status).toBe("draft_ready");
  });

  it("is owner-only throughout", async () => {
    const w = await workspace();
    const v1 = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Mine."));
    const stranger = await factory.create();
    expect(
      await createDraftVersion(handle.db, stranger, w.essayId, draftInput("Theirs.")),
    ).toBeNull();
    expect(await getDraft(handle.db, stranger, v1!.id)).toBeNull();
    expect(await getCurrentDraft(handle.db, stranger, w.essayId)).toBeNull();
    expect(await listDraftVersions(handle.db, stranger, w.essayId)).toEqual([]);
    expect(await getDraftPair(handle.db, stranger, v1!.id, v1!.id)).toBeNull();
    expect(await restoreDraftVersion(handle.db, stranger, v1!.id)).toBeNull();
    expect(await setCurrentDraft(handle.db, stranger, v1!.id)).toBeNull();
    expect(
      await updateDraftState(handle.db, stranger, v1!.id, { lockedParagraphs: [] }),
    ).toBeNull();
    expect(await markDraftFinal(handle.db, stranger, v1!.id)).toBeNull();
    expect(await replaceChecks(handle.db, stranger, v1!.id, [])).toBeNull();
    expect(await listChecks(handle.db, stranger, v1!.id)).toEqual([]);
    expect(
      await createRevisionRequest(handle.db, stranger, v1!.id, { instruction: "x" }),
    ).toBeNull();
    expect(await createNeedItems(handle.db, stranger, w.essayId, [{ question: "x" }])).toBeNull();
    expect(
      await addVerifyItems(handle.db, stranger, w.kitId, [{ text: "x", reason: "y" }]),
    ).toBeNull();
    expect(
      await markDraftsStale(handle.db, { userId: stranger, factCodes: ["F02"], reason: "x" }),
    ).toEqual([]);
    expect((await getDraft(handle.db, w.userId, v1!.id))?.stale).toBe(false);
    // Another user's parent draft or angle cannot be attached.
    const other = await workspace();
    const theirs = await createDraftVersion(
      handle.db,
      other.userId,
      other.essayId,
      draftInput("Other."),
    );
    expect(
      await createDraftVersion(handle.db, w.userId, w.essayId, {
        ...draftInput("x"),
        parentDraftId: theirs!.id,
      }),
    ).toBeNull();
  });
});

describe("markDraftsStale", () => {
  it("flags the drafts that used an edited fact or story, and the applicant can dismiss it", async () => {
    const w = await workspace();
    const v1 = await createDraftVersion(
      handle.db,
      w.userId,
      w.essayId,
      draftInput("Uses F02 and S01."),
    );
    const [, shortId] = (await listDeliverables(handle.db, w.userId, w.kitId)).map((d) => d.id);
    const other = await createDraftVersion(handle.db, w.userId, shortId!, {
      author: "ai",
      content: {
        paragraphs: [
          { id: "p1", sentences: [{ text: "Hobby.", kind: "composed", sources: ["S09"] }] },
        ],
      },
    });
    expect(await markDraftsStale(handle.db, { userId: w.userId, reason: "nothing" })).toEqual([]);
    const flagged = await markDraftsStale(handle.db, {
      userId: w.userId,
      factCodes: ["F02"],
      reason: "This draft used the old team size.",
    });
    expect(flagged).toEqual([v1!.id]);
    expect(await getDraft(handle.db, w.userId, v1!.id)).toMatchObject({
      stale: true,
      staleReason: "This draft used the old team size.",
    });
    expect((await getDraft(handle.db, w.userId, other!.id))?.stale).toBe(false);
    expect(
      await markDraftsStale(handle.db, {
        userId: w.userId,
        storyCodes: ["S09", "S99"],
        reason: "Story edited.",
      }),
    ).toEqual([other!.id]);
    // A restored copy of a stale version is stale too.
    const restored = await restoreDraftVersion(handle.db, w.userId, v1!.id);
    expect(restored?.stale).toBe(true);
    expect(await updateDraftState(handle.db, w.userId, v1!.id, { stale: false })).toMatchObject({
      stale: false,
      staleReason: null,
    });
  });
});

describe("checks, NEED items, Verify items, revisions and feedback", () => {
  it("replaces findings per source and keeps dismissals", async () => {
    const w = await workspace();
    const draft = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Text."));
    const finding = {
      source: "linter" as const,
      ruleId: "TELL-01",
      severity: "consider" as const,
      location: { paragraph_id: "p1", sentence: 0 },
      explanation: "This phrase is common in generated essays.",
    };
    const [first] = (await replaceChecks(handle.db, w.userId, draft!.id, [finding]))!;
    await replaceChecks(
      handle.db,
      w.userId,
      draft!.id,
      [{ ...finding, source: "critic", ruleId: "CRIT-1" }],
      {
        sources: ["critic"],
      },
    );
    expect(await setCheckStatus(handle.db, w.userId, first!.id, "dismissed")).toMatchObject({
      status: "dismissed",
    });
    const rerun = await replaceChecks(
      handle.db,
      w.userId,
      draft!.id,
      [finding, { ...finding, ruleId: "LIMIT", severity: "must" }],
      { sources: ["linter"] },
    );
    expect(rerun?.map((c) => [c.ruleId, c.status])).toEqual([
      ["TELL-01", "dismissed"],
      ["LIMIT", "open"],
    ]);
    expect((await listChecks(handle.db, w.userId, draft!.id)).map((c) => c.source).sort()).toEqual([
      "critic",
      "linter",
      "linter",
    ]);
    expect(await setCheckStatus(handle.db, await factory.create(), first!.id, "open")).toBeNull();
  });

  it("answers NEED items with the applicant's own source only", async () => {
    const w = await workspace();
    const draft = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Text."));
    const [need] = (await createNeedItems(handle.db, w.userId, w.essayId, [
      {
        draftId: draft!.id,
        paragraphId: "p1",
        afterSentence: 0,
        question: "What did your manager say?",
        approxWords: 20,
      },
    ]))!;
    expect(need).toMatchObject({ kitId: w.kitId, status: "open", blocking: false });
    const stranger = await factory.create();
    const theirSource = await createSource(handle.db, stranger, { kind: "need_answer", text: "x" });
    expect(await answerNeedItem(handle.db, w.userId, need!.id, theirSource.id)).toBeNull();
    const mine = await createSource(handle.db, w.userId, {
      kind: "need_answer",
      text: "Keep going.",
    });
    expect(await answerNeedItem(handle.db, stranger, need!.id, theirSource.id)).toBeNull();
    expect(await answerNeedItem(handle.db, w.userId, need!.id, mine.id)).toMatchObject({
      status: "answered",
      answerSourceId: mine.id,
    });
    expect(
      await listNeedItems(handle.db, w.userId, { kitId: w.kitId, status: "answered" }),
    ).toHaveLength(1);
    expect(await listNeedItems(handle.db, stranger, { kitId: w.kitId })).toEqual([]);
  });

  it("collates Verify items without duplicates and resolves them", async () => {
    const w = await workspace();
    const items = [
      {
        deliverableId: w.essayId,
        text: "Team of 13",
        reason: "Number in the draft",
        cites: ["F02"],
      },
      { text: "Harbour Fund club", reason: "School specific", url: "https://example.test/clubs" },
    ];
    expect(await addVerifyItems(handle.db, w.userId, w.kitId, items)).toHaveLength(2);
    expect(await addVerifyItems(handle.db, w.userId, w.kitId, items)).toEqual([]);
    const [first] = await listVerifyItems(handle.db, w.userId, w.kitId);
    expect(
      await resolveVerifyItem(handle.db, w.userId, first!.id, {
        status: "corrected",
        correction: "Team of 11",
      }),
    ).toMatchObject({ status: "corrected", correction: "Team of 11" });
    expect(await listVerifyItems(handle.db, w.userId, w.kitId, { status: "open" })).toHaveLength(1);
    const stranger = await factory.create();
    expect(
      await resolveVerifyItem(handle.db, stranger, first!.id, { status: "confirmed" }),
    ).toBeNull();
    expect(await listVerifyItems(handle.db, stranger, w.kitId)).toEqual([]);
    // A deliverable from another kit is refused.
    const other = await workspace();
    expect(
      await addVerifyItems(handle.db, w.userId, w.kitId, [
        { deliverableId: other.essayId, text: "x", reason: "y" },
      ]),
    ).toBeNull();
  });

  it("links a revision to a result version of the same deliverable only", async () => {
    const w = await workspace();
    const v1 = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Text."));
    const request = await createRevisionRequest(handle.db, w.userId, v1!.id, {
      instruction: "Warmer",
      quickAction: "warmer",
      targetParagraphs: ["p1"],
    });
    const v2 = await createDraftVersion(handle.db, w.userId, w.essayId, draftInput("Warmer text."));
    expect(
      await updateRevisionRequest(handle.db, w.userId, request!.id, {
        status: "ready",
        resultDraftId: v2!.id,
        summary: "Warmed the opening.",
      }),
    ).toMatchObject({ status: "ready", resultDraftId: v2!.id });
    const [, shortId] = (await listDeliverables(handle.db, w.userId, w.kitId)).map((d) => d.id);
    const elsewhere = await createDraftVersion(handle.db, w.userId, shortId!, draftInput("Short."));
    expect(
      await updateRevisionRequest(handle.db, w.userId, request!.id, {
        resultDraftId: elsewhere!.id,
      }),
    ).toBeNull();
    expect(
      await updateRevisionRequest(handle.db, await factory.create(), request!.id, {
        status: "accepted",
      }),
    ).toBeNull();
    const fb = await recordFeedback(handle.db, w.userId, {
      targetType: "draft",
      targetId: v2!.id,
      rating: 1,
    });
    expect(fb).toMatchObject({ userId: w.userId, rating: 1 });
  });
});

describe("listStoryUsage", () => {
  it("reports primary and supporting use from the file map and current drafts", async () => {
    const w = await workspace();
    await saveKitOutputs(handle.db, w.userId, w.kitId, {
      fileMap: {
        items: [
          { deliverable_key: "essay_1", primary_story: "S01", supporting: ["S02"] },
          { deliverable_key: "video_1", primary_story: null, supporting: [] },
        ],
      },
    });
    const [, shortId] = (await listDeliverables(handle.db, w.userId, w.kitId)).map((d) => d.id);
    await createDraftVersion(handle.db, w.userId, shortId!, {
      author: "ai",
      content: {
        paragraphs: [
          { id: "p1", sentences: [{ text: "Hobby.", kind: "verbatim", sources: ["S05"] }] },
        ],
      },
    });
    const usage = await listStoryUsage(handle.db, w.userId);
    expect(usage.map((u) => [u.storyCode, u.role, u.deliverableKey, u.deliverableId])).toEqual([
      ["S01", "primary", "essay_1", w.essayId],
      ["S02", "supporting", "essay_1", w.essayId],
      ["S05", "supporting", "short_1", shortId],
    ]);
    expect((await listStoryUsage(handle.db, w.userId, ["S02"])).map((u) => u.storyCode)).toEqual([
      "S02",
    ]);
    expect(await listStoryUsage(handle.db, await factory.create())).toEqual([]);
  });
});
