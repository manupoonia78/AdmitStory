import { describe, expect, it } from "vitest";
import {
  EMBED_BATCH_SIZE,
  EmbedConfigError,
  VOYAGE_EMBEDDINGS_URL,
  createFakeEmbedder,
  createVoyageEmbedder,
  embedderFromEnv,
  fakeEmbedding,
} from "../src/embed";
import { UpstreamError } from "../src/errors";
import { createMemoryLedger } from "../src/ledger";
import { EMBEDDING_PRICES_USD_PER_MTOK, computeEmbeddingCost } from "../src/pricing";
import { EMBED_ROUTE, EMBEDDING_MODEL_IDS } from "../src/routing";
import { createAI } from "../src/run";
import { stubFetch } from "./helpers";

const LOCAL = { appUrl: "http://localhost:3000" };
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);

function voyageResponse(texts: string[], tokens = 7): Response {
  return new Response(
    JSON.stringify({
      object: "list",
      // Out of order on purpose: results are placed by index.
      data: texts
        .map((text, index) => ({ object: "embedding", index, embedding: fakeEmbedding(text) }))
        .reverse(),
      model: EMBEDDING_MODEL_IDS.voyageLite,
      usage: { total_tokens: tokens },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("the fake embedder", () => {
  it("is deterministic, 1024-dimensional and unit length", async () => {
    const fake = createFakeEmbedder(LOCAL);
    const first = await fake.embed(["Round 2 deadline", ""], "document");
    const again = await fake.embed(["Round 2 deadline", ""], "query");
    expect(first.vectors).toEqual(again.vectors);
    for (const vector of first.vectors) {
      expect(vector).toHaveLength(EMBED_ROUTE.dimensions);
      expect(Math.hypot(...vector)).toBeCloseTo(1, 10);
    }
  });

  it("ranks texts that share words above texts that do not", () => {
    const query = fakeEmbedding("when is the round 2 deadline");
    const near = fakeEmbedding("The Round 2 deadline is 13 January.");
    const far = fakeEmbedding("Students row in the harbour regatta every autumn.");
    expect(dot(query, near)).toBeGreaterThan(dot(query, far));
  });

  it("refuses to run off localhost", () => {
    expect(() => createFakeEmbedder({ appUrl: "https://admitstory.example" })).toThrow(
      EmbedConfigError,
    );
    expect(() => createFakeEmbedder({ appUrl: undefined })).toThrow(EmbedConfigError);
    expect(() => createFakeEmbedder({ appUrl: "http://127.0.0.1:3000" })).not.toThrow();
  });

  it("is chosen only without a Voyage key, and only on first use", () => {
    const pick = embedderFromEnv({ APP_URL: "https://admitstory.example" });
    expect(() => pick()).toThrow(EmbedConfigError);
    expect(embedderFromEnv({ VOYAGE_API_KEY: "pa-test" })().model).toBe("voyage-3.5-lite");
    expect(embedderFromEnv({ APP_URL: "http://localhost:3000" })().fake).toBe(true);
  });
});

describe("the Voyage adapter", () => {
  it("posts the model, input type and 1024 dimensions, and orders results by index", async () => {
    const fetch = stubFetch((request) =>
      voyageResponse((request.body as unknown as { input: string[] }).input, 11),
    );
    const voyage = createVoyageEmbedder({ apiKey: "pa-test", fetch });
    const result = await voyage.embed(["a", "b"], "query");
    expect(fetch.calls[0]!.url).toBe(VOYAGE_EMBEDDINGS_URL);
    expect(fetch.calls[0]!.headers.get("authorization")).toBe("Bearer pa-test");
    expect(fetch.calls[0]!.body).toEqual({
      input: ["a", "b"],
      model: "voyage-3.5-lite",
      input_type: "query",
      output_dimension: 1024,
    });
    expect(result).toEqual({ vectors: [fakeEmbedding("a"), fakeEmbedding("b")], tokens: 11 });
  });

  it("retries rate limits and server errors, rejects a missing vector, and gives up with an UpstreamError", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    let calls = 0;
    const flaky = stubFetch((request) =>
      ++calls < 3
        ? new Response("busy", { status: 429 })
        : voyageResponse((request.body as unknown as { input: string[] }).input),
    );
    await createVoyageEmbedder({ apiKey: "k", fetch: flaky, sleep }).embed(["a"], "document");
    expect(waits).toEqual([500, 1000]);

    const down = stubFetch(() => new Response("down", { status: 503 }));
    const error = await createVoyageEmbedder({ apiKey: "k", fetch: down, sleep, maxRetries: 1 })
      .embed(["a"], "document")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 503, retryable: true, task: "kb.embed" });

    const short = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            data: [{ index: 1, embedding: fakeEmbedding("b") }],
            usage: { total_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      createVoyageEmbedder({ apiKey: "k", fetch: short, sleep }).embed(["a", "b"], "document"),
    ).rejects.toBeInstanceOf(UpstreamError);

    const bad = stubFetch(() => new Response("no", { status: 401 }));
    await expect(
      createVoyageEmbedder({ apiKey: "k", fetch: bad, sleep }).embed(["a"], "document"),
    ).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
    expect(bad.calls).toHaveLength(1);
  });
});

describe("ai.embed()", () => {
  it("meters each provider request as kb.embed in the ledger", async () => {
    const ledger = createMemoryLedger();
    const fetch = stubFetch((request) =>
      voyageResponse((request.body as unknown as { input: string[] }).input, 1_000),
    );
    const ai = createAI({
      mode: "live",
      apiKey: "test",
      ledger,
      embedder: createVoyageEmbedder({ apiKey: "pa-test", fetch }),
    });
    const texts = Array.from({ length: EMBED_BATCH_SIZE + 3 }, (_, i) => `chunk ${i}`);
    const vectors = await ai.embed(texts, {
      userId: "u1",
      schoolPackId: "p1",
      inputType: "document",
    });

    expect(vectors).toHaveLength(texts.length);
    expect(vectors[EMBED_BATCH_SIZE + 2]).toEqual(fakeEmbedding(`chunk ${EMBED_BATCH_SIZE + 2}`));
    expect(
      fetch.calls.map((call) => (call.body as unknown as { input: string[] }).input.length),
    ).toEqual([EMBED_BATCH_SIZE, 3]);
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries[0]).toMatchObject({
      task: "kb.embed",
      model: "voyage-3.5-lite",
      servedModel: "voyage-3.5-lite",
      aiMode: "live",
      userId: "u1",
      schoolPackId: "p1",
      inputTokens: 1_000,
      outputTokens: 0,
      promptVersion: "kb.embed:document",
      costUsd: computeEmbeddingCost("voyage-3.5-lite", 1_000),
    });
    expect(ledger.entries[0]!.runId).toBe(ledger.entries[1]!.runId);
    expect(ledger.entries[0]!.costUsd).toBeCloseTo(
      (1_000 * EMBEDDING_PRICES_USD_PER_MTOK["voyage-3.5-lite"]!) / 1e6,
      12,
    );
  });

  it("records the fake as free and as replay, and returns nothing for no texts", async () => {
    const ledger = createMemoryLedger();
    const ai = createAI({ mode: "replay", ledger, embedder: () => createFakeEmbedder(LOCAL) });
    expect(await ai.embed([])).toEqual([]);
    const [vector] = await ai.embed(["deadline"], { inputType: "query" });
    expect(vector).toEqual(fakeEmbedding("deadline"));
    expect(ledger.entries).toMatchObject([
      { model: "fake-hash-embed", aiMode: "replay", costUsd: 0, promptVersion: "kb.embed:query" },
    ]);
  });

  it("throws when no embedder is configured", async () => {
    const ai = createAI({ mode: "replay", ledger: createMemoryLedger() });
    await expect(ai.embed(["x"])).rejects.toThrow("No embedder configured");
  });
});
