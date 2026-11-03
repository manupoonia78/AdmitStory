import { OPENAI_COMPAT_TTS, clampSpeed } from "../config";
import type { TTSProvider, TtsVoice } from "../contract";
import { estimateWordTimings } from "./fake";
import { splitForTts, wholeSamples } from "./pcm";

// Any server that speaks OpenAI's speech API (POST {baseUrl}/v1/audio/speech), so a self-hosted
// open model can read questions aloud at no per-character cost. Built for Kokoro-82M through
// Kokoro-FastAPI, which streams 24 kHz 16-bit mono PCM for `response_format: "pcm"` (verify on
// the server you deploy). No word timings: estimated ones are sent first.

type Fetch = typeof fetch;

export interface OpenAiCompatTtsOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  model: string;
  voices: Record<TtsVoice, string>;
  fetch?: Fetch;
}

export function createOpenAiCompatTts({
  baseUrl,
  apiKey,
  model,
  voices,
  fetch: doFetch = fetch,
}: OpenAiCompatTtsOptions): TTSProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/audio/speech`;
  return {
    name: "openai_compat",
    async *synthesize({ text, voice, speed }, signal) {
      const pieces = splitForTts(text, OPENAI_COMPAT_TTS.maxChars);
      const rate = clampSpeed(speed, OPENAI_COMPAT_TTS.speedRange);
      yield { words: estimateWordTimings(pieces.join(" "), { speed: rate }) };
      for (const piece of pieces) {
        const response = await doFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            input: piece,
            voice: voices[voice],
            response_format: "pcm",
            speed: rate,
            stream: true,
          }),
          signal: signal ?? null,
        });
        if (!response.ok || !response.body)
          throw new Error(`Speech server failed (${response.status}).`);
        for await (const pcm of wholeSamples(response.body)) yield { pcm };
      }
    },
  };
}
