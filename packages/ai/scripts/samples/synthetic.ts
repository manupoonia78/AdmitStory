import { requestHash } from "../../src/replay";

// Shared by the synthetic recorders (record-phase3.ts, record-phase4.ts).

/** A plausible Messages response for the request: the reply as text, rough token counts. */
export function syntheticResponse(body: string, replies: readonly unknown[]): Response {
  const request = JSON.parse(body) as { model: string; messages: unknown[] };
  // A repair conversation is the original turn, the reply, and the issues: three turns.
  const reply = replies[Math.min(request.messages.length > 1 ? 1 : 0, replies.length - 1)];
  const text = JSON.stringify(reply);
  const message = {
    id: `msg_synthetic_${requestHash(request).slice(0, 24)}`,
    type: "message",
    role: "assistant",
    model: request.model,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: {
      // About 4 characters a token over the serialized request; nothing cached on a first call.
      input_tokens: Math.round(body.length / 4),
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
      output_tokens: Math.ceil(text.length / 4),
      server_tool_use: null,
      service_tier: "standard",
    },
  };
  return new Response(JSON.stringify(message), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
