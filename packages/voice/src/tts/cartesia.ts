import { CARTESIA, clampSpeed, providerVoiceId } from "../config";
import { TTS_SAMPLE_RATE, type TTSProvider, type TtsChunk } from "../contract";
import { readLines } from "./stream";

// Cartesia streaming TTS over server-sent events (POST /tts/sse). Checked against Cartesia's API
// reference on 31 October 2026 (verify again before launch):
//  - headers `Authorization: Bearer <key>` and `Cartesia-Version`;
//  - body { model_id, transcript, voice, output_format: { container: "raw", encoding: "pcm_s16le",
//    sample_rate }, language, add_timestamps, generation_config: { speed } };
//  - events `chunk` (base64 audio in `data`), `timestamps` (`word_timestamps` with parallel
//    `words`/`start`/`end` arrays, in seconds), `done`, and `error` (`message`, `status_code`).

type Fetch = typeof fetch;

interface CartesiaEvent {
  type?: string;
  data?: string;
  word_timestamps?: { words?: string[]; start?: number[]; end?: number[] };
  message?: string;
  status_code?: number;
}

/** SSE `data:` payloads, one per event; multi-line data is joined as the SSE spec says. */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let data: string[] = [];
  for await (const line of readLines(body)) {
    if (line === "") {
      if (data.length > 0) yield data.join("\n");
      data = [];
    } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length > 0) yield data.join("\n");
}

export function toCartesiaChunk(event: CartesiaEvent): TtsChunk | null {
  if (event.type === "chunk" && typeof event.data === "string")
    return { pcm: new Uint8Array(Buffer.from(event.data, "base64")) };
  if (event.type === "timestamps" && event.word_timestamps) {
    const { words = [], start = [], end = [] } = event.word_timestamps;
    return {
      words: words.map((word, index) => ({
        word,
        startMs: Math.round((start[index] ?? 0) * 1000),
        endMs: Math.round((end[index] ?? start[index] ?? 0) * 1000),
      })),
    };
  }
  return null;
}

export function createCartesiaTts({
  apiKey,
  fetch: doFetch = fetch,
}: {
  apiKey: string;
  fetch?: Fetch;
}): TTSProvider {
  return {
    name: "cartesia",
    async *synthesize({ text, voice, speed }, signal) {
      const response = await doFetch(CARTESIA.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Cartesia-Version": CARTESIA.version,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: CARTESIA.model,
          transcript: text,
          voice: { id: providerVoiceId("cartesia", voice) },
          output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: TTS_SAMPLE_RATE },
          language: "en",
          add_timestamps: true,
          generation_config: { speed: clampSpeed(speed, CARTESIA.speedRange) },
        }),
        signal: signal ?? null,
      });
      if (!response.ok || !response.body)
        throw new Error(`Cartesia TTS failed (${response.status}).`);

      for await (const payload of sseEvents(response.body)) {
        let event: CartesiaEvent;
        try {
          event = JSON.parse(payload) as CartesiaEvent;
        } catch {
          continue;
        }
        if (event.type === "error")
          throw new Error(
            `Cartesia TTS error (${event.status_code ?? "?"}): ${event.message ?? ""}`,
          );
        if (event.type === "done") return;
        const chunk = toCartesiaChunk(event);
        if (chunk) yield chunk;
      }
    },
  };
}
