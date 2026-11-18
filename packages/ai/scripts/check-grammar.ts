// Sends every task's output schema to the live API once, exactly as ai.run() would, and reports any
// the API refuses. The API compiles output_config.format into a decoding grammar with a size cap;
// a schema over it fails every call with HTTP 400 "The compiled grammar is too large", which no
// replay test can see (fixtures never reach the API). On 2026-11-18 this was found in production:
// studio.extract, import.parse and kit.positioning_filemap had been refused on every call.
//
//   ANTHROPIC_API_KEY=... pnpm --filter @admitstory/ai check:grammar
//
// Costs a few output tokens per task (max_tokens 8 on Haiku). Run it after changing any output
// schema. The grammar compiles before generation, so the model the task really uses doesn't matter.

import Anthropic from "@anthropic-ai/sdk";
import { MODEL_IDS } from "../src/routing";
import { outputJsonSchema } from "../src/request";
import { TASKS } from "../src/tasks";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is required: this check talks to the live API.");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const results = await Promise.all(
  Object.entries(TASKS).map(async ([name, task]) => {
    const schema = outputJsonSchema(task.output, task.schemaRefs);
    try {
      await client.messages.create({
        model: MODEL_IDS.haiku,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with anything." }],
        thinking: { type: "disabled" },
        output_config: { format: { type: "json_schema", schema } },
      });
      return { name, ok: true, message: "" };
    } catch (error) {
      const message = error instanceof Anthropic.APIError ? error.message : String(error);
      return { name, ok: false, message };
    }
  }),
);

for (const result of results)
  console.log(
    `${result.ok ? "ok  " : "FAIL"} ${result.name}${result.ok ? "" : `  ${result.message}`}`,
  );

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} task schema(s) refused by the API.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} task schemas accepted.`);
