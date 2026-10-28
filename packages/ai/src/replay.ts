import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ReplayMissingError } from "./errors";
import { defaultReplayDir, replayDirIn, rootAtImport } from "./paths";

/**
 * AI_MODE=replay serves recorded responses keyed by a hash of the request body, so CI is
 * deterministic and never touches the network (spec §15). Recording happens in live mode.
 */
/**
 * `<repo>/fixtures/llm-replays`, from the repo root found at import time (see paths.ts). Prefer
 * passing a dir; the fetch factories resolve the root when called.
 */
export const REPLAY_DIR: string = replayDirIn(rootAtImport());

/** Private headers that carry fixture metadata to the fetch wrapper. Stripped before any request. */
export const TASK_HEADER = "x-admitstory-task";
export const PROMPT_VERSION_HEADER = "x-admitstory-prompt-version";

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const ReplayFixture = z.object({
  meta: z.object({
    task: z.string(),
    promptVersion: z.string(),
    model: z.string(),
    recordedAt: z.string(),
    synthetic: z.boolean(),
    note: z.string(),
  }),
  request: z.unknown(),
  response: z.object({
    status: z.number().int(),
    headers: z.object({ "content-type": z.string() }),
    body: z.string(),
  }),
});
export type ReplayFixture = z.infer<typeof ReplayFixture>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** Sorted-key JSON, so property order never changes a hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** sha256 of the canonical request body. Headers (auth, beta flags, private headers) never count. */
export function requestHash(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export function fixturePath(dir: string, task: string, hash: string): string {
  return join(dir, task, `${hash}.json`);
}

function readBody(init: RequestInit | undefined): unknown {
  const body = init?.body;
  if (typeof body !== "string")
    throw new Error("Replay/record supports JSON string request bodies only");
  return JSON.parse(body);
}

function takePrivateHeaders(init: RequestInit | undefined): {
  task: string;
  promptVersion: string;
  headers: Headers;
} {
  const headers = new Headers(init?.headers);
  const task = headers.get(TASK_HEADER) ?? "unknown";
  const promptVersion = headers.get(PROMPT_VERSION_HEADER) ?? "unknown";
  headers.delete(TASK_HEADER);
  headers.delete(PROMPT_VERSION_HEADER);
  return { task, promptVersion, headers };
}

function urlOf(input: string | URL | Request): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

/** Only Messages API calls are replayed; anything else in replay mode is a bug. */
function isMessagesCall(input: string | URL | Request): boolean {
  return new URL(urlOf(input)).pathname.endsWith("/v1/messages");
}

export function readFixture(path: string): ReplayFixture {
  return ReplayFixture.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function writeFixture(path: string, fixture: ReplayFixture): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
}

/**
 * Replay: answers from fixtures; never calls the network. The default dir is resolved from the
 * repo root found from process.cwd() (throws if there is none).
 */
export function createReplayFetch(dir: string = defaultReplayDir()): Fetch {
  return async (input, init) => {
    if (!isMessagesCall(input))
      throw new Error(`Replay mode refuses non-Messages request to ${urlOf(input)}`);
    const { task } = takePrivateHeaders(init);
    const hash = requestHash(readBody(init));
    const path = fixturePath(dir, task, hash);
    if (!existsSync(path)) throw new ReplayMissingError(task, hash, path);
    const { response } = readFixture(path);
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
}

export interface RecordOptions {
  /** Defaults to `<repo>/fixtures/llm-replays`, resolved when createLiveFetch is called. */
  dir?: string;
  /** Marks hand-authored fixtures; they must be re-recorded live before they count as evidence. */
  synthetic?: boolean;
  note?: string;
}

/**
 * Live pass-through that strips the private headers and, when `record` is set, writes successful
 * Messages responses as fixtures. Streaming responses are buffered while recording.
 */
export function createLiveFetch(base: Fetch, record?: RecordOptions): Fetch {
  const recordDir = record ? (record.dir ?? defaultReplayDir()) : undefined;
  return async (input, init) => {
    const { task, promptVersion, headers } = takePrivateHeaders(init);
    const response = await base(input, { ...init, headers });
    if (!record || recordDir === undefined || !isMessagesCall(input) || !response.ok)
      return response;

    const request = readBody(init);
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";
    const model =
      typeof request === "object" && request !== null && "model" in request
        ? String(request.model)
        : "unknown";
    writeFixture(fixturePath(recordDir, task, requestHash(request)), {
      meta: {
        task,
        promptVersion,
        model,
        recordedAt: new Date().toISOString(),
        synthetic: record.synthetic ?? false,
        note: record.note ?? "",
      },
      request,
      response: { status: response.status, headers: { "content-type": contentType }, body: text },
    });
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}
