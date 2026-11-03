import { ELEVENLABS, clampSpeed, providerVoiceId } from "../config";
import { TTS_SAMPLE_RATE, type TTSProvider, type TtsChunk } from "../contract";
import { readLines } from "./stream";

// ElevenLabs streaming TTS with timestamps (POST /v1/text-to-speech/{voice_id}/stream/with-timestamps).
// Checked against ElevenLabs' API reference on 31 October 2026 (verify again before launch):
//  - header `xi-api-key`; query `output_format=pcm_24000` (raw 16-bit PCM);
//  - body { text, model_id, voice_settings: { speed } };
//  - the response is a stream of JSON objects, one per line, each with `audio_base64` and an
//    `alignment` of `characters` with `character_start_times_seconds` / `..._end_times_seconds`.
//
// ElevenLabs aligns characters, not words, so words are assembled here. Whether a chunk's times
// count from the start of the audio or from the start of that chunk has varied between versions;
// a chunk whose times start before the audio already received is treated as chunk-relative.

type Fetch = typeof fetch;

interface Alignment {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

interface ElevenLabsLine {
  audio_base64?: string | null;
  alignment?: Alignment | null;
  normalized_alignment?: Alignment | null;
}

type Word = { word: string; startMs: number; endMs: number };

/** Assembles words from character alignment across chunks; a word may span two chunks. */
export function createWordAssembler() {
  let current: Word | null = null;
  let lastEndMs = 0;

  return {
    /** `audioMsBefore`: how much audio preceded this chunk, for chunk-relative timings. */
    push(alignment: Alignment, audioMsBefore: number): Word[] {
      const chars = alignment.characters ?? [];
      const starts = alignment.character_start_times_seconds ?? [];
      const ends = alignment.character_end_times_seconds ?? [];
      if (chars.length === 0) return [];
      const firstMs = (starts[0] ?? 0) * 1000;
      const offset = audioMsBefore > 0 && firstMs + 50 < lastEndMs ? audioMsBefore : 0;
      const done: Word[] = [];
      chars.forEach((char, index) => {
        const startMs = Math.round((starts[index] ?? 0) * 1000 + offset);
        const endMs = Math.round((ends[index] ?? starts[index] ?? 0) * 1000 + offset);
        lastEndMs = Math.max(lastEndMs, endMs);
        if (/\s/.test(char)) {
          if (current) done.push(current);
          current = null;
        } else if (current) {
          current.word += char;
          current.endMs = endMs;
        } else current = { word: char, startMs, endMs };
      });
      return done;
    },
    flush(): Word[] {
      const last = current;
      current = null;
      return last ? [last] : [];
    },
  };
}

export function createElevenLabsTts({
  apiKey,
  fetch: doFetch = fetch,
}: {
  apiKey: string;
  fetch?: Fetch;
}): TTSProvider {
  return {
    name: "elevenlabs",
    async *synthesize({ text, voice, speed }, signal) {
      const url = `${ELEVENLABS.url(providerVoiceId("elevenlabs", voice))}?output_format=pcm_${TTS_SAMPLE_RATE}`;
      const response = await doFetch(url, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS.model,
          voice_settings: { speed: clampSpeed(speed, ELEVENLABS.speedRange) },
        }),
        signal: signal ?? null,
      });
      if (!response.ok || !response.body)
        throw new Error(`ElevenLabs TTS failed (${response.status}).`);

      const words = createWordAssembler();
      let audioBytes = 0;
      for await (const raw of readLines(response.body)) {
        if (raw.trim() === "") continue;
        let line: ElevenLabsLine;
        try {
          line = JSON.parse(raw) as ElevenLabsLine;
        } catch {
          continue;
        }
        const audioMsBefore = (audioBytes / 2 / TTS_SAMPLE_RATE) * 1000;
        const chunk: TtsChunk = {};
        if (line.audio_base64) {
          chunk.pcm = new Uint8Array(Buffer.from(line.audio_base64, "base64"));
          audioBytes += chunk.pcm.byteLength;
        }
        const alignment = line.alignment ?? line.normalized_alignment;
        if (alignment) {
          const done = words.push(alignment, audioMsBefore);
          if (done.length > 0) chunk.words = done;
        }
        if (chunk.pcm || chunk.words) yield chunk;
      }
      const last = words.flush();
      if (last.length > 0) yield { words: last };
    },
  };
}
