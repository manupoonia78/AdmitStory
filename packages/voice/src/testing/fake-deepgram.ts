// A local stand-in for Deepgram's streaming endpoint (the subset in contract.ts), so dictation
// runs and is tested with no key (spec Appendix K: re-verify the real API before launch).
//
// It speaks the same protocol: a `token`/`bearer` subprotocol, linear16 16 kHz PCM in, JSON out —
// interim and final Results with word timestamps, speech_final, from_finalize, SpeechStarted,
// UtteranceEnd, Metadata — and the KeepAlive / Finalize / CloseStream control messages.
//
// Transcription is deterministic. Audio is read in 100 ms blocks:
//  - a block whose samples all equal one non-zero value is a synthetic word (synthWord): value n
//    is the word "w<n>", value SENTENCE_END_BASE + n is "w<n>." — tests speak exact transcripts;
//  - otherwise a loud block is speech, and every few loud blocks become the next word of a
//    placeholder sentence — so the Studio voice path works in development with a real microphone;
//  - anything else is silence.
// Faults for tests: refuse connections, drop a connection after N bytes or N ms, add latency.

import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { SttServerMessage, SttWord } from "../contract";

export const BLOCK_SAMPLES = 1_600;
const BLOCK_BYTES = BLOCK_SAMPLES * 2;
const BLOCK_SECONDS = 0.1;
export const SENTENCE_END_BASE = 10_000;

/** One 100 ms block that the fake hears as the word "w<id>" (or "w<id>." ending a sentence). */
export function synthWord(id: number, endsSentence = false): Int16Array {
  if (id < 1 || id >= SENTENCE_END_BASE) throw new RangeError("Word ids run from 1 to 9999.");
  return new Int16Array(BLOCK_SAMPLES).fill(endsSentence ? SENTENCE_END_BASE + id : id);
}

/** `blocks` × 100 ms of silence. */
export function synthSilence(blocks = 1): Int16Array {
  return new Int16Array(BLOCK_SAMPLES * blocks);
}

// What a real microphone becomes: honest placeholder text, never anything about the speaker.
const PLACEHOLDER =
  "This is the local speech stand in. It turns your voice into placeholder words, so the Studio can be tried without a speech key. Connect Deepgram to hear your real words here.".split(
    " ",
  );
const LOUD_RMS = 600;
const BLOCKS_PER_PLACEHOLDER_WORD = 4;

export interface FakeDeepgramOptions {
  /** 0 picks a free port. */
  port?: number;
  /** Refuse the n-th connection (0-based) during the handshake, as an expired token would be. */
  refuse?: (connection: number) => boolean;
  /** Drop the n-th connection abruptly once it has received this many audio bytes. */
  dropAfterBytes?: (connection: number) => number | undefined;
  /** Drop the n-th connection abruptly this many ms after it opens. */
  dropAfterMs?: (connection: number) => number | undefined;
  /** Delay before each message is sent, in order. */
  latencyMs?: number;
  /** Close a connection that receives neither audio nor KeepAlive for this long (Deepgram: ~10 s). */
  idleTimeoutMs?: number;
  /** Silence that ends a segment with is_final + speech_final (Deepgram's `endpointing`). */
  endpointingMs?: number;
  /** Observes control messages (KeepAlive, Finalize, CloseStream). */
  onControl?: (connection: number, type: string) => void;
}

export interface FakeDeepgram {
  readonly url: string;
  readonly port: number;
  /** Connections accepted or refused so far. */
  readonly connections: number;
  /** Mutable at runtime, e.g. to stop refusing. */
  options: FakeDeepgramOptions;
  close(): Promise<void>;
}

interface PendingWord extends SttWord {
  punctuated_word: string;
}

function offeredProtocols(request: IncomingMessage): string[] {
  return (request.headers["sec-websocket-protocol"] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function authorized(protocols: readonly string[]): boolean {
  const scheme = protocols[0];
  return (scheme === "token" || scheme === "bearer") && protocols.length >= 2;
}

export async function startFakeDeepgram(options: FakeDeepgramOptions = {}): Promise<FakeDeepgram> {
  let connections = 0;
  const server = new WebSocketServer({
    port: options.port ?? 0,
    handleProtocols: (protocols) => [...protocols][0] ?? false,
    verifyClient: (info, accept) => {
      const index = connections;
      connections += 1;
      if (!authorized(offeredProtocols(info.req))) return accept(false, 401, "Unauthorized");
      if (fake.options.refuse?.(index)) return accept(false, 401, "Token expired");
      connectionIndex.set(info.req, index);
      accept(true);
    },
  });
  const connectionIndex = new WeakMap<IncomingMessage, number>();
  server.on("connection", (socket, request) =>
    serve(socket, request, connectionIndex.get(request) ?? 0, fake.options),
  );
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const fake: FakeDeepgram = {
    url: `ws://localhost:${port}/v1/listen`,
    port,
    get connections() {
      return connections;
    },
    options,
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of server.clients) client.terminate();
        server.close(() => resolve());
      }),
  };
  return fake;
}

function serve(
  socket: WebSocket,
  request: IncomingMessage,
  index: number,
  options: FakeDeepgramOptions,
) {
  const params = new URL(request.url ?? "/", "ws://localhost").searchParams;
  const utteranceEndMs = Number(params.get("utterance_end_ms") ?? 0);
  const vadEvents = params.get("vad_events") === "true";
  const interimResults = params.get("interim_results") !== "false";
  const multilingual = params.get("language") === "multi";
  const endpointing = (options.endpointingMs ?? 300) / 1000;
  const latency = options.latencyMs ?? 0;
  const dropAfterBytes = options.dropAfterBytes?.(index);
  const dropAfterMs = options.dropAfterMs?.(index);

  let received = 0;
  let partial: Buffer = Buffer.alloc(0);
  let blocks = 0; // processed 100 ms blocks
  let pending: PendingWord[] = [];
  let finalizedTo = 0;
  let lastWordEnd: number | null = null;
  let utteranceOpen = false;
  let speaking = false;
  let loudRun = 0;
  let placeholder = 0;
  let closed = false;

  // Timers with the same delay fire in the order they were set, so latency keeps message order.
  const later = (run: () => void) => (latency > 0 ? void setTimeout(run, latency) : run());
  const deliver = (message: SttServerMessage & { from_finalize?: boolean }) => {
    const data = JSON.stringify(message);
    later(() => {
      if (!closed && socket.readyState === socket.OPEN) socket.send(data);
    });
  };

  const results = (isFinal: boolean, speechFinal: boolean, end: number, fromFinalize = false) => {
    const words = pending.map((word) => ({ ...word }));
    deliver({
      type: "Results",
      is_final: isFinal,
      speech_final: speechFinal,
      start: finalizedTo,
      duration: Math.max(0, end - finalizedTo),
      channel: {
        alternatives: [{ transcript: words.map((w) => w.punctuated_word).join(" "), words }],
      },
      ...(multilingual ? { languages: ["en"] } : {}),
      ...(fromFinalize ? { from_finalize: true } : {}),
    });
    if (isFinal) {
      pending = [];
      finalizedTo = end;
    }
  };

  const addWord = (word: string, start: number, end: number) => {
    if (!speaking && vadEvents) deliver({ type: "SpeechStarted", timestamp: start });
    speaking = true;
    utteranceOpen = true;
    lastWordEnd = end;
    pending.push({
      word: word.replace(/[.?!,]$/, "").toLowerCase(),
      punctuated_word: word,
      start,
      end,
      confidence: 0.99,
    });
  };

  const processBlock = (block: Int16Array) => {
    const start = blocks * BLOCK_SECONDS;
    const end = start + BLOCK_SECONDS;
    blocks += 1;
    const first = block[0] ?? 0;
    const constant = first !== 0 && block.every((sample) => sample === first);
    if (constant && first > 0) {
      const ends = first >= SENTENCE_END_BASE;
      addWord(`w${ends ? first - SENTENCE_END_BASE : first}${ends ? "." : ""}`, start, end);
    } else {
      let energy = 0;
      for (const sample of block) energy += sample * sample;
      if (Math.sqrt(energy / block.length) > LOUD_RMS) {
        loudRun += 1;
        if (loudRun % BLOCKS_PER_PLACEHOLDER_WORD === 0) {
          addWord(PLACEHOLDER[placeholder % PLACEHOLDER.length] ?? "", end - 0.4, end);
          placeholder += 1;
        }
      } else {
        loudRun = 0;
        speaking = false;
      }
    }

    const silence = lastWordEnd === null ? end : end - lastWordEnd;
    if (pending.length > 0) {
      if (silence >= endpointing) results(true, true, end);
      else if (end - finalizedTo >= 5) results(true, false, end);
      else if (interimResults && blocks % 3 === 0) results(false, false, end);
    } else if (end - finalizedTo >= 1) results(true, false, end);
    if (
      utteranceOpen &&
      utteranceEndMs > 0 &&
      lastWordEnd !== null &&
      silence * 1000 >= utteranceEndMs
    ) {
      utteranceOpen = false;
      deliver({ type: "UtteranceEnd", last_word_end: lastWordEnd });
    }
  };

  const consume = (data: Buffer) => {
    partial = partial.length ? Buffer.concat([partial, data]) : data;
    let offset = 0;
    while (partial.length - offset >= BLOCK_BYTES) {
      const block = new Int16Array(BLOCK_SAMPLES);
      for (let i = 0; i < BLOCK_SAMPLES; i += 1) block[i] = partial.readInt16LE(offset + i * 2);
      processBlock(block);
      offset += BLOCK_BYTES;
    }
    partial = partial.subarray(offset);
  };

  let idle: ReturnType<typeof setTimeout> | null = null;
  const touch = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(
      () => socket.close(1011, "NET-0001: no audio received"),
      options.idleTimeoutMs ?? 10_000,
    );
  };
  touch();
  const dropTimer =
    dropAfterMs === undefined ? null : setTimeout(() => socket.terminate(), dropAfterMs);

  socket.on("message", (data: Buffer, isBinary: boolean) => {
    if (closed) return;
    touch();
    if (isBinary) {
      if (dropAfterBytes !== undefined && received + data.length > dropAfterBytes) {
        closed = true;
        socket.terminate();
        return;
      }
      received += data.length;
      consume(data);
      return;
    }
    let control: { type?: string };
    try {
      control = JSON.parse(data.toString()) as { type?: string };
    } catch {
      return;
    }
    if (typeof control.type === "string") options.onControl?.(index, control.type);
    if (control.type === "Finalize") results(true, true, blocks * BLOCK_SECONDS, true);
    else if (control.type === "CloseStream") {
      if (partial.length > 0) {
        const padded = Buffer.alloc(BLOCK_BYTES);
        partial.copy(padded);
        partial = Buffer.alloc(0);
        consume(padded);
      }
      if (pending.length > 0) results(true, true, blocks * BLOCK_SECONDS);
      deliver({ type: "Metadata", request_id: `fake-${index}`, duration: blocks * BLOCK_SECONDS });
      later(() => {
        if (!closed) socket.close(1000);
      });
    }
  });

  socket.on("close", () => {
    closed = true;
    if (idle) clearTimeout(idle);
    if (dropTimer) clearTimeout(dropTimer);
  });
}
