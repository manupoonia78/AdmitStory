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
  type ReactNode,
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
import { PlainQuestion, StageFrame } from "./stage-frame";
import type { CoverageBarDto, QuestionDto, SummaryDto } from "./types";
import {
  composedTurn,
  initialVoiceFlow,
  spokenTurn,
  talkAvailable,
  voiceFlowReducer,
  type SpokenAnswer,
} from "./voice-flow";

// Story Studio (spec §5.2, screen B). Talk and Write are switchable per answer (Phase 2): in Talk
// the record button, the live transcript and the question read aloud; in Write the composer. The
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

/** Only ever shown after a session ends, so it is not part of the Studio's first load. */
const SessionSummaryCard = dynamic(
  () => import("./session-summary").then((mod) => mod.SessionSummaryCard),
  { ssr: false, loading: () => <div className="h-96" /> },
);

export interface StudioScreenProps {
  mode: "express" | "standard" | "deep";
  resumable: { id: string; chapter: ChapterId; mode: string } | null;
  identity: VoiceprintIdentity;
  /**
   * The identity's still Voiceprint, rendered on the server: the stage's stand-in until the voice
   * stage loads, at no cost to the first load.
   */
  still: ReactNode;
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
}

export function StudioScreen(props: StudioScreenProps) {
  return <Interview {...props} />;
}

function Interview({
  mode,
  resumable,
  identity: initialIdentity,
  still,
  hueStyle: initialHueStyle,
  hueChosen,
  voice,
  initialStories,
  initialCoverage,
  initialFactCount,
}: StudioScreenProps) {
  const panelId = useId();
  const answerId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
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

  // An answer waiting in the composer to be sent once the connection is back (spec §5.2 states:
  // "answers queue locally and sync"). Kept in memory only: nothing the applicant said is written
  // to browser storage.
  const queued = useRef(false);

  const apply = useCallback((outcome: SessionOutcome) => {
    if (outcome.error !== undefined) {
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
    try {
      const response = await fetch("/api/studio/turns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clientTurnId: crypto.randomUUID(),
          text,
          skip,
          slot: question?.slot,
          chapter,
          hurry: hurried,
          digsUsedOnStory: digs,
          ...fields,
        }),
      });
      const result = (await response.json()) as { error?: string; question?: QuestionDto | null };
      if (!response.ok) {
        setError(result.error ?? "That answer didn't save. It's still here — try again.");
        if (!skip) dispatch({ type: "send-failed", text, fields });
        return;
      }
      queued.current = false;
      dispatch({ type: "sent", voiceSeconds: skip ? 0 : (fields.voiceSeconds ?? 0) });
      setQuestion(result.question ?? null);
      setDigs(result.question?.move === "DIG" ? digs + 1 : 0);
      if (result.question) setChapter(result.question.chapter);
      setStatus(
        result.question
          ? ""
          : "That's everything we need for now. Your Dossier has the whole picture.",
      );
      if (flow.mode === "write") composerRef.current?.focus();
    } catch {
      // Offline: hold the answer in the composer rather than losing it.
      if (!skip) {
        queued.current = true;
        dispatch({ type: "send-failed", text, fields });
      }
      setError("You look offline. This answer is kept here and sent when you're back.");
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
  const plainStage = (
    <StageFrame
      mode={flow.mode}
      voiceprint={still}
      question={<PlainQuestion text={question?.question ?? null} waiting={waiting} />}
    />
  );

  if (summary)
    return (
      <SessionSummaryCard
        summary={summary}
        onContinue={() => {
          setSummary(null);
          void start({ fresh: true });
        }}
      />
    );

  return (
    <ImmersiveScope
      className="flex min-h-full flex-col gap-6 lg:flex-row lg:gap-10"
      style={hueStyle}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-6">
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

        <div
          id={panelId}
          role="tabpanel"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 py-4"
        >
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
              />
            </Suspense>
          ) : (
            plainStage
          )}

          <div className="flex w-full max-w-2xl flex-col gap-3">
            {flow.mode === "write" ? (
              <>
                <label htmlFor={answerId} className="text-sm font-medium text-text">
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
                  className={cx(
                    "w-full resize-y rounded-plane border border-control-edge bg-depth p-4",
                    "font-reading text-reading text-text placeholder:text-text-soft",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  )}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <StudioButton
                    onClick={sendDraft}
                    disabled={busy || flow.draft.trim() === "" || !question}
                  >
                    Done
                  </StudioButton>
                  {talkAvailable(flow) ? (
                    <StudioButton
                      variant="quiet"
                      onClick={() => dispatch({ type: "mode", mode: "talk" })}
                    >
                      Talk instead
                    </StudioButton>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <StudioButton
                variant="quiet"
                onClick={() => void send({ skip: true })}
                disabled={busy || !question}
              >
                Skip for now
              </StudioButton>
              {hurried ? null : (
                <StudioButton
                  variant="quiet"
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
                className="ms-auto"
              >
                Finish for now
              </StudioButton>
            </div>
            <StatusMessage message={status} />
            <AlertMessage message={error} />
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <ShelfPane
          sessionId={sessionId}
          initialStories={initialStories}
          initialCoverage={initialCoverage}
          initialFactCount={initialFactCount}
        />
      </aside>
    </ImmersiveScope>
  );
}

interface SessionOutcome {
  error?: string;
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
    const result = (await response.json()) as SessionOutcome;
    if (!response.ok || !result.session)
      return { error: result.error ?? "The session didn't start. Try again." };
    return result;
  } catch {
    return { error: "You look offline. Your answers are kept here until you're back." };
  }
}
