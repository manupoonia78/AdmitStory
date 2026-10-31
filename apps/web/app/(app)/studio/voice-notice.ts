import type { MicrophoneState, RecordButtonState, TranscriptSegment } from "@admitstory/ui";
import type { DictationSnapshot } from "@admitstory/voice/client";
import { FREE_VOICE_SECONDS } from "@admitstory/voice/contract";
import type { InputMode, VoiceBlock } from "./voice-flow";

// What the Studio says about voice in each state (spec §5.2 states, §6.9 copy and its "never"
// list), and which state that is. Kept apart from the voice stage so the wording and the choice
// are tested; only the lazily loaded stage imports it.

const FREE_MINUTES = FREE_VOICE_SECONDS / 60;

/** Below this many free seconds the Studio warns that the minutes are running out. */
export const LOW_MINUTES_SECONDS = 10 * 60;

/** A pause this long mid-answer gets a gentle word; it never ends the answer (§5.2). */
export const LONG_SILENCE_MS = 20_000;

export const VOICE_COPY = {
  // §6.9, without "unless you choose to": keeping recordings is not offered yet (Phase 2 skips it).
  ask: "Admitstory needs your microphone to hear your answers. Audio is turned into text and not kept.",
  denied: "Microphone is blocked in your browser settings. You can keep going by typing.",
  unsupported:
    "This browser can't share a microphone with this page. You can keep going by typing.",
  micError: "The microphone didn't start. Check that one is connected, then try again.",
  unverified:
    "Talking needs a verified email. Open the link we sent you, then come back. Until then you can keep going by typing.",
  minutesUsed: `You've used your ${FREE_MINUTES} free voice minutes, so the Studio carries on in writing from here. Everything you've said is saved.`,
  sttUnavailable: "Voice isn't available right now. You can keep going by typing.",
  sttFailed:
    "The connection dropped while your answer was being written down. Your audio is kept here. Try again, or type instead.",
  offline:
    "You're offline. Keep talking: your answer is kept here and written down when you're back.",
  longSilence: "Take your time. When you've finished, tap Done.",
  nothingHeard:
    "We didn't hear anything that time. Tap the microphone to try again, or write instead.",
} as const;

export function lowMinutesCopy(remainingSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  const unit = minutes === 1 ? "minute" : "minutes";
  return `About ${minutes} voice ${unit} left. After that, the Studio carries on in writing.`;
}

export type NoticeAction = "allow" | "write" | "retry-stt" | "retry-mic" | "type";

export const NOTICE_ACTION_LABELS: Record<NoticeAction, string> = {
  allow: "Allow microphone",
  write: "Write instead",
  "retry-stt": "Try again",
  "retry-mic": "Try again",
  type: "Type instead",
};

export interface StudioNotice {
  tone: "info" | "warning" | "problem";
  message: string;
  /** In order; the first is the primary action. */
  actions: NoticeAction[];
}

export interface NoticeInput {
  mode: InputMode;
  block: VoiceBlock | null;
  remainingSeconds: number;
  microphone: MicrophoneState["status"];
  /** The browser's microphone permission, when the Permissions API says. */
  permission: PermissionState | "unknown";
  dictation: DictationSnapshot["state"];
  connection: DictationSnapshot["connection"];
  longSilence: boolean;
  nothingHeard: boolean;
}

const BLOCK_NOTICES: Record<VoiceBlock, string> = {
  email_unverified: VOICE_COPY.unverified,
  voice_minutes_used: VOICE_COPY.minutesUsed,
  stt_unavailable: VOICE_COPY.sttUnavailable,
  denied: VOICE_COPY.denied,
  unsupported: VOICE_COPY.unsupported,
};

const recording = (state: DictationSnapshot["state"]) =>
  state === "connecting" || state === "listening";

/** The one notice to show, or null. A blocked voice is said in either mode; the rest in Talk. */
export function studioNotice(input: NoticeInput): StudioNotice | null {
  if (input.block) return { tone: "info", message: BLOCK_NOTICES[input.block], actions: [] };
  if (input.mode !== "talk") return null;

  if (input.dictation === "failed")
    return { tone: "problem", message: VOICE_COPY.sttFailed, actions: ["retry-stt", "type"] };
  if (input.connection === "offline" && recording(input.dictation))
    return { tone: "warning", message: VOICE_COPY.offline, actions: [] };
  if (input.microphone === "error")
    return { tone: "problem", message: VOICE_COPY.micError, actions: ["retry-mic", "write"] };
  if (
    (input.microphone === "idle" || input.microphone === "requesting") &&
    input.permission !== "granted"
  )
    return { tone: "info", message: VOICE_COPY.ask, actions: ["allow", "write"] };
  if (input.longSilence && input.dictation === "listening")
    return { tone: "info", message: VOICE_COPY.longSilence, actions: [] };
  if (input.nothingHeard) return { tone: "info", message: VOICE_COPY.nothingHeard, actions: [] };
  if (input.remainingSeconds <= LOW_MINUTES_SECONDS)
    return { tone: "warning", message: lowMinutesCopy(input.remainingSeconds), actions: [] };
  return null;
}

/** The record button's state for a dictation state; `busy` is the answer being sent. */
export function recordButtonState(
  state: DictationSnapshot["state"],
  busy: boolean,
): RecordButtonState {
  if (recording(state)) return "listening";
  if (state === "finishing") return "processing";
  if (state === "failed") return "error";
  return busy ? "processing" : "idle";
}

// Sentence ends in the scripts SPEECH_LANGUAGES covers, followed by a space. No lookbehind: it is
// a syntax error on iOS Safari before 16.4, and would take the whole voice stage down with it.
const SENTENCE_END = /[.?!…。？！．।॥]+["'”’)\]»」』]*\s+/gu;

function sentencesOf(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    sentences.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

/**
 * The live transcript's segments: one per finished sentence, the unfinished one, then the interim
 * words. Ids are stable while a sentence grows, so the polite log announces each sentence once
 * rather than the whole answer on every word.
 */
export function transcriptSegments(
  snapshot: Pick<DictationSnapshot, "text" | "interim">,
  key: string,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = sentencesOf(snapshot.text).map((text, index) => ({
    id: `${key}-${index}`,
    text,
    final: true,
  }));
  const interim = snapshot.interim.trim();
  if (interim) segments.push({ id: `${key}-interim`, text: interim, final: false });
  return segments;
}

/** Everything heard so far, interim words included: what "Type instead" carries over. */
export function heardSoFar(snapshot: Pick<DictationSnapshot, "text" | "interim">): string {
  return [snapshot.text.trim(), snapshot.interim.trim()].filter(Boolean).join(" ");
}

/** What a refused STT token means for a dictation outside the Studio (the Dossier). */
export function refusalCopy(reason: VoiceBlock): string {
  return BLOCK_NOTICES[reason];
}
