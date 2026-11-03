/**
 * Records the util.title replay fixture for UTIL_TITLE_SAMPLE.
 *
 *   pnpm --filter @admitstory/ai record:util-title              # live: needs AI_MODE=live + ANTHROPIC_API_KEY
 *   pnpm --filter @admitstory/ai record:util-title --synthetic  # hand-authored response, no network
 *
 * Both paths go through ai.run(), so the fixture is keyed by exactly the request the app sends.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAI, createMemoryLedger, MODEL_IDS } from "../src";
import { repoRoot } from "../src/paths";
import { requestHash } from "../src/replay";
import { UTIL_TITLE_SAMPLE, UTIL_TITLE_SYNTHETIC_TITLE } from "./util-title-sample";

const SYNTHETIC_NOTE =
  "Hand-authored response (no API key was available when Phase 0 was built). Re-record live with " +
  "AI_MODE=live and ANTHROPIC_API_KEY set: pnpm --filter @admitstory/ai record:util-title";

/** A plausible claude-haiku-5-5 Messages response for the given request body. */
function syntheticResponse(body: string): Response {
  const request = JSON.parse(body) as { model: string };
  const message = {
    id: `msg_synthetic_${requestHash(request).slice(0, 24)}`,
    type: "message",
    role: "assistant",
    model: request.model,
    content: [{ type: "text", text: JSON.stringify({ title: UTIL_TITLE_SYNTHETIC_TITLE }) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: {
      // Roughly 4 characters per token over the serialized request; the prompt is below the
      // 512-token cache minimum, so nothing is read from or written to the cache.
      input_tokens: Math.round(body.length / 4),
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
      output_tokens: 11,
      server_tool_use: null,
      service_tier: "standard",
    },
  };
  return new Response(JSON.stringify(message), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function loadLocalEnv(): void {
  const path = join(repoRoot(), ".env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}

async function main(): Promise<void> {
  const synthetic = process.argv.includes("--synthetic");
  const ledger = createMemoryLedger();

  let ai;
  if (synthetic) {
    ai = createAI({
      mode: "live",
      apiKey: "synthetic-no-network",
      ledger,
      record: true,
      recordOptions: { synthetic: true, note: SYNTHETIC_NOTE },
      fetch: async (_input, init) => syntheticResponse(String(init?.body)),
    });
  } else {
    loadLocalEnv();
    if (process.env.AI_MODE !== "live" || !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "Live recording needs AI_MODE=live and ANTHROPIC_API_KEY (or pass --synthetic).",
      );
    }
    ai = createAI({
      mode: "live",
      apiKey: process.env.ANTHROPIC_API_KEY,
      ledger,
      record: true,
      recordOptions: { synthetic: false, note: "Recorded live." },
    });
  }

  const output = await ai.run("util.title", { text: UTIL_TITLE_SAMPLE });
  const entry = ledger.entries[0];
  console.log(`util.title → "${output.title}"`);
  if (entry) {
    console.log(
      `model ${entry.servedModel} (${entry.servedModel === MODEL_IDS.haiku ? "haiku" : "other"}), ` +
        `${entry.inputTokens} in / ${entry.outputTokens} out, $${entry.costUsd.toFixed(6)}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
