// One spoken answer, streamed to Deepgram (spec §5.2, §7.5). Framework-agnostic: the capture
// pipeline pushes 16 kHz PCM frames in, the Studio reads snapshots out (useSyncExternalStore).
//
// Nothing the applicant says is lost (Phase 2 AC: a 30-minute session without loss):
//  - every frame Deepgram has not finalized yet stays in memory;
//  - when the socket drops, a fresh single-use token is fetched and a new connection replays the
//    audio from just before the last finalized point; its timestamps are re-based onto the
//    answer's timeline and words already kept are dropped, so each word appears once, in order;
//  - while offline, audio buffers and the connection resumes on the `online` event;
//  - when reconnects keep failing the session is `failed`, the audio is still held, and retry()
//    picks up from where the transcript stops (the Studio also offers to type instead).
// Audio is released as it is finalized and entirely when the answer ends, so a long Studio
// session — one session per answer — never accumulates.

import {
  DEFAULT_UTTERANCE_END_MS,
  DICTATION_SAMPLE_RATE,
  type SttRefusal,
  type SttServerMessage,
  type SttTokenResponse,
  type SttWord,
} from "../contract";
import { createEndpointer } from "./endpointing";
import { markAnswerSubmitted } from "./marks";

export type DictationState =
  "idle" | "connecting" | "listening" | "finishing" | "done" | "failed" | "refused";

export interface DictationSnapshot {
  state: DictationState;
  /** Finalized transcript so far. */
  text: string;
  /** Words still being recognized, shown after `text`. */
  interim: string;
  /** Whole seconds of audio captured for this answer. */
  seconds: number;
  /** The language Deepgram reported most often, when it reports one (multilingual mode). */
  language: string | null;
  /** The answer ended by silence after a sentence end rather than "Done". */
  autoEnded: boolean;
  connection: "closed" | "connecting" | "open" | "offline";
  /** Why /api/stt/token refused, in the `refused` state. */
  refusal: SttRefusal | null;
  /** Free voice seconds left, from the latest token. */
  remainingSeconds: number | null;
}

export interface DictationResult {
  text: string;
  /** Exact seconds captured: VoiceTurnFields.voiceSeconds. */
  seconds: number;
  language: string | null;
  autoEnded: boolean;
}

export type SttTokenOutcome = SttTokenResponse | { refusal: SttRefusal };

export interface NetworkStatus {
  online(): boolean;
  subscribe(onChange: () => void): () => void;
}

export interface DictationOptions {
  /** POST /api/stt/token (see fetchSttToken). Throws on network or server errors. */
  fetchToken: () => Promise<SttTokenOutcome>;
  utteranceEndMs?: number;
  /** Delays before successive reconnect attempts; when they run out the session fails. */
  retryDelaysMs?: readonly number[];
  /** How long to wait for Deepgram to close after CloseStream before reconnecting to finish. */
  drainTimeoutMs?: number;
  /** Deepgram closes a stream after ~10 s without data; KeepAlive is sent after this long idle. */
  keepAliveMs?: number;
  /** Audio replayed from before the last finalized point, so no word is cut at the seam. */
  overlapSeconds?: number;
  network?: NetworkStatus;
  createSocket?: (url: string, protocols: string[]) => WebSocket;
  now?: () => number;
  /** Fires once when the answer is complete (Done or auto end). */
  onDone?: (result: DictationResult) => void;
}

export interface DictationSession {
  getSnapshot(): DictationSnapshot;
  subscribe(listener: () => void): () => void;
  start(): void;
  /** One 16 kHz mono Int16 frame from the capture pipeline. */
  pushAudio(pcm: Int16Array): void;
  /** "Done". Resolves when the transcript is complete, or null if the session is disposed. */
  finish(): Promise<DictationResult | null>;
  /** After `failed`: reconnect and transcribe the audio still held. */
  retry(): void;
  /** Stops everything and drops the audio. */
  dispose(): void;
  /** Seconds of audio currently held in memory (for tests and diagnostics). */
  readonly bufferedSeconds: number;
  /** Seconds of this answer's audio Deepgram has finalized. */
  readonly transcribedSeconds: number;
}

const RATE = DICTATION_SAMPLE_RATE;
const DEFAULT_RETRY_DELAYS = [250, 500, 1_000, 2_000, 4_000, 8_000] as const;

interface Connection {
  socket: WebSocket;
  /** Seconds on the answer's timeline where this connection's audio starts. */
  offset: number;
  /** Absolute sample index up to which audio has been sent on this connection. */
  sent: number;
  draining: boolean;
  open: boolean;
}

const browserNetwork: NetworkStatus = {
  online: () => typeof navigator === "undefined" || navigator.onLine !== false,
  subscribe(onChange) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  },
};

// Scripts written without spaces between words.
const UNSPACED = /[぀-ヿ㐀-鿿豈-﫿＀-￯]/u;

function joinText(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const unspaced = UNSPACED.test(left.at(-1) ?? "") && UNSPACED.test(right[0] ?? "");
  return unspaced ? left + right : `${left} ${right}`;
}

function wordsText(words: readonly SttWord[]): string {
  return words.map((word) => word.punctuated_word ?? word.word).reduce(joinText, "");
}

function parseMessage(data: unknown): SttServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const message = JSON.parse(data) as { type?: unknown };
    return typeof message === "object" && message !== null && typeof message.type === "string"
      ? (message as SttServerMessage)
      : null;
  } catch {
    return null;
  }
}

export function createDictationSession(options: DictationOptions): DictationSession {
  const {
    fetchToken,
    utteranceEndMs = DEFAULT_UTTERANCE_END_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS,
    drainTimeoutMs = 4_000,
    keepAliveMs = 4_000,
    overlapSeconds = 1,
    network = browserNetwork,
    createSocket = (url, protocols) => new WebSocket(url, protocols),
    now = () => Date.now(),
    onDone,
  } = options;

  let snapshot: DictationSnapshot = {
    state: "idle",
    text: "",
    interim: "",
    seconds: 0,
    language: null,
    autoEnded: false,
    connection: "closed",
    refusal: null,
    remainingSeconds: null,
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<DictationSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };

  // Audio not yet finalized (plus the overlap), as frames with their absolute start samples.
  let frames: Int16Array[] = [];
  let frameStarts: number[] = [];
  let captured = 0;

  // Transcript: everything up to `lastWordEnd` is final; Deepgram has finalized audio up to
  // `committed` (seconds on the answer's timeline).
  let text = "";
  let lastWordEnd = 0;
  let committed = 0;
  const languages = new Map<string, number>();
  const endpointer = createEndpointer(utteranceEndMs);

  let connection: Connection | null = null;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSentAt = now();
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeNetwork: (() => void) | null = null;
  let disposed = false;
  // What a failed session was doing, so retry() goes back to it.
  let failedWhile: "listening" | "finishing" = "listening";

  let resolveFinish: (result: DictationResult | null) => void = () => {};
  const finished = new Promise<DictationResult | null>((resolve) => {
    resolveFinish = resolve;
  });

  const active = () => snapshot.state === "connecting" || snapshot.state === "listening";
  // A session that failed while listening keeps taking audio: nothing said is lost.
  const capturing = () =>
    !disposed && (active() || (snapshot.state === "failed" && failedWhile === "listening"));
  const working = () => active() || snapshot.state === "finishing";

  function send(socket: WebSocket, data: string | ArrayBufferView) {
    socket.send(data as string);
    lastSentAt = now();
  }

  function sendPending(conn: Connection) {
    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      const at = frameStarts[i] ?? 0;
      if (!frame || at + frame.length <= conn.sent) continue;
      send(conn.socket, at >= conn.sent ? frame : frame.subarray(conn.sent - at));
      conn.sent = at + frame.length;
    }
  }

  /** Drops frames that end before the replay point; they are transcribed. */
  function releaseFinalized() {
    const keepFrom = Math.max(0, Math.floor((committed - overlapSeconds) * RATE));
    let drop = 0;
    while (
      drop < frames.length &&
      (frameStarts[drop] ?? 0) + (frames[drop]?.length ?? 0) <= keepFrom
    )
      drop += 1;
    if (drop > 0) {
      frames = frames.slice(drop);
      frameStarts = frameStarts.slice(drop);
    }
  }

  function clearTimers() {
    if (retryTimer) clearTimeout(retryTimer);
    if (drainTimer) clearTimeout(drainTimer);
    retryTimer = drainTimer = null;
  }

  function closeConnection() {
    const conn = connection;
    connection = null;
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = null;
    if (!conn) return;
    conn.socket.onopen = conn.socket.onmessage = conn.socket.onclose = conn.socket.onerror = null;
    try {
      conn.socket.close();
    } catch {
      // Already closed.
    }
  }

  function teardown() {
    clearTimers();
    closeConnection();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    unsubscribeNetwork?.();
    unsubscribeNetwork = null;
    frames = [];
    frameStarts = [];
  }

  function topLanguage(): string | null {
    let best: string | null = null;
    let count = 0;
    for (const [language, words] of languages) if (words > count) [best, count] = [language, words];
    return best;
  }

  function complete() {
    const result: DictationResult = {
      text,
      seconds: captured / RATE,
      language: topLanguage(),
      autoEnded: snapshot.autoEnded,
    };
    teardown();
    update({
      state: "done",
      interim: "",
      connection: "closed",
      text,
      seconds: Math.floor(result.seconds),
    });
    resolveFinish(result);
    onDone?.(result);
  }

  function beginDrain(conn: Connection) {
    sendPending(conn);
    send(conn.socket, JSON.stringify({ type: "Finalize" }));
    send(conn.socket, JSON.stringify({ type: "CloseStream" }));
    conn.draining = true;
    drainTimer = setTimeout(() => {
      if (connection !== conn) return;
      closeConnection();
      lost();
    }, drainTimeoutMs);
  }

  function endAnswer(autoEnded: boolean) {
    // "Done" while failed: the answer is over, and retry() will finish transcribing it.
    if (snapshot.state === "failed" && failedWhile === "listening") {
      failedWhile = "finishing";
      return;
    }
    if (!active()) return;
    markAnswerSubmitted();
    update({ state: "finishing", autoEnded });
    // Nothing was said: nothing to transcribe.
    if (captured === 0) return complete();
    if (connection?.open) beginDrain(connection);
  }

  function handle(conn: Connection, message: SttServerMessage) {
    failures = 0;
    if (message.type === "Results") {
      const alternative = message.channel.alternatives[0];
      const words = (alternative?.words ?? []).map((word) => ({
        ...word,
        start: word.start + conn.offset,
        end: word.end + conn.offset,
      }));
      // Words whose middle falls before the last kept word's end were kept from the previous
      // connection's audio: the replay overlap.
      const fresh = words.filter((word) => (word.start + word.end) / 2 >= lastWordEnd);
      const transcript =
        fresh.length === words.length ? (alternative?.transcript ?? "") : wordsText(fresh);
      const start = message.start + conn.offset;
      if (message.is_final) {
        if (fresh.length > 0) {
          text = joinText(text, transcript.trim());
          lastWordEnd = fresh.at(-1)?.end ?? lastWordEnd;
          const language = message.languages?.[0];
          if (language) languages.set(language, (languages.get(language) ?? 0) + fresh.length);
        }
        committed = Math.max(committed, start + message.duration);
        releaseFinalized();
        update({ text, interim: "", language: topLanguage() });
      } else update({ interim: transcript.trim() });
      const shouldEnd = endpointer.result({
        isFinal: message.is_final,
        transcript: message.is_final ? text : transcript,
        start,
        duration: message.duration,
        lastWordEnd: fresh.at(-1)?.end ?? null,
      });
      if (shouldEnd && snapshot.state === "listening") endAnswer(true);
    } else if (message.type === "UtteranceEnd") {
      if (
        endpointer.utteranceEnd(message.last_word_end + conn.offset) &&
        snapshot.state === "listening"
      )
        endAnswer(true);
    } else if (message.type === "SpeechStarted") {
      endpointer.speechStarted(message.timestamp + conn.offset);
    }
  }

  /** The connection dropped (or never opened): reconnect, wait for the network, or fail. */
  function lost() {
    if (!working() || disposed) return;
    if (!network.online()) return update({ connection: "offline" });
    const delay = retryDelaysMs[failures];
    failures += 1;
    if (delay === undefined) {
      failedWhile = snapshot.state === "finishing" ? "finishing" : "listening";
      update({ state: "failed", connection: "closed", interim: "" });
      return;
    }
    update({ connection: "connecting" });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, delay);
  }

  async function connect() {
    if (connection || !working() || disposed) return;
    if (!network.online()) return update({ connection: "offline" });
    update({ connection: "connecting" });
    let token: SttTokenOutcome;
    try {
      token = await fetchToken();
    } catch {
      return lost();
    }
    if (disposed || !working() || connection) return;
    if ("refusal" in token) {
      teardown();
      update({ state: "refused", refusal: token.refusal, connection: "closed", interim: "" });
      resolveFinish(null);
      return;
    }
    update({ remainingSeconds: token.remainingSeconds });

    // Replay from the first held frame: just before the last finalized point.
    const from = frameStarts[0] ?? captured;
    let socket: WebSocket;
    try {
      socket = createSocket(token.url, token.protocols);
    } catch {
      return lost();
    }
    socket.binaryType = "arraybuffer";
    const conn: Connection = {
      socket,
      offset: from / RATE,
      sent: from,
      draining: false,
      open: false,
    };
    connection = conn;

    socket.onopen = () => {
      if (connection !== conn) return;
      conn.open = true;
      if (snapshot.state === "connecting") update({ state: "listening" });
      update({ connection: "open" });
      if (snapshot.state === "finishing") beginDrain(conn);
      else sendPending(conn);
    };
    socket.onmessage = (event: MessageEvent) => {
      if (connection !== conn) return;
      const message = parseMessage(event.data);
      if (message) handle(conn, message);
    };
    socket.onclose = (event: CloseEvent) => {
      if (connection !== conn) return;
      const drained = conn.draining && event.code === 1000;
      closeConnection();
      if (drained && snapshot.state === "finishing") complete();
      else lost();
    };
    // An error is always followed by close, which decides what happens next.
    socket.onerror = () => {};
  }

  function onNetworkChange() {
    if (!working()) return;
    if (!network.online()) {
      if (!connection) update({ connection: "offline" });
      return;
    }
    if (!connection) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      failures = 0;
      void connect();
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get transcribedSeconds() {
      return committed;
    },
    get bufferedSeconds() {
      return frames.reduce((sum, frame) => sum + frame.length, 0) / RATE;
    },
    start() {
      if (snapshot.state !== "idle") return;
      update({ state: "connecting" });
      unsubscribeNetwork = network.subscribe(onNetworkChange);
      keepAliveTimer = setInterval(() => {
        const conn = connection;
        if (conn?.open && !conn.draining && now() - lastSentAt >= keepAliveMs)
          send(conn.socket, JSON.stringify({ type: "KeepAlive" }));
      }, keepAliveMs / 2);
      void connect();
    },
    pushAudio(pcm) {
      if (!capturing() || pcm.length === 0) return;
      frames.push(pcm);
      frameStarts.push(captured);
      captured += pcm.length;
      if (connection?.open) sendPending(connection);
      const seconds = Math.floor(captured / RATE);
      if (seconds !== snapshot.seconds) update({ seconds });
    },
    finish() {
      endAnswer(false);
      return finished;
    },
    retry() {
      if (snapshot.state !== "failed") return;
      failures = 0;
      update({ state: failedWhile });
      void connect();
    },
    dispose() {
      disposed = true;
      teardown();
      resolveFinish(null);
    },
  };
}
