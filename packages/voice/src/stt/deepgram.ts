import { DEEPGRAM } from "../config";
import {
  DICTATION_SAMPLE_RATE,
  STT_TOKEN_TTL_SECONDS,
  type STTProvider,
  type SttMintInput,
  type SttTokenResponse,
} from "../contract";

// Deepgram streaming dictation (spec §7.5). The browser connects straight to Deepgram with a
// temporary token minted here, so audio never passes through our servers and the master key never
// leaves them.
//
// Checked against Deepgram's docs (31 October 2026, verify again before launch):
//  - POST /v1/auth/grant with `Authorization: Token <key>` and `{ ttl_seconds }` returns
//    `{ access_token, expires_in }`. The key needs Member permissions. The token only has to be
//    valid for the handshake; the socket stays open after it expires.
//  - A browser cannot set headers on a WebSocket, so the JWT goes in the subprotocol pair
//    `["bearer", jwt]` (`["token", key]` is for API keys only).
//  - keyterm is repeated once per term; utterance_end_ms needs interim_results and ≥ 1,000 ms.

type Fetch = typeof fetch;

/** The query string for one dictation connection. Shared by the fake so both behave alike. */
export function listenQuery(input: Omit<SttMintInput, "userId">): URLSearchParams {
  const multi = input.language === "multi";
  const params = new URLSearchParams({
    model: DEEPGRAM.model,
    encoding: "linear16",
    sample_rate: String(DICTATION_SAMPLE_RATE),
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
    vad_events: "true",
    utterance_end_ms: String(
      Math.max(DEEPGRAM.minUtteranceEndMs, Math.round(input.utteranceEndMs)),
    ),
    endpointing: String(multi ? DEEPGRAM.endpointingMs.multi : DEEPGRAM.endpointingMs.monolingual),
    language: input.language,
  });
  for (const term of input.keyterms) params.append("keyterm", term);
  return params;
}

const GrantResponse = (body: unknown): { token: string; expiresIn: number } => {
  const record = body as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof record?.access_token !== "string" || record.access_token === "")
    throw new Error("Deepgram's token grant returned no access_token.");
  const expiresIn =
    typeof record.expires_in === "number" && record.expires_in > 0
      ? record.expires_in
      : STT_TOKEN_TTL_SECONDS;
  return { token: record.access_token, expiresIn };
};

export interface DeepgramOptions {
  apiKey: string;
  fetch?: Fetch;
  now?: () => number;
}

export function createDeepgramStt({
  apiKey,
  fetch: doFetch = fetch,
  now = Date.now,
}: DeepgramOptions): STTProvider {
  return {
    name: "deepgram",
    async mint(input): Promise<Omit<SttTokenResponse, "remainingSeconds">> {
      const response = await doFetch(DEEPGRAM.grantUrl, {
        method: "POST",
        headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl_seconds: STT_TOKEN_TTL_SECONDS }),
        signal: AbortSignal.timeout(5_000),
      });
      // Never echo the response body: on an auth failure it can describe the key.
      if (!response.ok) throw new Error(`Deepgram's token grant failed (${response.status}).`);
      const { token, expiresIn } = GrantResponse(await response.json());
      return {
        url: `${DEEPGRAM.listenUrl}?${listenQuery(input).toString()}`,
        protocols: ["bearer", token],
        expiresAt: new Date(now() + expiresIn * 1000).toISOString(),
        provider: "deepgram",
      };
    },
  };
}
