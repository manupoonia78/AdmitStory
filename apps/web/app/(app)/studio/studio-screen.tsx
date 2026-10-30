"use client";

import {
  Button,
  ChapterTabs,
  ImmersiveScope,
  VoiceprintStill,
  cx,
  voiceHueStyle,
} from "@admitstory/ui";
import dynamic from "next/dynamic";
import { CHAPTERS, type ChapterId, type VoiceprintIdentity } from "@admitstory/shared";
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { toCard, type CoverageBarDto, type QuestionDto, type SummaryDto } from "./types";

// Story Studio (spec §5.2, screen B). Phase 1 is the text path: the composer is the primary input,
// and the record button arrives with Phase 2 rather than sitting here disabled.
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

/** Only ever shown after a session ends, so it is not part of the Studio's first load. */
const SessionSummaryCard = dynamic(
  () => import("./session-summary").then((mod) => mod.SessionSummaryCard),
  { ssr: false, loading: () => <div className="h-96" /> },
);

export interface StudioScreenProps {
  mode: "express" | "standard" | "deep";
  resumable: { id: string; chapter: ChapterId; mode: string } | null;
  identity: VoiceprintIdentity;
  hue: number | null;
  initialStories: {
    id: string;
    code: string;
    nickname: string;
    era: string;
    context: string;
    traits: readonly string[];
    status: "confirmed" | "partial" | "unconfirmed";
  }[];
  initialCoverage: CoverageBarDto[];
  initialFactCount: number;
}

export function StudioScreen(props: StudioScreenProps) {
  return <Interview {...props} />;
}

function Interview({
  mode,
  resumable,
  identity,
  hue,
  initialStories,
  initialCoverage,
  initialFactCount,
}: StudioScreenProps) {
  const panelId = useId();
  const answerId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [sessionId, setSessionId] = useState<string | null>(resumable?.id ?? null);
  const [chapter, setChapter] = useState<ChapterId>(resumable?.chapter ?? "roots");
  const [question, setQuestion] = useState<QuestionDto | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState(resumable ? "Picking up where you left off." : "");
  const [error, setError] = useState("");
  const [hurried, setHurried] = useState(mode === "express");
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [digs, setDigs] = useState(0);

  // An answer waiting to be sent while offline (spec §5.2 states: "answers queue locally and
  // sync"). Kept in memory only: nothing the applicant said is written to browser storage.
  const queued = useRef<string | null>(null);

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

  const send = async (payload: { text?: string; skip?: boolean }) => {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    const text = payload.text ?? "";
    try {
      const response = await fetch("/api/studio/turns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clientTurnId: crypto.randomUUID(),
          text,
          skip: payload.skip ?? false,
          slot: question?.slot,
          chapter,
          hurry: hurried,
          digsUsedOnStory: digs,
        }),
      });
      const result = (await response.json()) as { error?: string; question?: QuestionDto | null };
      if (!response.ok) {
        setError(result.error ?? "That answer didn't save. It's still here — try again.");
        return;
      }
      queued.current = null;
      setDraft("");
      setQuestion(result.question ?? null);
      setDigs(result.question?.move === "DIG" ? digs + 1 : 0);
      if (result.question) setChapter(result.question.chapter);
      setStatus(
        result.question
          ? ""
          : "That's everything we need for now. Your Dossier has the whole picture.",
      );
      composerRef.current?.focus();
    } catch {
      // Offline: hold the answer rather than losing it.
      queued.current = text;
      setError("You look offline. This answer is kept here and sent when you're back.");
    } finally {
      setBusy(false);
    }
  };

  // Send a queued answer as soon as the connection returns. `send` is rebuilt on every render, so
  // the listener calls the latest one through useEffectEvent rather than being re-registered.
  const flush = useEffectEvent(() => {
    const pending = queued.current;
    if (pending) void send({ text: pending });
  });
  useEffect(() => {
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

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
      style={hue === null ? undefined : voiceHueStyle(hue)}
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
          className="flex min-h-0 flex-1 flex-col items-start justify-center gap-8 py-4"
        >
          <span aria-hidden className="self-center">
            <VoiceprintStill identity={identity} size={120} mood="listening" label="" />
          </span>

          {/*
            Phase 1 is the text path, so the question is simply set in Newsreader. §6.4's
            word-by-word brightening is synced to TTS word timestamps, which arrive with voice in
            Phase 2; SpokenQuestion comes back then, and it is what pulls Motion in.
          */}
          {question ? (
            <h2 className="max-w-[46ch] font-reading text-display-sm text-text">
              {question.question}
            </h2>
          ) : (
            <p className="font-reading text-reading-lg text-text-soft">
              {busy ? "Thinking about what to ask next…" : "Nothing more to ask right now."}
            </p>
          )}

          <div className="flex w-full max-w-2xl flex-col gap-3">
            <label htmlFor={answerId} className="text-sm font-medium text-text">
              Your answer
            </label>
            <textarea
              ref={composerRef}
              id={answerId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter makes a paragraph; a long answer is the point. Cmd/Ctrl+Enter sends.
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void send({ text: draft });
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
              <Button
                onClick={() => void send({ text: draft })}
                disabled={busy || draft.trim() === "" || !question}
              >
                Done
              </Button>
              <Button
                variant="quiet"
                onClick={() => void send({ skip: true })}
                disabled={busy || !question}
              >
                Skip for now
              </Button>
              {hurried ? null : (
                <Button
                  variant="quiet"
                  onClick={() => {
                    setHurried(true);
                    setStatus("Switched to the short path: only the questions a draft needs.");
                  }}
                  disabled={busy}
                >
                  I&apos;m short on time
                </Button>
              )}
              <Button
                variant="quiet"
                onClick={() => void end()}
                disabled={busy}
                className="ms-auto"
              >
                Finish for now
              </Button>
            </div>
            <StatusMessage message={status} />
            <AlertMessage message={error} />
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <ShelfPane
          sessionId={sessionId}
          initialStories={initialStories.map(toCard)}
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
