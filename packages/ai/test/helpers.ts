import { MODEL_IDS } from "../src/routing";

export interface CapturedRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown> & { model: string; messages: { role: string; content: unknown }[] };
}

export interface StubFetch {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
  calls: CapturedRequest[];
}

type Responder = (request: CapturedRequest, index: number) => Response | Promise<Response>;

/** A fetch stub that records every request and answers with `respond`. Never touches the network. */
export function stubFetch(respond: Responder): StubFetch {
  const calls: CapturedRequest[] = [];
  const fn = (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const request: CapturedRequest = {
      url,
      headers: new Headers(init?.headers),
      // GET requests (batch status and results) have no body.
      body: (init?.body === undefined
        ? {}
        : JSON.parse(String(init.body))) as CapturedRequest["body"],
    };
    calls.push(request);
    return respond(request, calls.length - 1);
  }) as StubFetch;
  fn.calls = calls;
  return fn;
}

export interface MessageOptions {
  text?: string;
  model?: string;
  stopReason?: string;
  stopDetails?: Record<string, unknown> | null;
  usage?: Record<string, unknown>;
}

export const DEFAULT_USAGE = {
  input_tokens: 400,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
  output_tokens: 12,
  server_tool_use: null,
  service_tier: "standard",
};

export function messageBody(options: MessageOptions = {}): Record<string, unknown> {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: options.model ?? MODEL_IDS.haiku,
    content: [
      {
        type: "text",
        text: options.text ?? JSON.stringify({ title: "Fixing the lab results feed" }),
      },
    ],
    stop_reason: options.stopReason ?? "end_turn",
    stop_sequence: null,
    stop_details: options.stopDetails ?? null,
    usage: { ...DEFAULT_USAGE, ...options.usage },
  };
}

export function messageResponse(options: MessageOptions = {}): Response {
  return new Response(JSON.stringify(messageBody(options)), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(status: number, type: string): Response {
  return new Response(
    JSON.stringify({ type: "error", error: { type, message: `stub ${status}` } }),
    {
      status,
      // Keeps SDK backoff to 1 ms in tests.
      headers: { "content-type": "application/json", "retry-after-ms": "1" },
    },
  );
}

/** A text/event-stream body for a single text block. */
export function sseResponse(options: MessageOptions = {}): Response {
  const body = messageBody(options);
  const usage = body.usage as typeof DEFAULT_USAGE;
  const text = (body.content as { text: string }[])[0]?.text ?? "";
  const events: [string, unknown][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: { ...body, content: [], stop_reason: null, usage: { ...usage, output_tokens: 1 } },
      },
    ],
    [
      "content_block_start",
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ],
    [
      "content_block_delta",
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    ],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: body.stop_reason, stop_sequence: null, stop_details: null },
        usage: { output_tokens: usage.output_tokens },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ];
  const sse = events
    .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
  return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
}
