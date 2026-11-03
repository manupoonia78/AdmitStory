import { STT_TOKEN_TTL_SECONDS, type STTProvider } from "../contract";
import { listenQuery } from "./deepgram";

// The development STT provider, chosen when DEEPGRAM_API_KEY is missing. It points the browser at
// the local fake Deepgram server (packages/voice/src/testing/fake-deepgram.ts) with exactly the
// query string the real one would get, so the client code path is the same.

export function createFakeStt({
  url,
  now = Date.now,
}: {
  url: string;
  now?: () => number;
}): STTProvider {
  return {
    name: "fake",
    async mint(input) {
      return {
        url: `${url}?${listenQuery(input).toString()}`,
        protocols: ["token", "fake"],
        expiresAt: new Date(now() + STT_TOKEN_TTL_SECONDS * 1000).toISOString(),
        provider: "fake",
      };
    },
  };
}
