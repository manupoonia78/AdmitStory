import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIRefusalError,
  BudgetExceededError,
  InputValidationError,
  OutputTruncatedError,
  OutputValidationError,
  ReplayMissingError,
  UnknownTaskError,
  UpstreamError,
} from "../src/errors";
import { createMemoryLedger, tokenUsageFromApi, type UsageEntry } from "../src/ledger";
import { computeCost } from "../src/pricing";
import { REPLAY_DIR, TASK_HEADER, readFixture } from "../src/replay";
import { MODEL_IDS } from "../src/routing";
import { LIVE_MAX_RETRIES, createAI, createAIFromEnv, type AIConfig } from "../src/run";
import { UTIL_TITLE_SAMPLE } from "../scripts/util-title-sample";
import { errorResponse, messageResponse, sseResponse, stubFetch, type StubFetch } from "./helpers";

const VALID = JSON.stringify({ title: "Fixing the lab results feed" });

function liveAI(fetch: StubFetch, extra: Partial<Omit<AIConfig, "ledger">> = {}) {
  const ledger = createMemoryLedger();
  const ai = createAI({ mode: "live", apiKey: "test-key", ledger, fetch, ...extra });
  return { ai, ledger };
}

describe("Phase 0 acceptance: util.title in replay mode", () => {
  it("returns a valid title and writes one ledger entry matching the fixture", async () => {
    const ledger = createMemoryLedger();
    const ai = createAI({ mode: "replay", ledger });

    const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });

    expect(output.title.length).toBeGreaterThan(0);
    expect(output.title.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(ledger.entries).toHaveLength(1);

    const dir = join(REPLAY_DIR, "util.title");
    const fixture = readdirSync(dir)
      .map((name) => readFixture(join(dir, name)))
      .find((f) =>
        JSON.stringify(f.request).includes(JSON.stringify(UTIL_TITLE_SAMPLE).slice(1, -1)),
      );
    expect(fixture, "fixture for UTIL_TITLE_SAMPLE").toBeDefined();
    const response = JSON.parse(fixture!.response.body) as {
      usage: Parameters<typeof tokenUsageFromApi>[0];
    };
    const usage = tokenUsageFromApi(response.usage);

    const entry = ledger.entries[0]!;
    expect(entry).toMatchObject<Partial<UsageEntry>>({
      task: "util.title",
      model: MODEL_IDS.haiku,
      servedModel: MODEL_IDS.haiku,
      effort: "low",
      attemptKind: "primary",
      aiMode: "replay",
      promptVersion: "util.title@v1",
      stopReason: "end_turn",
      traceId: null,
      userId: null,
      ...usage,
    });
    expect(entry.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.costUsd).toBe(computeCost({ modelId: fixture!.meta.model, usage }));
    expect(entry.costUsd).toBeGreaterThan(0);
  });

  it("throws ReplayMissingError naming the hash when no fixture matches", async () => {
    const ai = createAI({
      mode: "replay",
      ledger: createMemoryLedger(),
      replayDir: mkdtempSync(join(tmpdir(), "empty-")),
    });
    const error = await ai
      .run("util.title", { text: "A passage nobody recorded." })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReplayMissingError);
    expect((error as ReplayMissingError).hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ai.run with a stubbed API", () => {
  it("sends the private task header only to the fetch wrapper, never upstream", async () => {
    const fetch = stubFetch(() => messageResponse({ text: VALID }));
    const { ai } = liveAI(fetch);
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    expect(fetch.calls[0]!.headers.has(TASK_HEADER)).toBe(false);
    expect(fetch.calls[0]!.body).toMatchObject({
      model: MODEL_IDS.haiku,
      thinking: { type: "disabled" },
      stream: false,
    });
    expect(fetch.calls[0]!.body).not.toHaveProperty("fallbacks");
  });

  it("validates input before any API call", async () => {
    const fetch = stubFetch(() => messageResponse());
    const { ai } = liveAI(fetch);
    await expect(ai.run("util.title", { text: "   " })).rejects.toBeInstanceOf(
      InputValidationError,
    );
    await expect(ai.run("nope" as "util.title", { text: "x" })).rejects.toBeInstanceOf(
      UnknownTaskError,
    );
    expect(fetch.calls).toHaveLength(0);
  });

  it("refusal → AIRefusalError with the category, still metered", async () => {
    const fetch = stubFetch(() =>
      messageResponse({
        text: "",
        stopReason: "refusal",
        stopDetails: { type: "refusal", category: "cyber", explanation: null },
      }),
    );
    const { ai, ledger } = liveAI(fetch);
    const error = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AIRefusalError);
    expect((error as AIRefusalError).category).toBe("cyber");
    expect(ledger.entries.map((e) => e.stopReason)).toEqual(["refusal"]);
  });

  it("max_tokens → OutputTruncatedError without a repair attempt", async () => {
    const fetch = stubFetch(() =>
      messageResponse({ text: '{"title": "Fix', stopReason: "max_tokens" }),
    );
    const { ai, ledger } = liveAI(fetch);
    await expect(ai.run("util.title", { text: UTIL_TITLE_SAMPLE })).rejects.toBeInstanceOf(
      OutputTruncatedError,
    );
    expect(fetch.calls).toHaveLength(1);
    expect(ledger.entries).toHaveLength(1);
  });

  it("invalid JSON, then valid on repair → success with primary + repair entries", async () => {
    const fetch = stubFetch((_req, i) =>
      messageResponse({ text: i === 0 ? "Fixing the lab results feed" : VALID }),
    );
    const { ai, ledger } = liveAI(fetch);
    const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });

    expect(output).toEqual({ title: "Fixing the lab results feed" });
    expect(ledger.entries.map((e) => e.attemptKind)).toEqual(["primary", "repair"]);
    expect(new Set(ledger.entries.map((e) => e.runId)).size).toBe(1);

    const repair = fetch.calls[1]!.body.messages;
    expect(repair.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(repair[1]!.content).toBe("Fixing the lab results feed");
    expect(String(repair[2]!.content)).toMatch(/not valid JSON/);
    expect(fetch.calls[1]!.body.system).toEqual(fetch.calls[0]!.body.system);
  });

  it("empty first reply → repair sent as one final user turn, no empty assistant turn", async () => {
    const fetch = stubFetch((_req, i) => messageResponse({ text: i === 0 ? "  \n" : VALID }));
    const { ai, ledger } = liveAI(fetch);
    const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });

    expect(output).toEqual({ title: "Fixing the lab results feed" });
    expect(ledger.entries.map((e) => e.attemptKind)).toEqual(["primary", "repair"]);
    const first = fetch.calls[0]!.body.messages;
    const repair = fetch.calls[1]!.body.messages;
    expect(repair.map((m) => m.role)).toEqual(["user"]);
    const content = String(repair[0]!.content);
    expect(content.startsWith(String(first[0]!.content))).toBe(true);
    expect(content).toMatch(/previous reply was empty/);
    expect(content).toMatch(/not valid JSON/);
  });

  it("schema failure twice → OutputValidationError without model text in the message", async () => {
    const tooLong = JSON.stringify({ title: "One two three four five six seven eight" });
    const fetch = stubFetch(() => messageResponse({ text: tooLong }));
    const { ai, ledger } = liveAI(fetch);
    const error = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutputValidationError);
    expect((error as Error).message).not.toContain("seven eight");
    expect((error as OutputValidationError).issues[0]).toMatchObject({ path: "title" });
    expect(ledger.entries).toHaveLength(2);
  });

  it("529 after SDK retries → route fallback model, recorded as attemptKind fallback", async () => {
    const fetch = stubFetch((req) =>
      req.body.model === MODEL_IDS.haiku
        ? errorResponse(529, "overloaded_error")
        : messageResponse({ text: VALID, model: MODEL_IDS.sonnet }),
    );
    const { ai, ledger } = liveAI(fetch, {
      routeOverrides: async () => ({
        "util.title": { fallback: { model: "sonnet", effort: "low", thinking: "off" } },
      }),
    });
    const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });

    expect(output.title).toBe("Fixing the lab results feed");
    // LIVE_MAX_RETRIES = 3 retries (spec §8.3 "3 tries" read as three retries): 4 requests to the
    // primary, then the fallback.
    expect(LIVE_MAX_RETRIES).toBe(3);
    expect(fetch.calls.map((c) => c.body.model)).toEqual([
      ...Array(4).fill(MODEL_IDS.haiku),
      MODEL_IDS.sonnet,
    ]);
    expect(fetch.calls[4]!.body).toMatchObject({
      thinking: { type: "between_tools" },
      fallbacks: "default",
    });
    expect(fetch.calls[4]!.headers.get("anthropic-beta")).toContain(
      "server-side-fallback-2026-07-01",
    );
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      attemptKind: "fallback",
      model: MODEL_IDS.sonnet,
      servedModel: MODEL_IDS.sonnet,
    });
  });

  it("400 → UpstreamError, no retries and no fallback", async () => {
    const fetch = stubFetch(() => errorResponse(400, "invalid_request_error"));
    const { ai, ledger } = liveAI(fetch, {
      routeOverrides: async () => ({
        "util.title": { fallback: { model: "sonnet", effort: "low", thinking: "off" } },
      }),
    });
    const error = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(400);
    expect(fetch.calls).toHaveLength(1);
    expect(ledger.entries).toHaveLength(0);
  });

  it("records the server-side fallback's served model and prices each hop", async () => {
    const fetch = stubFetch(() =>
      messageResponse({
        text: VALID,
        model: MODEL_IDS.sonnet5,
        usage: {
          input_tokens: 1_000,
          output_tokens: 100,
          iterations: [
            {
              type: "message",
              model: MODEL_IDS.sonnet,
              input_tokens: 500,
              output_tokens: 0,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_creation: null,
            },
            {
              type: "fallback_message",
              model: MODEL_IDS.sonnet5,
              input_tokens: 500,
              output_tokens: 100,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_creation: null,
            },
          ],
        },
      }),
    );
    const { ai, ledger } = liveAI(fetch, {
      routeOverrides: async () => ({ "util.title": { model: "sonnet" } }),
    });
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    const entry = ledger.entries[0]!;
    expect(entry).toMatchObject({ model: MODEL_IDS.sonnet, servedModel: MODEL_IDS.sonnet5 });
    expect(entry.costUsd).toBeCloseTo((500 * 2 + 500 * 2 + 100 * 10) / 1_000_000, 12);
  });

  it("prices an unnamed primary hop at the requested model, the fallback hop at the served one", async () => {
    const hop = {
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
    };
    const fetch = stubFetch(() =>
      messageResponse({
        text: VALID,
        model: MODEL_IDS.opus5,
        usage: {
          input_tokens: 2_000,
          output_tokens: 100,
          iterations: [
            { type: "message", model: null, input_tokens: 1_000, output_tokens: 0, ...hop },
            { type: "fallback_message", input_tokens: 1_000, output_tokens: 100, ...hop },
          ],
        },
      }),
    );
    const { ai, ledger } = liveAI(fetch, {
      routeOverrides: async () => ({ "util.title": { model: "opus", thinking: "adaptive" } }),
    });
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    const entry = ledger.entries[0]!;
    expect(entry).toMatchObject({ model: MODEL_IDS.opus, servedModel: MODEL_IDS.opus5 });
    const zero = {
      cacheReadTokens: 0,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0,
      webSearches: 0,
    };
    const expected =
      computeCost({
        modelId: MODEL_IDS.opus,
        usage: { ...zero, inputTokens: 1_000, outputTokens: 0 },
      }) +
      computeCost({
        modelId: MODEL_IDS.opus5,
        usage: { ...zero, inputTokens: 1_000, outputTokens: 100 },
      });
    expect(entry.costUsd).toBeCloseTo(expected, 12);
    // Opus 5.5 and Opus 5 input rates differ, so pricing the first hop as served would not match.
    expect(entry.costUsd).not.toBeCloseTo(
      computeCost({
        modelId: MODEL_IDS.opus5,
        usage: { ...zero, inputTokens: 2_000, outputTokens: 100 },
      }),
      12,
    );
  });

  it("uses the streaming transport when asked and still validates the final message", async () => {
    const fetch = stubFetch(() => sseResponse({ text: VALID }));
    const { ai, ledger } = liveAI(fetch);
    const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE }, { stream: true });
    expect(output.title).toBe("Fixing the lab results feed");
    expect(fetch.calls[0]!.body.stream).toBe(true);
    expect(ledger.entries[0]).toMatchObject({ outputTokens: 12, inputTokens: 400 });
  });

  it("budget hard cap → BudgetExceededError without any API call", async () => {
    const fetch = stubFetch(() => messageResponse());
    const seeded = createMemoryLedger([
      {
        runId: "00000000-0000-4000-8000-000000000000",
        userId: "user-1",
        kitId: "kit-1",
        schoolPackId: null,
        task: "kit.draft",
        model: MODEL_IDS.opus,
        servedModel: MODEL_IDS.opus,
        effort: "medium",
        attemptKind: "primary",
        aiMode: "live",
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        outputTokens: 0,
        webSearches: 0,
        costUsd: 25,
        latencyMs: 1,
        promptVersion: "kit.draft@v1",
        traceId: null,
        stopReason: "end_turn",
      },
    ]);
    const ai = createAI({ mode: "live", apiKey: "test-key", ledger: seeded, fetch });
    const error = await ai
      .run("util.title", { text: UTIL_TITLE_SAMPLE }, { kitId: "kit-1" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BudgetExceededError);
    expect((error as BudgetExceededError).scope).toBe("kit");
    await expect(
      ai.run("util.title", { text: UTIL_TITLE_SAMPLE }, { userId: "user-1" }),
    ).rejects.toMatchObject({ scope: "user" });
    expect(fetch.calls).toHaveLength(0);
  });

  it("passes the abort signal through and maps aborts to UpstreamError", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = stubFetch(() => messageResponse());
    const { ai } = liveAI(fetch);
    const error = await ai
      .run("util.title", { text: UTIL_TITLE_SAMPLE }, { signal: controller.signal })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).aborted).toBe(true);
  });
});

describe("createAIFromEnv", () => {
  it("defaults to replay and serves the recorded fixture", async () => {
    const ledger = createMemoryLedger();
    const ai = createAIFromEnv(ledger, { NODE_ENV: "test" });
    await expect(ai.run("util.title", { text: UTIL_TITLE_SAMPLE })).resolves.toHaveProperty(
      "title",
    );
    expect(ledger.entries[0]!.aiMode).toBe("replay");
  });

  it("rejects an unknown AI_MODE and live mode without a key", () => {
    expect(() => createAIFromEnv(createMemoryLedger(), { AI_MODE: "record" })).toThrow(/AI_MODE/);
    expect(() => createAIFromEnv(createMemoryLedger(), { AI_MODE: "live" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
