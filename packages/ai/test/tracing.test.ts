import { describe, expect, it } from "vitest";
import { createMemoryLedger } from "../src/ledger";
import { createAI } from "../src/run";
import { NOOP_TRACER, createTracer, redact, type TracingConfig } from "../src/tracing";
import { UTIL_TITLE_SAMPLE } from "../scripts/util-title-sample";
import { messageResponse, stubFetch } from "./helpers";

interface ExportedSpan {
  name: string;
  attributes: Record<string, unknown>;
  spanContext(): { traceId: string };
}

// Langfuse uses one module-level provider and the first configuration wins, so every client in
// this file shares one exporter.
const exported: ExportedSpan[] = [];
const TRACING: TracingConfig = {
  publicKey: "pk-test",
  secretKey: "sk-test",
  host: "http://127.0.0.1:9",
  exporter: {
    export(spans: ExportedSpan[], done: (result: { code: number }) => void) {
      exported.push(...spans);
      done({ code: 0 });
    },
    shutdown: async () => {},
    forceFlush: async () => {},
  } as never,
};

describe("tracing", () => {
  it("is a no-op without Langfuse keys", () => {
    expect(createTracer(undefined)).toBe(NOOP_TRACER);
    expect(createTracer({ publicKey: "pk" })).toBe(NOOP_TRACER);
    expect(NOOP_TRACER.startRun({} as never).traceId).toBeNull();
  });

  it("masks redacted fields at any depth", () => {
    const fields = new Set(["email", "sensitive"]);
    expect(
      redact(
        { text: "a", email: "x@example.test", nested: [{ sensitive: { story: "s" }, keep: 1 }] },
        fields,
      ),
    ).toEqual({
      text: "a",
      email: "[redacted]",
      nested: [{ sensitive: "[redacted]", keep: 1 }],
    });
  });
});

describe("Langfuse generations", () => {
  it("emits one generation per attempt with our usage and cost, and writes the trace id to the ledger", async () => {
    exported.length = 0;
    const ledger = createMemoryLedger();
    const ai = createAI({ mode: "replay", ledger, tracing: TRACING, contentLogging: false });
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    await ai.flush();

    const generation = exported.find((s) => s.name === "util.title primary");
    expect(generation).toBeDefined();
    const attrs = generation!.attributes;
    expect(attrs["langfuse.observation.type"]).toBe("generation");
    expect(attrs["langfuse.observation.model.name"]).toBe(ledger.entries[0]!.servedModel);
    expect(JSON.parse(String(attrs["langfuse.observation.cost_details"]))).toMatchObject({
      total: ledger.entries[0]!.costUsd,
    });
    expect(JSON.parse(String(attrs["langfuse.observation.usage_details"]))).toMatchObject({
      input: ledger.entries[0]!.inputTokens,
    });
    // Content logging off: no input/output leaves the process.
    expect(attrs["langfuse.observation.input"]).toBeUndefined();
    expect(attrs["langfuse.observation.output"]).toBeUndefined();
    expect(ledger.entries[0]!.traceId).toBe(generation!.spanContext().traceId);
  });

  it("logs the model output as parsed JSON so redacted fields are masked", async () => {
    exported.length = 0;
    const reply = JSON.stringify({
      title: "Fixing the lab results feed",
      email: "applicant@example.test",
    });
    const fetch = stubFetch(() => messageResponse({ text: reply }));
    const ai = createAI({
      mode: "live",
      apiKey: "test-key",
      ledger: createMemoryLedger(),
      fetch,
      tracing: TRACING,
      contentLogging: true,
    });
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    await ai.flush();

    const generation = exported.find((s) => s.name === "util.title primary");
    const output = String(generation!.attributes["langfuse.observation.output"]);
    expect(output).not.toContain("applicant@example.test");
    expect(JSON.parse(output)).toEqual({
      title: "Fixing the lab results feed",
      email: "[redacted]",
    });
  });

  it("logs a reply that is not JSON as the raw string", async () => {
    exported.length = 0;
    const fetch = stubFetch((_req, i) =>
      messageResponse({ text: i === 0 ? "Not JSON at all" : '{"title":"Fixed"}' }),
    );
    const ai = createAI({
      mode: "live",
      apiKey: "test-key",
      ledger: createMemoryLedger(),
      fetch,
      tracing: TRACING,
      contentLogging: true,
    });
    await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
    await ai.flush();
    const primary = exported.find((s) => s.name === "util.title primary");
    expect(primary!.attributes["langfuse.observation.output"]).toBe("Not JSON at all");
  });
});
