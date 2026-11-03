import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { batchRequestHash, customIdFor } from "../src/batch";
import { ReplayMissingError } from "../src/errors";
import { createMemoryLedger, tokenUsageFromApi } from "../src/ledger";
import { BATCH_DISCOUNT, computeCost } from "../src/pricing";
import { fixturePath, readFixture, REPLAY_DIR } from "../src/replay";
import { MODEL_IDS } from "../src/routing";
import { createAI } from "../src/run";
import {
  KB_NORMALIZE_OFFICIAL_INPUT,
  KB_NORMALIZE_THIRD_PARTY_INPUT,
  KB_REFRESH_CHECK_INPUT,
} from "../scripts/samples/phase3";
import { messageBody, stubFetch } from "./helpers";

describe("ai.batch in replay mode", () => {
  it("serves each item from the ai.run() fixture and meters it at the batch discount", async () => {
    const ledger = createMemoryLedger();
    const ai = createAI({ mode: "replay", ledger });
    const submission = await ai.batch.submit("kb.normalize", [KB_NORMALIZE_OFFICIAL_INPUT], {
      userId: "admin-1",
    });

    expect(submission).toMatchObject({
      task: "kb.normalize",
      promptVersion: "kb.normalize@v1",
      model: MODEL_IDS.sonnet,
      aiMode: "replay",
      userId: "admin-1",
      items: [{ customId: "item-0" }],
    });
    expect(submission.batchId).toMatch(/^replaybatch_[0-9a-f]{24}$/);
    expect(JSON.parse(JSON.stringify(submission))).toEqual(submission);

    const result = await ai.batch.collect(submission, { inputs: [KB_NORMALIZE_OFFICIAL_INPUT] });
    expect(result.status).toBe("ended");
    if (result.status !== "ended") return;
    const sync = await createAI({ mode: "replay", ledger: createMemoryLedger() }).run(
      "kb.normalize",
      KB_NORMALIZE_OFFICIAL_INPUT,
    );
    expect(result.results).toEqual([{ index: 0, customId: "item-0", ok: true, output: sync }]);

    const fixture = readFixture(
      fixturePath(REPLAY_DIR, "kb.normalize", submission.items[0]!.requestHash),
    );
    const usage = tokenUsageFromApi(JSON.parse(fixture.response.body).usage);
    const full = computeCost({ modelId: MODEL_IDS.sonnet, usage });
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      task: "kb.normalize",
      attemptKind: "primary",
      userId: "admin-1",
      ...usage,
    });
    expect(ledger.entries[0]!.costUsd).toBeCloseTo(full * BATCH_DISCOUNT, 12);
  });

  it("runs the task's rules when the inputs come back, with no repair", async () => {
    const ai = createAI({ mode: "replay", ledger: createMemoryLedger() });
    // The recorded first reply to the third-party sample copies the source (its repair is a
    // second fixture that a batch never reaches).
    const submission = await ai.batch.submit("kb.normalize", [
      KB_NORMALIZE_OFFICIAL_INPUT,
      KB_NORMALIZE_THIRD_PARTY_INPUT,
    ]);
    const checked = await ai.batch.collect(submission, {
      inputs: [KB_NORMALIZE_OFFICIAL_INPUT, KB_NORMALIZE_THIRD_PARTY_INPUT],
    });
    if (checked.status !== "ended") throw new Error("replayed batches end at once");
    expect(checked.results.map((r) => r.ok)).toEqual([true, false]);
    const failed = checked.results[1]!;
    if (failed.ok) throw new Error("expected a failure");
    expect(failed.error.kind).toBe("invalid_output");
    expect(failed.error.issues?.map((i) => i.path)).toContain("proposals.0.rewritten_in_own_words");

    // Without the inputs only the schema can be checked, and the copy passes it.
    const unchecked = await ai.batch.collect(submission);
    if (unchecked.status !== "ended") throw new Error("replayed batches end at once");
    expect(unchecked.results.map((r) => r.ok)).toEqual([true, true]);
  });

  it("refuses a missing fixture at submit, and a route that is not a batch route", async () => {
    const empty = createAI({
      mode: "replay",
      ledger: createMemoryLedger(),
      replayDir: mkdtempSync(join(tmpdir(), "empty-")),
    });
    await expect(
      empty.batch.submit("kb.refresh_check", [KB_REFRESH_CHECK_INPUT]),
    ).rejects.toBeInstanceOf(ReplayMissingError);
    const ai = createAI({ mode: "replay", ledger: createMemoryLedger() });
    await expect(ai.batch.submit("util.title", [{ text: "A passage." }])).rejects.toThrow(
      "not a batch route",
    );
    await expect(ai.batch.submit("kb.normalize", [])).rejects.toThrow("at least one input");
  });
});

describe("ai.batch in live mode", () => {
  const reply = { changed: false, summary: "Navigation only.", affected_fields: [] };

  function liveBatch(status: "in_progress" | "ended") {
    const fetch = stubFetch((request) => {
      const path = new URL(request.url).pathname;
      if (path === "/v1/messages/batches")
        return Response.json({
          id: "msgbatch_1",
          type: "message_batch",
          processing_status: "in_progress",
        });
      if (path === "/v1/messages/batches/msgbatch_1")
        return Response.json({
          id: "msgbatch_1",
          type: "message_batch",
          processing_status: status,
          request_counts: {
            processing: status === "ended" ? 0 : 2,
            succeeded: status === "ended" ? 2 : 0,
            errored: 0,
            canceled: 0,
            expired: 0,
          },
          results_url: "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results",
        });
      if (path === "/v1/messages/batches/msgbatch_1/results") {
        const lines = [
          {
            custom_id: customIdFor(1),
            result: {
              type: "errored",
              error: { type: "error", error: { type: "overloaded_error", message: "busy" } },
            },
          },
          {
            custom_id: customIdFor(0),
            result: {
              type: "succeeded",
              message: messageBody({ text: JSON.stringify(reply), model: MODEL_IDS.haiku }),
            },
          },
        ];
        return new Response(lines.map((line) => JSON.stringify(line)).join("\n"), {
          headers: { "content-type": "application/binary" },
        });
      }
      throw new Error(`unexpected ${request.url}`);
    });
    const ledger = createMemoryLedger();
    return { ai: createAI({ mode: "live", apiKey: "test", ledger, fetch }), fetch, ledger };
  }

  it("submits ai.run()'s requests as batch params, without the server-side fallback", async () => {
    const { ai, fetch } = liveBatch("in_progress");
    const submission = await ai.batch.submit("kb.refresh_check", [
      KB_REFRESH_CHECK_INPUT,
      KB_REFRESH_CHECK_INPUT,
    ]);
    expect(submission.batchId).toBe("msgbatch_1");
    const body = fetch.calls[0]!.body as unknown as {
      requests: { custom_id: string; params: Record<string, unknown> }[];
    };
    expect(body.requests.map((r) => r.custom_id)).toEqual(["item-0", "item-1"]);
    const params = body.requests[0]!.params;
    expect(params).not.toHaveProperty("fallbacks");
    expect(params).not.toHaveProperty("stream");
    expect(params).toMatchObject({
      model: MODEL_IDS.haiku,
      tools: [{ allowed_domains: ["www.halvorsen.example"] }],
    });
    expect(submission.items[0]!.requestHash).toBe(batchRequestHash(params as never));

    const pending = await ai.batch.collect(submission);
    expect(pending).toEqual({ status: "in_progress", counts: { processing: 2, done: 0 } });
  });

  it("collects results in input order whatever order they arrive in", async () => {
    const { ai, ledger } = liveBatch("ended");
    const submission = await ai.batch.submit("kb.refresh_check", [
      KB_REFRESH_CHECK_INPUT,
      KB_REFRESH_CHECK_INPUT,
    ]);
    const result = await ai.batch.collect(submission, {
      inputs: [KB_REFRESH_CHECK_INPUT, KB_REFRESH_CHECK_INPUT],
    });
    expect(result).toEqual({
      status: "ended",
      results: [
        { index: 0, customId: "item-0", ok: true, output: reply },
        {
          index: 1,
          customId: "item-1",
          ok: false,
          error: { kind: "errored", message: "The batch request errored" },
        },
      ],
    });
    // Only the billed result is in the ledger.
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      task: "kb.refresh_check",
      aiMode: "live",
      model: MODEL_IDS.haiku,
    });
  });
});
