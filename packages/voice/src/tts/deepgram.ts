import { DEEPGRAM_TTS, providerVoiceId } from "../config";
import { TTS_SAMPLE_RATE, type TTSProvider } from "../contract";
import { estimateWordTimings } from "./fake";
import { splitForTts, wholeSamples } from "./pcm";

// Deepgram Aura-2 text to speech (POST /v1/speak), the launch default: the same key as dictation.
// Checked against Deepgram's docs on 3 November 2026 (verify again before launch):
//  - `Authorization: Token <key>`, JSON body `{ text }`, query `model`, `encoding=linear16`,
//    `sample_rate`, `container=none` for raw 16-bit PCM streamed as it is generated;
//  - at most DEEPGRAM_TTS.maxChars characters a request, so longer text is split at sentence ends
//    and requested in order;
//  - no word timings, so the adapter sends estimated ones (the karaoke highlight is approximate).

type Fetch = typeof fetch;

export function deepgramSpeakUrl(model: string): string {
  const params = new URLSearchParams({
    model,
    encoding: "linear16",
    sample_rate: String(TTS_SAMPLE_RATE),
    container: "none",
  });
  return `${DEEPGRAM_TTS.url}?${params.toString()}`;
}

export function createDeepgramTts({
  apiKey,
  fetch: doFetch = fetch,
}: {
  apiKey: string;
  fetch?: Fetch;
}): TTSProvider {
  return {
    name: "deepgram",
    async *synthesize({ text, voice }, signal) {
      const pieces = splitForTts(text, DEEPGRAM_TTS.maxChars);
      // Aura-2 has no speed control we rely on (verify), so timings assume normal speed.
      yield { words: estimateWordTimings(pieces.join(" ")) };
      const url = deepgramSpeakUrl(providerVoiceId("deepgram", voice));
      for (const piece of pieces) {
        const response = await doFetch(url, {
          method: "POST",
          headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: piece }),
          signal: signal ?? null,
        });
        if (!response.ok || !response.body)
          throw new Error(`Deepgram TTS failed (${response.status}).`);
        for await (const pcm of wholeSamples(response.body)) yield { pcm };
      }
    },
  };
}
