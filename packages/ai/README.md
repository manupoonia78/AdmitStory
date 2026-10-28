# @admitstory/ai

Every model call in the product goes through `ai.run(task, input, ctx)` (spec §8.4). The wrapper routes the task to a model, lays out the cached prompt prefix, checks the budget, validates input and output with Zod, meters every attempt into the usage ledger, and traces it in Langfuse. Feature code never imports `@anthropic-ai/sdk`, and ESLint enforces that.

## Calling a task

```ts
import { createAIFromEnv } from "@admitstory/ai";
import { ledger } from "@admitstory/db"; // any LedgerSink

const ai = createAIFromEnv(ledger);

const { title } = await ai.run(
  "util.title",
  { text: passage },
  { userId, kitId, signal, contentLoggingAllowed: user.improveProductOptIn },
);
await ai.flush(); // in serverless handlers, before returning
```

## Where the data is read from

Prompt templates, canon and replay fixtures are read from disk at runtime:

| Data             | Default                          | Config       |
| ---------------- | -------------------------------- | ------------ |
| Prompt templates | `<root>/packages/ai/src/prompts` | `promptsDir` |
| Canon            | `<root>/knowledge/canon`         | `canonDir`   |
| Replay fixtures  | `<root>/fixtures/llm-replays`    | `replayDir`  |

`<root>` is `rootDir` when given. Otherwise it is found at runtime by walking up from `process.cwd()` to the directory containing `pnpm-workspace.yaml`, or, in a traced deployment that has no workspace file, `packages/ai/src/prompts`. So vitest, tsx and `next start` all work from any directory inside the repo. Outside it, pass `rootDir` or explicit dirs. Both `createAI(config)` and `createAIFromEnv(ledger, env, { rootDir, promptsDir, canonDir, replayDir })` accept them, and `createAI` throws a clear error when it needs the root and cannot find one. The root is looked up only for the dirs a client actually uses.

Nothing is resolved with `new URL(<dir>, import.meta.url)`. Turbopack and webpack treat that as an asset import, and a directory cannot be imported, so `apps/web` would fail to build. A unit test fails if any runtime file in `src/` uses `import.meta`. Deployments must still trace the data files into the server bundle, which `apps/web/next.config.ts` does (`outputFileTracingIncludes`).

`REPLAY_DIR` and `CANON_DIR` are still exported. They are resolved once, at import, from `process.cwd()`, and fall back to `process.cwd()` itself so that importing the package never throws.

`run` only accepts registered task names. Input and output types come from each task's Zod schemas. `run` throws these typed errors, and none of their messages contain model output:

| Error                   | When                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `InputValidationError`  | The input failed the task's schema. No API call is made.                                                                     |
| `BudgetExceededError`   | The kit hard cap ($25) or the free-user cap ($5) is reached. No API call is made.                                            |
| `AIRefusalError`        | `stop_reason: "refusal"`. Has `category`. Live Opus/Sonnet routes already went through the API's server-side fallback first. |
| `OutputTruncatedError`  | `max_tokens` (or context window) was hit before the output finished.                                                         |
| `OutputValidationError` | The output failed its schema twice: once originally and once after a repair attempt.                                         |
| `UpstreamError`         | The API failed after SDK retries and the route's fallback, or the call was aborted (`aborted: true`).                        |
| `ReplayMissingError`    | `AI_MODE=replay` found no fixture. The message names the hash and the expected path.                                         |
| `UnknownTaskError`      | The task is not registered.                                                                                                  |

## What one call does

1. **Route.** `routing.ts` resolves the route, applying any admin override (`RouteOverride`, which names models by key only). It also picks the prompt version: the highest `prompts/<agent>/v<N>.md` unless an override pins one.
2. **Budget** (`budget.ts`). Past the kit soft cap ($15), routes that have a `downgrade` (kit.draft → Sonnet high, interview.report → Sonnet) are downgraded. Past the free-user cap, Studio continues with the Haiku interviewer and every other task is blocked. Phase 0 treats every user as free, because entitlements arrive in Phase 4.
3. **Request** (`request.ts`). The system blocks are `[agent prompt][canon subset]` with a 1h breakpoint, then `[school pack]` with a 1h breakpoint, then `[dossier]` with a 5m breakpoint. Empty layers are left out. Nothing dynamic goes in `system`. Uploaded or pasted text is wrapped with `untrustedBlock()` (spec §14.6).
4. **Structured output.** `output_config.format` gets the JSON Schema from the task's Zod schema, and `output_config.effort` gets the route's effort. Thinking is set per model: adaptive → `{type:"adaptive"}`; off → `{type:"disabled"}` on Haiku and `{type:"between_tools"}` on Sonnet. Opus thinking is never off. Sampling parameters are never sent.
5. **Call.** The SDK retries 3 times with backoff (`LIVE_MAX_RETRIES`). Spec §8.3 says "retry with backoff (3 tries)", which we read as three retries after the first request, so a model that keeps failing gets 4 requests in total. After that, the route's fallback model is used, but only for 429, 5xx/overloaded and connection errors. Live Opus/Sonnet routes go through the beta path with `fallbacks: "default"`. Requests with `max_tokens` above 21,000, or with `ctx.stream`, use the streaming transport.
6. **Validate.** The stop reason is checked first. On a validation failure, one repair turn is sent: the model's output plus the Zod issues, ending on a user turn. If the first reply was empty or whitespace, it is not sent back as an assistant turn, because the API rejects empty assistant content. Instead the instruction is appended to the final user turn.
7. **Ledger.** One `UsageEntry` is written per billed attempt (`primary`, `repair`, `fallback`). Each entry records the served model, the 5m/1h cache-write split, the cost from `pricing.ts`, latency, `promptVersion` (`util.title@v1`), `runId` and `traceId`. When the API's server-side fallback served the turn, each `usage.iterations` hop is billed at its own model's rates. A hop with no `model` is billed at the requested model if it is a `message` hop, and at the served model if it is a `fallback_message` hop.
8. **Trace.** One Langfuse generation is created per attempt (see Tracing).

## AI_MODE

- `replay` (the default, used in CI): responses come from `fixtures/llm-replays/<task>/<sha256>.json`. The hash is sha256 of the canonical (sorted-key) request body. Headers never count. The client uses a dummy key and never reaches the network.
- `live`: real API calls. Requires `ANTHROPIC_API_KEY`.

Any change to a prompt, schema, route or request layout changes the hash, so the matching fixture has to be re-recorded.

## Recording replays

`createAI({ mode: "live", record: true, ... })` writes every successful Messages response as a fixture. The fixture holds `meta` (task, prompt version, model, time, `synthetic`, note), the request and the response. Streaming responses are stored as SSE text.

To record `util.title`:

```sh
AI_MODE=live ANTHROPIC_API_KEY=... pnpm --filter @admitstory/ai record:util-title
pnpm --filter @admitstory/ai record:util-title --synthetic   # hand-authored response, no network
```

The script reads `.env.local` when live. It sends the request through `ai.run()`, so the fixture is keyed by exactly the request the app sends.

> The util.title fixture in the repo is **synthetic** (`meta.synthetic: true`). It was written before an API key was available. Re-record it live before Phase 1.

## Tracing

Tracing is on when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are both set, and it is a no-op otherwise. Langfuse runs on its own `NodeTracerProvider`, never registered globally, because Sentry owns the global one. `LANGFUSE_HOST` is passed as `baseUrl`. The SDK's own OpenTelemetry spans are turned off.

Each generation carries model, effort, max tokens, usage, and `costDetails` from our own prices. Input and output are sent only when `contentLogging` is on and `ctx.contentLoggingAllowed !== false`. `createAIFromEnv` enables `contentLogging` outside production only. Fields named in the redaction list are masked in all cases. A generation's output is the parsed JSON when the model's reply parses, so redaction applies to it. It is the raw string only when the reply is not JSON.

## Layout

Section 17's layout: `run.ts` (`ai.run`), `routing.ts`, `pricing.ts`, `prompts/<agent>/v<N>.md`, `schemas/` (each task's input and output Zod schemas, for example `schemas/util-title.ts`), `providers/` (`providers/anthropic.ts` builds the only Anthropic client and wires the replay or live transport), and `tasks/` (pairs schemas with a prompt agent and a message builder). `paths.ts` resolves the data dirs.

## Adding a task

Spec §17 conventions apply. Add all of the following before the task is used:

1. The route in `routing.ts`.
2. A price for its model in `pricing.ts`.
3. `src/prompts/<agent>/v1.md`, whose front matter lists `agent`, `version`, `canon` (canon file slugs and/or rule IDs), `output` and `notes`.
4. Input and output schemas in `src/schemas/<task>.ts`, and a `defineTask(...)` entry in `src/tasks` that uses them.
5. A replay fixture.
6. Coverage in the eval suite.

Output schemas must not contain fields named `reasoning` or `thinking`.
