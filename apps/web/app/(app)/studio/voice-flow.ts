import type { SttRefusal, VoiceTurnFields } from "@admitstory/voice/contract";

// How the Studio moves between talking and writing (spec §5.2 input modes, §12.4). Pure, so the
// rules are tested rather than buried in effects: which mode an answer is in, why Talk is not
// available, and where a spoken answer goes when it cannot be sent as one. The rule throughout is
// that nothing the applicant said is lost: a refused, failed or abandoned dictation lands in the
// composer, where it can be read, edited and sent.
//
// Part of the Studio's first load, so it holds no copy and imports no values: the words for each
// state live in voice-notice.ts, inside the lazily loaded voice stage.

export type InputMode = "talk" | "write";

/** Why Talk is unavailable right now. */
export type VoiceBlock = SttRefusal | "denied" | "unsupported";

/** A dictated answer, whole or partial. */
export interface SpokenAnswer {
  text: string;
  /** Exact seconds of audio captured (VoiceTurnFields.voiceSeconds). */
  seconds: number;
  language: string | null;
}

export interface VoiceFlowState {
  mode: InputMode;
  block: VoiceBlock | null;
  /** Free voice seconds left (§12.4), from the page and then from each STT token. */
  remainingSeconds: number;
  /** The composer's text. */
  draft: string;
  /** The dictation behind the draft when a spoken answer moved into the composer: still voice. */
  carried: { seconds: number; language: string | null } | null;
  /** A failure moved the answer into the composer; Talk comes back once it is sent. */
  resumeTalk: boolean;
  /** The last spoken answer had no words in it. */
  nothingHeard: boolean;
}

export type VoiceFlowEvent =
  | { type: "mode"; mode: InputMode }
  | { type: "draft"; text: string }
  | { type: "dictation-start" }
  | { type: "answer"; answer: SpokenAnswer }
  | { type: "microphone"; status: "live" | "denied" | "unsupported" }
  | { type: "remaining"; seconds: number }
  | { type: "refused"; reason: SttRefusal; partial: SpokenAnswer }
  | { type: "type-instead"; partial: SpokenAnswer }
  | { type: "sent"; voiceSeconds: number }
  | { type: "send-failed"; text: string; fields: VoiceTurnFields };

/** Blocks the applicant cannot clear from the Studio: Talk is not offered at all. */
const HARD_BLOCKS: ReadonlySet<VoiceBlock> = new Set([
  "email_unverified",
  "voice_minutes_used",
  "unsupported",
]);

/** Talk is on offer (a microphone that was refused can be asked for again). */
export function talkAvailable(state: Pick<VoiceFlowState, "block">): boolean {
  return state.block === null || !HARD_BLOCKS.has(state.block);
}

export function initialVoiceFlow(input: {
  emailVerified: boolean;
  remainingSeconds: number;
}): VoiceFlowState {
  // §12.4: voice needs a verified email, and stops when the free minutes are used.
  const block: VoiceBlock | null = !input.emailVerified
    ? "email_unverified"
    : input.remainingSeconds <= 0
      ? "voice_minutes_used"
      : null;
  return {
    mode: block ? "write" : "talk",
    block,
    remainingSeconds: Math.max(0, input.remainingSeconds),
    draft: "",
    carried: null,
    resumeTalk: false,
    nothingHeard: false,
  };
}

/** Joins dictated words onto what is already in the composer, a paragraph apart. */
export function appendAnswer(draft: string, text: string): string {
  const addition = text.trim();
  if (!addition) return draft;
  return draft.trim() ? `${draft.trimEnd()}\n\n${addition}` : addition;
}

function carry(
  carried: VoiceFlowState["carried"],
  partial: SpokenAnswer,
): VoiceFlowState["carried"] {
  if (partial.seconds <= 0) return carried;
  return {
    seconds: (carried?.seconds ?? 0) + partial.seconds,
    language: partial.language ?? carried?.language ?? null,
  };
}

export function voiceFlowReducer(state: VoiceFlowState, event: VoiceFlowEvent): VoiceFlowState {
  switch (event.type) {
    case "mode":
      if (event.mode === "talk" && !talkAvailable(state)) return state;
      return {
        ...state,
        mode: event.mode,
        // Asking again for a refused microphone or an unavailable STT is the applicant's call.
        block: event.mode === "talk" ? null : state.block,
        resumeTalk: false,
        nothingHeard: false,
      };
    case "draft":
      // An emptied composer has no dictation behind it any more.
      return { ...state, draft: event.text, carried: event.text.trim() ? state.carried : null };
    case "dictation-start":
      return { ...state, nothingHeard: false };
    case "answer":
      return { ...state, nothingHeard: event.answer.text.trim() === "" };
    case "microphone":
      if (event.status === "live")
        return state.block === "denied" ? { ...state, block: null } : state;
      // "You can keep going by typing" (§6.9): the composer comes up with the notice.
      return { ...state, mode: "write", block: event.status, resumeTalk: false };
    case "remaining":
      return { ...state, remainingSeconds: Math.max(0, event.seconds) };
    case "refused":
      // Minutes used, email unverified or STT down: the Studio carries on in text (§12.4), and
      // the words said before the refusal move into the composer.
      return {
        ...state,
        mode: "write",
        block: event.reason,
        remainingSeconds: event.reason === "voice_minutes_used" ? 0 : state.remainingSeconds,
        draft: appendAnswer(state.draft, event.partial.text),
        carried: carry(state.carried, event.partial),
        resumeTalk: false,
      };
    case "type-instead":
      return {
        ...state,
        mode: "write",
        draft: appendAnswer(state.draft, event.partial.text),
        carried: carry(state.carried, event.partial),
        resumeTalk: false,
        nothingHeard: false,
      };
    case "sent": {
      const remainingSeconds = Math.max(0, state.remainingSeconds - event.voiceSeconds);
      const exhausted = remainingSeconds <= 0 && state.block === null;
      const next: VoiceFlowState = {
        ...state,
        remainingSeconds,
        draft: "",
        carried: null,
        resumeTalk: false,
        nothingHeard: false,
      };
      if (exhausted) return { ...next, mode: "write", block: "voice_minutes_used" };
      return state.resumeTalk && talkAvailable(state) ? { ...next, mode: "talk" } : next;
    }
    case "send-failed": {
      // A spoken answer that could not be sent becomes visible and editable in the composer.
      const voice = event.fields.inputMode === "voice";
      return {
        ...state,
        mode: "write",
        draft: event.text,
        carried: voice
          ? { seconds: event.fields.voiceSeconds ?? 0, language: event.fields.language ?? null }
          : state.carried,
        resumeTalk: state.resumeTalk || state.mode === "talk",
      };
    }
  }
}

/** What a spoken answer sends with POST /api/studio/turns; null when nothing was said. */
export function spokenTurn(answer: SpokenAnswer): { text: string; fields: VoiceTurnFields } | null {
  const text = answer.text.trim();
  if (!text) return null;
  return { text, fields: voiceFields(answer.seconds, answer.language) };
}

/** What the composer sends: still a voice turn when its text was dictated. */
export function composedTurn(state: VoiceFlowState): { text: string; fields: VoiceTurnFields } {
  return {
    text: state.draft,
    fields: state.carried
      ? voiceFields(state.carried.seconds, state.carried.language)
      : { inputMode: "text" },
  };
}

function voiceFields(seconds: number, language: string | null): VoiceTurnFields {
  // Deepgram reports a language only in multilingual mode; without one the server uses the
  // language set in Settings (§7.5).
  return {
    inputMode: "voice",
    voiceSeconds: Math.round(seconds * 100) / 100,
    ...(language ? { language } : {}),
  };
}
