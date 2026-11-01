/* eslint-disable @typescript-eslint/no-explicit-any -- the fake model reads loosely typed task inputs */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_IDS, ROUTES, computeCost } from "@admitstory/ai";
import { getTask } from "../../../packages/ai/src/tasks";
import {
  addUserSchool,
  createGoldenLines,
  createStories,
  createUsageLedgerSink,
  recordCheckout,
  schoolCycles,
  schoolPacks,
  schools,
  upsertFacts,
  type DbHandle,
} from "@admitstory/db";
import { compilePack } from "@admitstory/kb";
import { buildSignedFakeWebhook, schoolKitProductKey } from "@admitstory/payments";
import type { createUserFactory } from "../../../packages/db/test/support/db";
import type { KitAI } from "@/lib/kit/pipeline";

// Shared by the kit acceptance tests (Phases 4 and 5): a FICTIONAL school with a published pack,
// an applicant with a small Dossier who has bought its kit, and a fake model that validates every
// input and output with the task's own Zod schemas (as ai.run() does) and prices each call from
// its token counts, so the ledger is realistic. A test adds replies for its own tasks via `reply`.

export interface KitEnv {
  handle: DbHandle;
  factory: ReturnType<typeof createUserFactory>;
  /** Schools created, for the test's cleanup. */
  schoolIds: string[];
  /** Replies for tasks the shared fake doesn't know; undefined falls through to it. */
  reply?: (task: string, input: Record<string, any>) => unknown;
}

export const PACK = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures/schools/kestrel-lake/pack.json"), "utf8"),
);

export const LINES = [
  "It was two in the morning and the feed was dropping messages.",
  "I called the vendor's engineer and asked him to widen the window.",
  "Twelve kids come every Saturday now.",
];

export function kitSupport(env: KitEnv) {
  /* Fixtures -------------------------------------------------------------------------------------- */

  async function fictionalSchool() {
    const tag = randomUUID().slice(0, 8);
    const [school] = await env.handle.db
      .insert(schools)
      .values({
        slug: `fictional-kestrel-${tag}`,
        name: `Kestrel Lake ${tag}`,
        shortName: "Kestrel Lake",
        region: "us",
      })
      .returning();
    env.schoolIds.push(school!.id);
    const [cycle] = await env.handle.db
      .insert(schoolCycles)
      .values({ schoolId: school!.id, cycle: PACK.cycle, status: "live" })
      .returning();
    const compiled = compilePack(PACK, { cycle: PACK.cycle, now: new Date("2026-10-01") });
    await env.handle.db.insert(schoolPacks).values({
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

  async function applicantWithDossier() {
    const userId = await env.factory.create();
    const [s1, s2] = await createStories(env.handle.db, userId, [
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
    await createGoldenLines(env.handle.db, userId, [
      { storyId: s1!.id, text: LINES[0]! },
      { storyId: s1!.id, text: LINES[1]! },
      { storyId: s2!.id, text: LINES[2]! },
    ]);
    await upsertFacts(env.handle.db, userId, [
      { key: "employer_current", value: "Meridian Health Systems", status: "confirmed" },
      { key: "team_size", value: "13", status: "confirmed" },
    ]);
    return userId;
  }

  async function paidKit() {
    const userId = await applicantWithDossier();
    const { cycle, compiled } = await fictionalSchool();
    const us = await addUserSchool(env.handle.db, userId, { schoolCycleId: cycle.id });
    const txn = `txn_${randomUUID().replace(/-/g, "").slice(0, 26)}`;
    await recordCheckout(env.handle.db, userId, {
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
    return {
      userId,
      cycleId: cycle.id,
      userSchoolId: us.id,
      webhook,
      compiled,
      transactionId: txn,
    };
  }

  /* The fake model -------------------------------------------------------------------------------- */

  const s = (text: string, kind: "verbatim" | "adapted" | "composed", sources: string[]) => ({
    text,
    kind,
    sources,
  });

  function reply(task: string, input: Record<string, any>): unknown {
    const extra = env.reply?.(task, input);
    if (extra !== undefined) return extra;
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
    const ledger = createUsageLedgerSink(env.handle.db);
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

  return { fictionalSchool, applicantWithDossier, paidKit, fakeAI };
}
