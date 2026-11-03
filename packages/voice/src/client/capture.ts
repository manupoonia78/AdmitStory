// Microphone → 16 kHz PCM frames (spec §7.5). An AudioWorklet does the resampling off the main
// thread; browsers without AudioWorklet fall back to a ScriptProcessor running the same encoder.
//
// The worklet module is a Blob URL built from createPcmEncoder's own source text, so there is no
// separate file for Next.js to copy or Safari to fetch, and only one encoder implementation.
// (A Content-Security-Policy that restricts scripts must allow `blob:` for this.)

import { DICTATION_SAMPLE_RATE } from "../contract";
import { createPcmEncoder } from "./resample";

export const CAPTURE_PROCESSOR = "admitstory-pcm-capture";

/** 100 ms of 16 kHz audio per frame: within Deepgram's recommended 20–100 ms chunks. */
export const FRAME_SAMPLES = DICTATION_SAMPLE_RATE / 10;

/** The AudioWorkletProcessor module, as source text. */
export function captureWorkletSource(): string {
  return `const createPcmEncoder = ${createPcmEncoder.toString()};
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { outputRate, frameSamples } = options.processorOptions;
    this.encoder = createPcmEncoder(sampleRate, outputRate, frameSamples);
    this.stopped = false;
    this.port.onmessage = (event) => {
      if (event.data === "flush") {
        const partial = this.encoder.flush();
        if (partial) this.port.postMessage(partial, [partial.buffer]);
        this.port.postMessage("flushed");
      } else if (event.data === "stop") this.stopped = true;
    };
  }
  process(inputs) {
    if (this.stopped) return false;
    const channel = inputs[0] && inputs[0][0];
    if (channel) for (const frame of this.encoder.push(channel)) this.port.postMessage(frame, [frame.buffer]);
    return true;
  }
}
registerProcessor(${JSON.stringify(CAPTURE_PROCESSOR)}, PcmCapture);
`;
}

export interface PcmCapture {
  readonly kind: "worklet" | "script-processor";
  /** Delivers the partly filled last frame. Call before finishing an answer. */
  flush(): Promise<void>;
  /** Disconnects from the graph. The stream and context belong to the caller. */
  close(): void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

function loadWorklet(context: AudioContext): Promise<void> {
  let promise = loaded.get(context);
  if (!promise) {
    const url = URL.createObjectURL(
      new Blob([captureWorkletSource()], { type: "application/javascript" }),
    );
    promise = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loaded.set(context, promise);
    promise.catch(() => loaded.delete(context));
  }
  return promise;
}

/**
 * Taps `stream` on the caller's context (the Voiceprint's, so there is one getUserMedia and one
 * permission prompt) and calls onFrame with each 16 kHz Int16 frame. The tap feeds a muted gain
 * into the destination, because Safari only pulls nodes that reach it.
 */
export async function startPcmCapture(
  context: AudioContext,
  stream: MediaStream,
  onFrame: (pcm: Int16Array) => void,
): Promise<PcmCapture> {
  const source = context.createMediaStreamSource(stream);
  const mute = context.createGain();
  mute.gain.value = 0;
  mute.connect(context.destination);

  if (typeof AudioWorkletNode !== "undefined" && context.audioWorklet) {
    try {
      await loadWorklet(context);
      return workletCapture(context, source, mute, onFrame);
    } catch {
      // Falls through to the ScriptProcessor (e.g. a CSP that blocks blob: modules).
    }
  }
  return scriptProcessorCapture(context, source, mute, onFrame);
}

function workletCapture(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  mute: GainNode,
  onFrame: (pcm: Int16Array) => void,
): PcmCapture {
  const node = new AudioWorkletNode(context, CAPTURE_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    processorOptions: { outputRate: DICTATION_SAMPLE_RATE, frameSamples: FRAME_SAMPLES },
  });
  let flushed: (() => void) | null = null;
  node.port.onmessage = (event: MessageEvent<Int16Array | "flushed">) => {
    if (event.data === "flushed") {
      flushed?.();
      flushed = null;
    } else onFrame(event.data);
  };
  source.connect(node);
  node.connect(mute);

  return {
    kind: "worklet",
    flush() {
      return new Promise<void>((resolve) => {
        flushed = resolve;
        node.port.postMessage("flush");
        // A suspended context never answers; the last 100 ms is not worth hanging for.
        setTimeout(resolve, 300);
      });
    },
    close() {
      node.port.postMessage("stop");
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    },
  };
}

function scriptProcessorCapture(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  mute: GainNode,
  onFrame: (pcm: Int16Array) => void,
): PcmCapture {
  const encoder = createPcmEncoder(context.sampleRate, DICTATION_SAMPLE_RATE, FRAME_SAMPLES);
  const node = context.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (event) => {
    for (const frame of encoder.push(event.inputBuffer.getChannelData(0))) onFrame(frame);
  };
  source.connect(node);
  node.connect(mute);

  return {
    kind: "script-processor",
    flush() {
      const partial = encoder.flush();
      if (partial) onFrame(partial);
      return Promise.resolve();
    },
    close() {
      node.onaudioprocess = null;
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    },
  };
}
