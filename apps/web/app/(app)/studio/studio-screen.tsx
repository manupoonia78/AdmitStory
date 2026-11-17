"use client";

import {
  ChapterTabs,
  ImmersiveScope,
  buttonStyles,
  cx,
  type ButtonVariant,
  type StoryCardData,
} from "@admitstory/ui";
import dynamic from "next/dynamic";
import { CHAPTERS, type ChapterId, type VoiceprintIdentity } from "@admitstory/shared";
import type { VoiceTurnFields } from "@admitstory/voice/contract";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { PlainQuestion, PlainRecordButton, StageFrame } from "./stage-frame";
import "./studio.css";
import type { CoverageBarDto, LiveReply, QuestionDto, SummaryDto } from "./types";
import {
  composedTurn,
  initialVoiceFlow,
  spokenTurn,
  talkAvailable,
  voiceFlowReducer,
  type SpokenAnswer,
} from "./voice-flow";

// Story Studio (spec §5.2, screen B; SPEC §6.4). Night in both themes. Talk and Write are
// switchable per answer from the top row: in Talk the record button on the horizon, the live
// transcript and the question read aloud; in Write the composer. The
// answer flow (voice-flow.ts) decides which, and makes sure a spoken answer that cannot be sent
// as one lands in the composer rather than being lost.
//
// The hero moment is the story-capture flight (§6.7), driven by StoryCaptureProvider: when the
// Extractor finds a story, the SSE channel delivers it and the card flies into the shelf. Around
// it the screen stays quiet — the shelf and the coverage meter do not move on their own.

const TABS = CHAPTERS.map((chapter) => ({ id: chapter.id, label: chapter.label }));

/**
 * The shelf pane carries the story-capture flight, which is the only part of the Studio that needs
 * Motion. It loads after the question and the composer, which are what someone is waiting for, and
 * its placeholder holds the pane's shape so nothing moves when it arrives (spec §6.1, §6.11).
 */
const ShelfPane = dynamic(() => import("./shelf-pane").then((mod) => mod.ShelfPane), {
  ssr: false,
  loading: () => <div className="h-96 w-full" />,
});

/**
 * The voice stage: dictation, read-aloud, Motion and the living Voiceprint (spec §6.11: voice code
 * is lazy). It is requested once the page has hydrated, and until it lands the same frame shows a
 * still Voiceprint and the question in plain text, so nothing moves when it takes over.
 */
const VoiceStage = lazy(() => import("./voice-stage").then((mod) => ({ default: mod.VoiceStage })));

const noSubscription = () => () => {};

/**
 * Button's look without its Radix Slot and magnetic pull, for the controls that are part of the
 * Studio's first load: those two are 3.5 KB of a route that sits at §6.11's 160 KB budget. The
 * voice stage, which loads later, uses Button itself.
 */
function StudioButton({
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={cx(buttonStyles({ variant }), className)} {...rest} />;
}

/** The session row's quiet buttons, at the small size. */
const SMALL = "h-9 px-3 text-[13px]";

/** Only shown once the free half is used up, so it is not part of the Studio's first load. */
const StudioGate = dynamic(() => import("./studio-gate-live").then((mod) => mod.StudioGateLive), {
  loading: () => <div className="h-96" />,
});

/** "3 free answers left", from `warnAt` answers left down to one. */
function allowanceLine(left: number): string {
  return left === 1
    ? "One free answer left in Story Studio. Everything you’ve said stays saved."
    : `${left} free answers left in Story Studio. Everything you’ve said stays saved.`;
}

/** Only ever shown after a session ends, so it is not part of the Studio's first load. */
const SessionSummaryCard = dynamic(
  () => import("./session-summary").then((mod) => mod.SessionSummaryCard),
  { ssr: false, loading: () => <div className="h-96" /> },
);

export interface StudioScreenProps {
  mode: "express" | "standard" | "deep";
  resumable: { id: string; chapter: ChapterId; mode: string } | null;
  identity: VoiceprintIdentity;
  /** voiceHueStyle() of the applicant's hue: the one chosen in Settings, else their identity's. */
  hueStyle: CSSProperties;
  /** The hue was chosen in Settings, so a new Voiceprint identity does not change it. */
  hueChosen: boolean;
  voice: {
    readAloud: boolean;
    /** Free voice seconds left (§12.4). */
    remainingSeconds: number;
    /** §12.4: voice needs a verified email. */
    emailVerified: boolean;
  };
  /** The shelf's cards, made on the server (toCard) so the mapping is not in the first load. */
  initialStories: StoryCardData[];
  initialCoverage: CoverageBarDto[];
  initialFactCount: number;
  /**
   * The free half (lib/studio/allowance.ts): answers left and when to start saying so. Null for
   * an account with a school pack, which has no limit.
   */
  allowance: { limit: number; left: number; warnAt: number } | null;
  /**
   * The school the applicant would unlock next (lib/funnel/next-school.ts), which the halfway
   * prompt and the end-of-session card point at. Null with no buyable school on their list.
   */
  nextSchool: { userSchoolId: string; name: string; preview: boolean } | null;
}

export function StudioScreen(props: StudioScreenProps) {
  return <Interview {...props} />;
}

function Interview({
  mode,
  resumable,
  identity: initialIdentity,
  hueStyle: initialHueStyle,
  hueChosen,
  voice,
  initialStories,
  initialCoverage,
  initialFactCount,
  allowance,
  nextSchool,
}: StudioScreenProps) {
  const panelId = useId();
  const answerId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  /** Set by the voice stage: Write while talking carries the words said so far over. */
  const writeInsteadRef = useRef<(() => void) | null>(null);
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const [flow, dispatch] = useReducer(voiceFlowReducer, voice, initialVoiceFlow);
  const [readAloud, setReadAloud] = useState(voice.readAloud);
  const [identity, setIdentity] = useState(initialIdentity);
  const [hueStyle, setHueStyle] = useState(initialHueStyle);

  const [sessionId, setSessionId] = useState<string | null>(resumable?.id ?? null);
  const [chapter, setChapter] = useState<ChapterId>(resumable?.chapter ?? "roots");
  const [question, setQuestion] = useState<QuestionDto | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState(resumable ? "Picking up where you left off." : "");
  const [error, setError] = useState("");
  const [hurried, setHurried] = useState(mode === "express");
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [digs, setDigs] = useState(0);
  /** The consultant's reply while it streams in, then the finished one (see LiveReply). */
  const [live, setLive] = useState<LiveReply | null>(null);
  /** The applicant's last answer, shown as saved until they start the next one. */
  const [lastSaid, setLastSaid] = useState("");
  /** Set once the free half is used up (lib/studio/allowance.ts): the halfway prompt replaces the Studio. */
  const [gate, setGate] = useState<{ used: number; limit: number } | null>(null);

  // An answer waiting in the composer to be sent once the connection is back (spec §5.2 states:
  // "answers queue locally and sync"). Kept in memory only: nothing the applicant said is written
  // to browser storage.
  const queued = useRef(false);

  const apply = useCallback((outcome: SessionOutcome) => {
    if (outcome.limit) {
      setGate(outcome.limit);
    } else if (outcome.error !== undefined) {
      setError(outcome.error);
    } else if (outcome.session) {
      setSessionId(outcome.session.id);
      setChapter(outcome.session.chapter);
      setQuestion(outcome.question ?? null);
      setStatus(outcome.session.resumed ? "Picking up where you left off." : "");
    }
    setBusy(false);
  }, []);

  const start = useCallback(
    async (options: { fresh?: boolean; mode?: typeof mode } = {}) => {
      setBusy(true);
      setError("");
      apply(await openSession(options));
    },
    [apply],
  );

  // One session per visit: resumed if one is open, started if not. `busy` starts true, so the
  // effect sets no state until the request comes back.
  useEffect(() => {
    let cancelled = false;
    void openSession({}).then((outcome) => {
      if (!cancelled) apply(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const send = async (payload: { text?: string; skip?: boolean; fields?: VoiceTurnFields }) => {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    const text = payload.text ?? "";
    const skip = payload.skip ?? false;
    const fields: VoiceTurnFields = payload.fields ?? { inputMode: "text" };
    const clientTurnId = crypto.randomUUID();
    // The reply streams in (NDJSON): "saved" the moment the answer is stored, then the
    // consultant's words as they are written, then the finished question.
    setLive({ id: clientTurnId, text: "", final: false });
    let saved = false;
    try {
      const response = await fetch("/api/studio/turns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clientTurnId,
          text,
          skip,
          slot: question?.slot,
          chapter,
          hurry: hurried,
          digsUsedOnStory: digs,
          stream: true,
          ...fields,
        }),
      });
      let result: TurnResult = {};
      if (response.ok && response.body && isNdjson(response)) {
        await readLines(response.body, (line) => {
          const event = JSON.parse(line) as TurnEvent;
          if (event.type === "saved" && !saved) {
            saved = true;
            queued.current = false;
            if (!skip) setLastSaid(text.trim());
            dispatch({ type: "sent", voiceSeconds: skip ? 0 : (fields.voiceSeconds ?? 0) });
          } else if (event.type === "delta") {
            setLive((current) =>
              current?.id === clientTurnId
                ? { ...current, text: current.text + event.text }
                : current,
            );
          } else if (event.type === "done") {
            result = event;
          } else if (event.type === "error") {
            result = { error: event.error, savedError: true };
          }
        });
      } else {
        result = (await response.json()) as TurnResult;
      }
      if (result.code === "studio_limit" && result.allowance?.limit != null) {
        setLive(null);
        // Refused before it was stored, so it is kept in the composer for after an unlock.
        if (!skip) dispatch({ type: "send-failed", text, fields });
        setGate({ used: result.allowance.used, limit: result.allowance.limit });
        return;
      }
      if (!response.ok || result.savedError) {
        setLive(null);
        setError(
          result.error ??
            (saved
              ? "Your answer is saved."
              : "That answer didn't save. It's still here — try again."),
        );
        if (!skip && !saved) dispatch({ type: "send-failed", text, fields });
        return;
      }
      if (!saved) {
        queued.current = false;
        if (!skip) setLastSaid(text.trim());
        dispatch({ type: "sent", voiceSeconds: skip ? 0 : (fields.voiceSeconds ?? 0) });
      }
      const next = result.question ?? null;
      setQuestion(next ? { ...next, streamed: true } : null);
      setLive(next ? { id: clientTurnId, text: next.question, final: true } : null);
      setDigs(next?.move === "DIG" ? digs + 1 : 0);
      if (next) setChapter(next.chapter);
      const left = result.allowance?.left ?? null;
      if (left === 0 && result.allowance?.limit != null) {
        setGate({ used: result.allowance.used, limit: result.allowance.limit });
        return;
      }
      setStatus(
        left !== null && allowance && left <= allowance.warnAt
          ? allowanceLine(left)
          : next
            ? ""
            : "That's everything we need for now. Your Dossier has the whole picture.",
      );
      if (flow.mode === "write") composerRef.current?.focus();
    } catch {
      setLive(null);
      if (saved) {
        setError("Your answer is saved, but the next question didn't arrive. Try Skip for now.");
      } else {
        // Offline: hold the answer in the composer rather than losing it.
        if (!skip) {
          queued.current = true;
          dispatch({ type: "send-failed", text, fields });
        }
        setError("You look offline. This answer is kept here and sent when you're back.");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendDraft = () => {
    const turn = composedTurn(flow);
    void send(turn);
  };

  /** A dictated answer is complete: sent as it is, or nothing happens when nothing was said. */
  const answered = (answer: SpokenAnswer) => {
    dispatch({ type: "answer", answer });
    const turn = spokenTurn(answer);
    if (!turn) return;
    // Another request is in flight (a skip or "Finish for now" mid-answer): `send` would drop it,
    // so it waits in the composer, still a voice answer.
    if (busy || !sessionId) dispatch({ type: "send-failed", text: turn.text, fields: turn.fields });
    else void send(turn);
  };

  const changeReadAloud = (on: boolean) => {
    setReadAloud(on);
    // Saved like the setting it is; the Studio carries on whether or not the save lands.
    void fetch("/api/profile/voice", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readAloud: on }),
    }).catch(() => {});
  };

  // Send a queued answer as soon as the connection returns: whatever is in the composer by then,
  // edits included. `send` is rebuilt on every render, so the listener calls the latest one
  // through useEffectEvent rather than being re-registered.
  const flush = useEffectEvent(() => {
    if (queued.current && flow.draft.trim()) void send(composedTurn(flow));
  });
  useEffect(() => {
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Switching to Write puts the cursor in the composer (the stage does the same for Talk).
  const wasWrite = useRef(flow.mode === "write");
  useEffect(() => {
    const write = flow.mode === "write";
    if (wasWrite.current === write) return;
    wasWrite.current = write;
    if (write) composerRef.current?.focus();
  }, [flow.mode]);

  const end = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/studio/sessions/${sessionId}/end`, { method: "POST" });
      const result = (await response.json()) as { summary?: SummaryDto; error?: string };
      if (result.summary) setSummary(result.summary);
      else setError(result.error ?? "The session didn't close cleanly, but everything is saved.");
    } finally {
      setBusy(false);
    }
  };

  const waiting = busy ? "Thinking about what to ask next…" : "Nothing more to ask right now.";
  const chapterLabel = TABS.find((tab) => tab.id === chapter)?.label ?? "";
  const talkOpen = talkAvailable(flow);

  const composer =
    flow.mode === "write" ? (
      <div className="flex flex-col gap-3">
        <label htmlFor={answerId} className="label text-text-label">
          Your answer
        </label>
        <textarea
          ref={composerRef}
          id={answerId}
          value={flow.draft}
          onChange={(event) => dispatch({ type: "draft", text: event.target.value })}
          onKeyDown={(event) => {
            // Enter makes a paragraph; a long answer is the point. Cmd/Ctrl+Enter sends.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              sendDraft();
            }
          }}
          rows={6}
          placeholder="Say as much as you like. Rambling is useful."
          className="studio-composer"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={sendDraft}
            disabled={busy || flow.draft.trim() === "" || !question}
            className={buttonStyles({ arrow: true })}
          >
            Done
            <span aria-hidden className="btn-arrow" />
          </button>
          <span aria-hidden className="label text-text-faint">
            ⌘ Enter to send
          </span>
        </div>
      </div>
    ) : undefined;

  const plainStage = (
    <StageFrame
      mode={flow.mode}
      chapter={chapterLabel}
      question={<PlainQuestion text={question?.question ?? null} waiting={waiting} />}
      answer={
        flow.mode === "talk" ? (
          <div className="studio-transcript flex items-end">
            <p className="text-base text-text-soft">
              Answer out loud. Your words appear here as you speak.
            </p>
          </div>
        ) : (
          composer
        )
      }
      button={<PlainRecordButton />}
    />
  );

  const switchMode = (next: "talk" | "write") => {
    if (next === flow.mode) return;
    if (next === "talk") {
      if (talkOpen) dispatch({ type: "mode", mode: "talk" });
      return;
    }
    if (writeInsteadRef.current) writeInsteadRef.current();
    else dispatch({ type: "mode", mode: "write" });
  };

  if (gate)
    return (
      <StudioGate
        used={gate.used}
        limit={gate.limit}
        stories={initialStories.map((story) => story.nickname)}
        facts={initialFactCount}
        school={nextSchool}
      />
    );

  if (summary)
    return (
      <SessionSummaryCard
        summary={summary}
        school={nextSchool}
        onContinue={() => {
          setSummary(null);
          void start({ fresh: true });
        }}
      />
    );

  return (
    // Night in both themes (SPEC §6.4): the room is part of the instrument.
    <div data-theme="night" className="min-h-full">
      <ImmersiveScope className="studio-room" style={hueStyle}>
        <div className="studio-stage">
          <div className="studio-top">
            <ChapterTabs
              chapters={TABS}
              value={chapter}
              onChange={(next) => {
                setChapter(next);
                setStatus("");
              }}
              panelId={panelId}
              label="Chapters"
            />
            <div role="group" aria-label="Answer by" className="studio-mode" data-mode={flow.mode}>
              <button
                type="button"
                aria-pressed={flow.mode === "talk"}
                aria-disabled={!talkOpen || undefined}
                onClick={() => switchMode("talk")}
              >
                Speak
              </button>
              <button
                type="button"
                aria-pressed={flow.mode === "write"}
                onClick={() => switchMode("write")}
              >
                Write
              </button>
            </div>
          </div>

          <div id={panelId} role="tabpanel" className="studio-panel">
            {hydrated ? (
              <Suspense fallback={plainStage}>
                <VoiceStage
                  flow={flow}
                  dispatch={dispatch}
                  question={question}
                  waiting={waiting}
                  busy={busy}
                  identity={identity}
                  onIdentity={(next, style) => {
                    setIdentity(next);
                    if (!hueChosen) setHueStyle(style);
                  }}
                  readAloud={readAloud}
                  onReadAloudChange={changeReadAloud}
                  onAnswer={answered}
                  reply={live}
                  lastSaid={lastSaid}
                  chapter={chapterLabel}
                  writeInsteadRef={writeInsteadRef}
                  composer={composer}
                />
              </Suspense>
            ) : (
              plainStage
            )}

            <div className="mt-6 flex flex-col gap-2 empty:hidden">
              <StatusMessage message={status} />
              <AlertMessage message={error} />
            </div>

            <div className="studio-session">
              <StudioButton
                variant="quiet"
                className={SMALL}
                onClick={() => void send({ skip: true })}
                disabled={busy || !question}
              >
                Skip for now
              </StudioButton>
              {hurried ? null : (
                <StudioButton
                  variant="quiet"
                  className={SMALL}
                  onClick={() => {
                    setHurried(true);
                    setStatus("Switched to the short path: only the questions a draft needs.");
                  }}
                  disabled={busy}
                >
                  I&apos;m short on time
                </StudioButton>
              )}
              <StudioButton
                variant="quiet"
                onClick={() => void end()}
                disabled={busy}
                className={cx(SMALL, "ms-auto")}
              >
                Finish for now
              </StudioButton>
            </div>
          </div>
        </div>

        <aside aria-label="Your shelf and coverage" className="studio-shelf">
          <ShelfPane
            sessionId={sessionId}
            initialStories={initialStories}
            initialCoverage={initialCoverage}
            initialFactCount={initialFactCount}
          />
        </aside>
      </ImmersiveScope>
    </div>
  );
}

interface TurnResult {
  error?: string;
  code?: string;
  question?: QuestionDto | null;
  allowance?: { used: number; limit: number | null; left: number | null };
  /** The answer was stored, then the next question failed. */
  savedError?: boolean;
}

type TurnEvent =
  | { type: "saved"; turnId: string }
  | { type: "delta"; text: string }
  | ({ type: "done" } & TurnResult)
  | { type: "error"; error: string };

const isNdjson = (response: Response) =>
  response.headers.get("content-type")?.includes("application/x-ndjson") === true;

/** Calls `onLine` with each complete line of a streamed body. */
async function readLines(body: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onLine(line);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer.trim()) onLine(buffer.trim());
}

interface SessionOutcome {
  error?: string;
  /** The free half was already used up (a 402 "studio_limit"). */
  limit?: { used: number; limit: number };
  session?: { id: string; chapter: ChapterId; resumed: boolean };
  question?: QuestionDto | null;
}

/** Starts or resumes a session. Sets no state, so an effect can call it without cascading. */
async function openSession(options: { fresh?: boolean; mode?: string }): Promise<SessionOutcome> {
  try {
    const response = await fetch("/api/studio/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fresh: options.fresh ?? false, mode: options.mode }),
    });
    const result = (await response.json()) as SessionOutcome & {
      code?: string;
      allowance?: { used: number; limit: number };
    };
    if (result.code === "studio_limit" && result.allowance)
      return { limit: { used: result.allowance.used, limit: result.allowance.limit } };
    if (!response.ok || !result.session)
      return { error: result.error ?? "The session didn't start. Try again." };
    return result;
  } catch {
    return { error: "You look offline. Your answers are kept here until you're back." };
  }
}
