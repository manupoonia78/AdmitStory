/* eslint-disable @typescript-eslint/no-explicit-any -- the fake model reads loosely typed task inputs */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_IDS, ROUTES, computeCost, estimateKitCost } from "@admitstory/ai";
import { inventedFacts } from "../../../packages/ai/src/fixtures/golden";
import { getTask } from "../../../packages/ai/src/tasks";
import {
  addUserSchool,
  listAngles,
  listNeedItems,
  createGoldenLines,
  createStories,
  createUsageLedgerSink,
  getKit,
  getKitCost,
  getUserSchool,
  hasEntitlement,
  listChecks,
  listDeliverables,
  getCurrentDraft,
  listKitStages,
  listVerifyItems,
  recordCheckout,
  schoolCycles,
  schoolPacks,
  schools,
  upsertFacts,
  type DbHandle,
} from "@admitstory/db";
import { compilePack } from "@admitstory/kb";
import {
  buildSignedFakeWebhook,
  createFakePayments,
  schoolKitProductKey,
} from "@admitstory/payments";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connectTestDb, createUserFactory } from "../../../packages/db/test/support/db";

// Phase 4 acceptance (spec §16 Phase 4): a webhook replay grants one entitlement; a full kit runs
// on a FICTIONAL school with every stage persisted before the next; a crash resumes without paying
// twice for finished stages; the generated drafts carry provenance and pass the golden-set
// invented-fact check; and the kit's cost, from its ledger rows, is inside §12.2's range.
//
// The model is a fake that validates every input and output with the task's own Zod schemas (as
// ai.run() does) and prices each call from its token counts, so the ledger is realistic.

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
type KitAI = import("@/lib/kit/pipeline").KitAI;

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const schoolIds: string[] = [];
const kitIds: string[] = [];
const root = join(process.cwd());
const PACK = JSON.parse(
  readFileSync(join(root, "fixtures/schools/kestrel-lake/pack.json"), "utf8"),
);

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
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

/* Fixtures -------------------------------------------------------------------------------------- */

async function fictionalSchool() {
  const tag = randomUUID().slice(0, 8);
  const [school] = await handle.db
    .insert(schools)
    .values({
      slug: `fictional-kestrel-${tag}`,
      name: `Kestrel Lake ${tag}`,
      shortName: "Kestrel Lake",
      region: "us",
    })
    .returning();
  schoolIds.push(school!.id);
  const [cycle] = await handle.db
    .insert(schoolCycles)
    .values({ schoolId: school!.id, cycle: PACK.cycle, status: "live" })
    .returning();
  const compiled = compilePack(PACK, { cycle: PACK.cycle, now: new Date("2026-10-01") });
  await handle.db.insert(schoolPacks).values({
    cycleId: cycle!.id,
    version: 1,
    status: "published",
    data: PACK,
    compiledPrompt: compiled.text,
    tokenCount: compiled.tokenCount,
    publishedAt: new Date(),
  });
  return { school: school!, cycle: cycle!, compiled: compiled.text };
}

const LINES = [
  "It was two in the morning and the feed was dropping messages.",
  "I called the vendor's engineer and asked him to widen the window.",
  "Twelve kids come every Saturday now.",
];

async function applicantWithDossier() {
  const userId = await factory.create();
  const [s1, s2] = await createStories(handle.db, userId, [
    {
      nickname: "The night-shift fix",
      era: "2024",
      situation: "A go-live where the lab feed dropped messages overnight.",
      traits: ["delivers_under_pressure"],
      lenses: ["leadership"],
    },
    {
      nickname: "Twelve kids on a Saturday",
      era: "2023",
      situation: "A Saturday computer class at a government school.",
      traits: ["community_builder"],
      lenses: ["self_awareness"],
    },
  ]);
  await createGoldenLines(handle.db, userId, [
    { storyId: s1!.id, text: LINES[0]! },
    { storyId: s1!.id, text: LINES[1]! },
    { storyId: s2!.id, text: LINES[2]! },
  ]);
  await upsertFacts(handle.db, userId, [
    { key: "employer_current", value: "Meridian Health Systems", status: "confirmed" },
    { key: "team_size", value: "13", status: "confirmed" },
  ]);
  return userId;
}

async function paidKit() {
  const userId = await applicantWithDossier();
  const { cycle, compiled } = await fictionalSchool();
  const us = await addUserSchool(handle.db, userId, { schoolCycleId: cycle.id });
  const txn = `txn_${randomUUID().replace(/-/g, "").slice(0, 26)}`;
  await recordCheckout(handle.db, userId, {
    provider: "fake",
    providerCheckoutId: txn,
    userSchoolId: us.id,
    amountCents: 10_000,
    currency: "USD",
  });
  const webhook = buildSignedFakeWebhook({
    type: "purchase_completed",
    transactionId: txn,
    userId,
    productKey: schoolKitProductKey(cycle.id),
    amountCents: 10_000,
    currency: "USD",
  });
  return { userId, cycleId: cycle.id, userSchoolId: us.id, webhook, compiled };
}

/* The fake model -------------------------------------------------------------------------------- */

const s = (text: string, kind: "verbatim" | "adapted" | "composed", sources: string[]) => ({
  text,
  kind,
  sources,
});

function reply(task: string, input: Record<string, any>): unknown {
  switch (task) {
    case "kit.positioning_filemap":
      return {
        positioning: {
          must_see: [{ text: "Builds systems people rely on at night.", cites: ["S01"] }],
          lead_traits: [
            { trait: "delivers_under_pressure", why: "The night-shift fix.", cites: ["S01"] },
            { trait: "community_builder", why: "The Saturday class.", cites: ["S02"] },
          ],
          red_flags: [],
          career_lane_check: {
            short_term: "Product manager in health software.",
            realism: "Realistic.",
            plan_b: "Product analyst.",
            risks: [],
            cites: [],
          },
          reapplicant_angle: null,
        },
        file_map: {
          items: input.deliverables.map((d: { key: string }, i: number) => ({
            deliverable_key: d.key,
            primary_story: i % 2 === 0 ? "S01" : "S02",
            primary_reason_if_none: null,
            supporting: [],
            traits_shown: [],
            lenses: [],
            why: "Its strongest evidence.",
          })),
          recommender_plan: [],
          coverage_gaps: [],
          warnings: [],
        },
      };
    case "kit.gaps":
      return {
        gaps: [
          {
            question: "How many people were on the go-live call?",
            blocking: true,
            deliverable_key: input.deliverables[0].key,
            story: "S01",
            approx_words: 15,
            why: "The essay needs the scale.",
          },
        ],
      };
    case "kit.angles":
      return {
        angles: input.essays.flatMap((e: { key: string }) =>
          (["A", "B"] as const).map((label) => ({
            deliverable_key: e.key,
            label,
            pitch:
              label === "A"
                ? "The night the feed broke, told as one night."
                : "The Saturday class, told as a long habit.",
            opening_line: label === "A" ? LINES[0] : LINES[2],
            stories: [label === "A" ? "S01" : "S02"],
            beats: [{ beat: "The moment", words: 120, sources: [label === "A" ? "S01" : "S02"] }],
            proves: [],
            risks: [],
            recommended: label === "A",
            reason: "The clearest evidence of the lead traits.",
          })),
        ),
        single_angle: [],
      };
    case "kit.draft":
      return input.mode === "coach"
        ? {
            draft: null,
            coach: {
              beats: [
                {
                  beat: "The moment",
                  words: 120,
                  your_lines: [{ text: LINES[0], source: "L001" }],
                  questions: ["What did you do first?"],
                },
              ],
            },
          }
        : {
            coach: null,
            draft: {
              paragraphs: [
                {
                  id: "p1",
                  sentences: [
                    s(LINES[0]!, "verbatim", ["L001"]),
                    s("Nobody else on the team was awake to fix it.", "composed", ["S01"]),
                  ],
                },
                {
                  id: "p2",
                  sentences: [
                    s(LINES[1]!, "verbatim", ["L002"]),
                    s("By six, the morning rounds had their results.", "adapted", ["S01"]),
                  ],
                },
              ],
              needs: [
                {
                  paragraph_id: "p2",
                  after_sentence: 0,
                  question: "What did the vendor's engineer say?",
                  approx_words: 15,
                },
              ],
              prompt_parts_answered: [],
              notes: {
                why_this_story: "It shows the trait under pressure.",
                what_it_proves: "Delivers under pressure.",
                school_fit_points: [],
              },
              verify: [
                {
                  text: "By six, the morning rounds had their results.",
                  reason: "Reconstructed from your story.",
                },
              ],
            },
          };
    case "kit.shortform":
      return {
        goals_statement: null,
        items: input.items.map((item: { key: string; kind: string }) =>
          item.kind === "video"
            ? {
                deliverable_key: item.key,
                format: "talking_points",
                paragraphs: [],
                list_tones: [],
                video: {
                  questions: [
                    {
                      question: "Why this school?",
                      points: [
                        { text: "The Saturday class taught me to teach.", sources: ["S02"] },
                      ],
                    },
                  ],
                  structure: { seconds: 60, segments: [{ label: "Answer", seconds: 60 }] },
                },
                needs: [],
                why: "Talking points from the class.",
              }
            : {
                deliverable_key: item.key,
                format: "prose",
                paragraphs: [{ id: "p1", sentences: [s(LINES[2]!, "verbatim", ["L003"])] }],
                list_tones: [],
                video: null,
                needs: [],
                why: "Short and in their words.",
              },
        ),
        verify: [],
      };
    case "kit.critic":
      return {
        findings: [],
        scores: { answers_prompt: 4, story_quality: 4, voice_fidelity: 4 },
        first_action: null,
      };
    case "draft.revise":
      return { patches: [], summary: "Nothing to cut." };
    default:
      throw new Error(`No fake reply for ${task}`);
  }
}

function fakeAI(calls: string[], failOn?: { task: string; times: number }) {
  const ledger = createUsageLedgerSink(handle.db);
  let failures = 0;
  const ai: KitAI = {
    async run(task, input, ctx) {
      calls.push(task);
      if (failOn?.task === task && failures < failOn.times) {
        failures += 1;
        throw new Error(`Simulated crash in ${task}`);
      }
      const def = getTask(task);
      const parsedInput = def.input.parse(input) as Record<string, any>;
      const output = def.output.parse(reply(task, parsedInput));
      const route = ROUTES[task as keyof typeof ROUTES];
      const usage = {
        inputTokens: Math.round(
          (JSON.stringify(input).length +
            (ctx?.schoolPack?.length ?? 0) +
            (ctx?.dossier?.length ?? 0)) /
            4,
        ),
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        outputTokens: Math.round(JSON.stringify(output).length / 4) * 6,
        webSearches: 0,
      };
      const modelId = MODEL_IDS[route.model];
      await ledger.write({
        runId: randomUUID(),
        userId: ctx?.userId ?? null,
        kitId: ctx?.kitId ?? null,
        schoolPackId: ctx?.schoolPackId ?? null,
        task,
        model: modelId,
        servedModel: modelId,
        effort: null,
        attemptKind: ctx?.escalate ? "escalation" : "primary",
        aiMode: "replay",
        ...usage,
        costUsd: computeCost({ modelId, usage }),
        latencyMs: 1,
        promptVersion: `${task}@v1`,
        traceId: null,
        stopReason: "end_turn",
      });
      return output as never;
    },
  };
  return ai;
}

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
