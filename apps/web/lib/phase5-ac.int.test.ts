/* eslint-disable @typescript-eslint/no-explicit-any -- the fake model reads loosely typed task inputs */
import { randomUUID } from "node:crypto";
import {
  createSource,
  getFormAdvice,
  getKitStage,
  latestResumeReview,
  listDeliverables,
  type DbHandle,
} from "@admitstory/db";
import { countAfterNormalize } from "@admitstory/linters";
import { buildSignedFakeWebhook, createFakePayments } from "@admitstory/payments";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connectTestDb, createUserFactory } from "../../../packages/db/test/support/db";
import { kitSupport, type KitEnv } from "../test/kit-support";

// Phase 5 acceptance (spec §16 Phase 5, §5.10), against the database: pipeline stage 9 writes the
// Form Advisor's advice and the Résumé Pass; every written entry fits its field by the portal's
// count even when the model overshoots; the form view, the applicant's edits, the consistency
// check and its one-click fix work through the routes; every new route answers 404 (or 403) to
// another applicant; and a refund closes the form view. The seeded-mismatch AC is a unit test
// (packages/linters/test/consistency.test.ts).

vi.mock("server-only", () => ({}));
const caller = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/app-user", () => ({
  requireOnboardedUser: vi.fn(async () => ({
    session: { user: { id: caller.userId, email: "caller@example.test", name: "Caller" } },
    profile: { voiceprint: null },
  })),
}));
vi.mock("@/lib/strategy/dispatch", () => ({
  dispatch: vi.fn(async () => {}),
  inngestConfigured: () => false,
}));
// The routes' model is the same fake the pipeline gets.
const model = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/ai", () => ({ ai: () => model.current }));

const { processWebhook, setPaymentsProvider } = await import("@/lib/payments/server");
const { runPipeline } = await import("@/lib/kit/pipeline");
const { loadFormView } = await import("@/lib/forms/view");

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const schoolIds: string[] = [];
const kitIds: string[] = [];

/** Over the 300-character field on purpose: the app must fit it, without inventing anything. */
const LONG_ENTRY = [
  "Led a team of 15 engineers through the overnight lab-feed go-live at Meridian Health Systems.",
  "Rebuilt the message queue so results reached the morning rounds on time.",
  "Wrote the runbook the night shift still uses.",
  "Trained four colleagues to take the on-call rota.",
  "Started a Saturday computer class that twelve kids now attend every week.",
].join(" ");

const RESUME_TEXT = [
  "Asha Varma",
  "asha@example.test",
  "Experience",
  "Meridian Health Systems",
  "Senior Software Engineer",
  "Apr 2024 – Present",
  "Responsible for the lab results feed",
  "Led a 13-person team across three sites",
  "Education",
  "BTech Computer Science, 2016",
].join("\n");

function reply(task: string, input: Record<string, any>): unknown {
  if (task === "forms.advise")
    return {
      sections: input.sections.map((section: { key: string }) => ({
        section_key: section.key,
        items: [
          {
            id: "i1",
            candidate: "Night-shift go-live",
            cites: ["S01"],
            recommendation: "lead_with",
            combine_with: null,
            move_to: null,
            reason: "It proves you deliver under pressure, which no essay covers.",
            entry: input.mode === "coach" ? null : { text: LONG_ENTRY, sources: ["S01"] },
            stronger: ["Say how many results reached the rounds."],
            needs: [],
          },
          {
            id: "i2",
            candidate: "Saturday class",
            cites: ["S02"],
            recommendation: "move_to_essay",
            combine_with: null,
            move_to: input.deliverables[0]?.key ?? null,
            reason: "It is the heart of an essay, so the form doesn't need it.",
            entry: null,
            stronger: [],
            needs: [],
          },
        ],
      })),
      could_still_do: [
        { text: "Mentor a new engineer", why: "It shows you grow people.", time: "About 2 weeks" },
      ],
      verify: [],
    };
  if (task === "resume.review")
    return {
      header: { name: "Asha Varma", lines: ["asha@example.test"] },
      sections: [
        {
          id: "s1",
          heading: "Experience",
          kind: "experience",
          lines: [],
          roles: [
            {
              id: "r1",
              organisation: "Meridian Health Systems",
              title: "Senior Software Engineer",
              dates: "Apr 2024 – Present",
              location: null,
              bullets: [
                {
                  id: "b1",
                  original: "Responsible for the lab results feed",
                  verdict: "activity",
                  issues: ["activity_not_achievement"],
                  feedback: "Say what changed because of you.",
                  rewrite: {
                    text: "Kept lab results flowing to [?1] morning rounds by rebuilding the feed",
                    sources: ["S01"],
                    needs: [{ question: "How many wards get the results?", approx_words: 3 }],
                  },
                },
                {
                  id: "b2",
                  original: "Led a 13-person team across three sites",
                  verdict: "achievement",
                  issues: [],
                  feedback: "Already strong.",
                  rewrite: null,
                },
              ],
            },
          ],
        },
        {
          id: "s2",
          heading: "Education",
          kind: "education",
          lines: ["BTech Computer Science, 2016"],
          roles: [],
        },
      ],
      section_order: { order: ["s1", "s2"], reason: "Your experience is the stronger evidence." },
      priorities: ["Turn duties into results"],
    };
  return undefined;
}

const env = { schoolIds, reply } as KitEnv;
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
  if (kitIds.length > 0)
    await handle.pool.query("delete from usage_ledger where kit_id = any($1)", [kitIds]);
  await factory.cleanup();
  if (schoolIds.length > 0)
    await handle.pool.query("delete from schools where id = any($1)", [schoolIds]);
  await handle.pool.query("delete from webhook_events where event_id like $1", ["evt_fake%"]);
  await handle.pool.end();
});

/** A bought kit, with a résumé uploaded, run through the whole pipeline. */
async function builtKit(calls: string[] = []) {
  const buyer = await paidKit();
  await createSource(handle.db, buyer.userId, {
    kind: "upload",
    text: RESUME_TEXT,
    meta: { fileName: "asha-resume.pdf", documentKind: "resume" },
  });
  await processWebhook(buyer.webhook.body, buyer.webhook.headers);
  const kit = (await handle.db.query.kits.findFirst({
    where: (t, { eq }) => eq(t.userId, buyer.userId),
  }))!;
  kitIds.push(kit.id);
  const ai = fakeAI(calls);
  model.current = ai;
  const result = await runPipeline({ ai, db: handle.db }, { kitId: kit.id, userId: buyer.userId });
  expect(result.status).toBe("ready");
  const deliverables = (await listDeliverables(handle.db, buyer.userId, kit.id)) ?? [];
  const form = deliverables.find((d) => d.type === "form_section")!;
  return { ...buyer, kit, form, deliverables };
}

type Handler = (request: Request, context: unknown) => Promise<Response>;
async function call(
  route: string,
  method: string,
  params: Record<string, string>,
  init: { body?: unknown; query?: string } = {},
): Promise<Response> {
  const mod = (await import(`@/app/api/${route}/route`)) as Record<string, Handler>;
  return mod[method]!(
    new Request(`http://localhost:3000/x${init.query ?? ""}`, {
      method,
      ...(init.body === undefined
        ? {}
        : { body: JSON.stringify(init.body), headers: { "content-type": "application/json" } }),
    }),
    { params: Promise.resolve(params) },
  );
}

describe("Phase 5 acceptance", () => {
  it(
    "stage 9 writes the form advice and the résumé review; every entry fits its field",
    { timeout: 180_000 },
    async () => {
      const calls: string[] = [];
      const { userId, kit } = await builtKit(calls);

      const stage = await getKitStage(handle.db, userId, kit.id, "forms");
      expect(stage?.status).toBe("done");
      expect(stage?.output).toMatchObject({
        forms: { sections: 1, mode: "draft" },
        resume: "reviewed",
      });
      expect(calls.filter((t) => t === "forms.advise")).toHaveLength(1);
      expect(calls.filter((t) => t === "resume.review")).toHaveLength(1);

      const advice = (await getFormAdvice(handle.db, userId, kit.id))!;
      expect(advice.mode).toBe("draft");
      const section = advice.content.sections[0]!;
      // Every recommendation has a reason (§5.10 AC).
      for (const item of section.items) expect(item.reason.trim().length).toBeGreaterThan(0);
      // Every written entry fits the 300-character field by the portal's count (§5.10 AC); the
      // overshoot was cut at a sentence, never rewritten, so nothing new is in it.
      const entry = section.items[0]!.entry!;
      expect(countAfterNormalize(entry.text, "chars_incl_spaces")).toBeLessThanOrEqual(300);
      expect(LONG_ENTRY.startsWith(entry.text.replace(/\s+$/, ""))).toBe(true);
      expect(advice.trimmed).toEqual(["leadership_roles/i1"]);
      expect(advice.content.verify.some((v) => v.reason.startsWith("Shortened"))).toBe(true);

      const review = (await latestResumeReview(handle.db, userId))!;
      expect(review.content.sections[0]!.roles[0]!.bullets).toHaveLength(2);
    },
  );

  it(
    "serves the form view, keeps the applicant's edits and fixes a mismatch in one click",
    { timeout: 180_000 },
    async () => {
      const { userId, kit, form } = await builtKit();
      caller.userId = userId;
      const params = { id: kit.id };

      const view = await call("kits/[id]/forms", "GET", params, {
        query: `?deliverable=${form.id}`,
      });
      expect(view.status).toBe(200);
      const body = (await view.json()) as Awaited<ReturnType<typeof loadFormView>>;
      expect(body.section.items.map((i) => i.recommendation)).toEqual([
        "lead_with",
        "move_to_essay",
      ]);
      expect(body.section.items[0]!.citations[0]?.label).toBe("The night-shift fix");
      expect(body.section.rule).toEqual({ unit: "characters", limit: 300, spaces: true });

      // The applicant's text wins and survives a refresh of the advice.
      const edit = await call(
        "kits/[id]/forms/items/[itemId]",
        "PATCH",
        { id: kit.id, itemId: "i1" },
        {
          body: {
            section: "leadership_roles",
            text: "Led a team of 15 engineers through a go-live.",
          },
        },
      );
      expect(edit.status).toBe(200);
      const refresh = await call("kits/[id]/forms/refresh", "POST", params);
      expect(refresh.status).toBe(200);
      expect(await refresh.json()).toMatchObject({ refreshed: false });
      const edited = await loadFormView(userId, form.id);
      expect(edited.section.items[0]!.userText).toBe(
        "Led a team of 15 engineers through a go-live.",
      );

      // The Fact Sheet says 13; the edited entry says 15: a Must fix, then "Use “13” here".
      const report = (await (
        await call("consistency", "GET", {}, { query: `?kitId=${kit.id}` })
      ).json()) as {
        findings: {
          id: string;
          subject: string;
          expected: string | null;
          values: { docId: string; ref: string; docKind: string }[];
        }[];
      };
      const team = report.findings.find((f) => f.subject === "team_size");
      expect(team?.expected).toBe("13");
      const value = team!.values.find((v) => v.docKind === "form")!;
      expect(value.ref).toBe("leadership_roles/i1");
      const fix = await call(
        "consistency",
        "POST",
        {},
        {
          body: { action: "use_expected", findingId: team!.id, docId: value.docId, ref: value.ref },
        },
      );
      expect(fix.status).toBe(200);
      const fixed = await loadFormView(userId, form.id);
      expect(fixed.section.items[0]!.userText).toContain("13");
      expect(fixed.kitConsistency.filter((f) => f.subject === "team_size")).toEqual([]);

      // The Résumé Pass: keeping a rewrite needs its answer; the export is a Word file.
      const resume = (await (await call("resume/review", "GET", {})).json()) as {
        state: string;
        reviewId: string;
      };
      expect(resume.state).toBe("ready");
      const bullet = { id: resume.reviewId, bulletId: "b1" };
      const unanswered = await call("resume/review/[id]/bullets/[bulletId]", "PATCH", bullet, {
        body: { decision: { status: "accepted", answers: [] } },
      });
      expect(unanswered.status).toBe(422);
      const kept = await call("resume/review/[id]/bullets/[bulletId]", "PATCH", bullet, {
        body: { decision: { status: "accepted", answers: ["six"] } },
      });
      expect(kept.status).toBe(200);
      const docx = await call("resume/export", "POST", {}, { body: {} });
      expect(docx.status).toBe(200);
      const bytes = new Uint8Array(await docx.arrayBuffer());
      expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe("PK");
    },
  );

  it(
    "answers 404 (or 403) to another applicant on every Phase 5 route",
    { timeout: 180_000 },
    async () => {
      const owner = await builtKit();
      const review = (await latestResumeReview(handle.db, owner.userId))!;
      caller.userId = await factory.create();
      const cases: [string, string, Record<string, string>, { body?: unknown; query?: string }][] =
        [
          [
            "kits/[id]/forms",
            "GET",
            { id: owner.kit.id },
            { query: `?deliverable=${owner.form.id}` },
          ],
          ["kits/[id]/forms/refresh", "POST", { id: owner.kit.id }, {}],
          [
            "kits/[id]/forms/items/[itemId]",
            "PATCH",
            { id: owner.kit.id, itemId: "i1" },
            { body: { section: "leadership_roles", text: "Mine now." } },
          ],
          [
            "resume/review/[id]",
            "PATCH",
            { id: review.id },
            { body: { useSuggestedOrder: false } },
          ],
          [
            "resume/review/[id]/bullets/[bulletId]",
            "PATCH",
            { id: review.id, bulletId: "b1" },
            { body: { decision: { status: "rejected" } } },
          ],
          ["consistency", "GET", {}, { query: `?kitId=${owner.kit.id}` }],
        ];
      for (const [route, method, params, init] of cases) {
        const response = await call(route, method, params, init);
        // A stranger without a kit meets the Résumé Pass's paywall (402) before any lookup.
        expect([402, 403, 404], `${method} /api/${route}`).toContain(response.status);
      }
      // The stranger's own consistency report holds nothing of the owner's.
      const theirs = (await (await call("consistency", "GET", {})).json()) as {
        compared: unknown[];
      };
      expect(theirs.compared).toEqual([]);
      expect((await getFormAdvice(handle.db, owner.userId, owner.kit.id))?.edits).toEqual({});
    },
  );

  it("a refund closes the form view", { timeout: 180_000 }, async () => {
    const buyer = await builtKit();
    const refund = buildSignedFakeWebhook({
      type: "refund_completed",
      transactionId: buyer.transactionId,
      adjustmentId: `adj_${randomUUID().replace(/-/g, "").slice(0, 26)}`,
      amountCents: 10_000,
      currency: "USD",
    });
    await processWebhook(refund.body, refund.headers);
    caller.userId = buyer.userId;
    await expect(loadFormView(buyer.userId, buyer.form.id)).rejects.toMatchObject({ status: 403 });
    const response = await call(
      "kits/[id]/forms",
      "GET",
      { id: buyer.kit.id },
      {
        query: `?deliverable=${buyer.form.id}`,
      },
    );
    expect(response.status).toBe(403);
  });
});
