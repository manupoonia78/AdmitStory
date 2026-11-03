"use client";

import {
  Button,
  ChapterTabs,
  CoverageMeter,
  Label,
  LiveTranscript,
  RecordButton,
  SpokenQuestion,
  StoryCaptureProvider,
  StoryShelf,
  Voiceprint,
  chapterTabId,
  estimateWordTimings,
  syntheticSignalAt,
  useMicrophone,
  useShelfFallbackRef,
  useStoryCapture,
  type LiveVoiceSignal,
  type PlaybackClock,
  type RecordButtonState,
  type TranscriptSegment,
  type VoiceSignalRef,
  type VoiceprintMood,
  type WordTiming,
} from "@admitstory/ui";
import { APP_NAME } from "@admitstory/shared";
import { MicrophoneIcon, PencilSimpleLineIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { usePrototypeIdentity } from "../_shared/identity";
import { microphoneNotice } from "./microphone-copy";
import { planSample, sameTranscript, storiesDueAt, transcriptAt } from "./sample-answer";
import {
  BASE_FACTS,
  CHAPTERS,
  NIGHT_SHIFT_FIX,
  SAMPLE_ANSWER,
  SAMPLE_CHAPTER,
  SHELF,
  STORY_FACTS,
  coverageFor,
  type ChapterId,
} from "./script";

const SILENT: LiveVoiceSignal = { amplitude: 0, centroid: 0, pitchDelta: 0 };
/** A breath between the question being read and the sample answer starting. */
const ANSWER_LEAD_MS = 450;
/** How long "Writing down your answer" shows after an answer ends. */
const PROCESSING_MS = 900;
/** Seeds the synthetic voice, so every replay draws the same Voiceprint. */
const SAMPLE_SEED = 3;

const questionOf = (id: ChapterId) => CHAPTERS.find((chapter) => chapter.id === id)?.question ?? "";

interface Reading {
  text: string;
  timings: WordTiming[];
  clock: PlaybackClock;
}

/** A simulated read-aloud of `text`, as TTS word timestamps and a playback clock. */
function startReading(text: string): Reading {
  const origin = performance.now();
  return {
    text,
    timings: estimateWordTimings(text, { startMs: 250 }),
    clock: () => performance.now() - origin,
  };
}

/**
 * Story Studio prototype (spec §5.2, §6.7, §6.10 B): speaking to your Voiceprint, with the
 * story-capture flight as the hero moment. Fake data throughout.
 */
export function StudioPrototype() {
  return (
    <StoryCaptureProvider initialStories={SHELF}>
      <StudioScreen />
    </StoryCaptureProvider>
  );
}

type Panel = "transcript" | "microphone" | "write";

function StudioScreen() {
  const [identity] = usePrototypeIdentity();
  const { stories, count, ignited, capture, reset } = useStoryCapture();
  const mic = useMicrophone();
  const shelfLinkRef = useShelfFallbackRef();
  const panelId = useId();
  const answerId = useId();

  const [chapter, setChapter] = useState<ChapterId>(SAMPLE_CHAPTER);
  const [reading, setReading] = useState<Reading | null>(null);
  const [panel, setPanel] = useState<Panel>("transcript");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [written, setWritten] = useState(0);
  const [draft, setDraft] = useState("");
  const [hurry, setHurry] = useState(false);
  const [notice, setNotice] = useState("");
  const [processing, setProcessing] = useState(false);

  // The microphone: allowed once from the explanation panel, then recording on every press.
  const [micAllowed, setMicAllowed] = useState(false);
  const [wantsMic, setWantsMic] = useState(false);

  // The sample answer: queued behind the question, then played from `sampleStart`.
  const plan = useMemo(() => planSample(SAMPLE_ANSWER), []);
  const [sampleQueued, setSampleQueued] = useState(false);
  const [sampleStart, setSampleStart] = useState<number | null>(null);
  const sampleSignal = useRef<LiveVoiceSignal>({ ...SILENT });

  const panelRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const previousPanel = useRef<Panel>("transcript");
  const noticeId = useId();

  const processingTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(processingTimer.current), []);

  const question = questionOf(chapter);
  const sampling = sampleStart !== null;
  const micRecording = wantsMic && mic.status === "live";
  const recording = sampling || micRecording;
  const micTrouble =
    wantsMic && (mic.status === "denied" || mic.status === "unsupported" || mic.status === "error");
  // The explanation stays up while the browser asks, and gives way once the microphone is live.
  const shownPanel: Panel = micTrouble
    ? "microphone"
    : panel === "microphone" && micRecording
      ? "transcript"
      : panel;

  // The first question is read aloud once the page is on screen (the clock starts on the client).
  const readFirstQuestion = useEffectEvent(() => setReading(startReading(questionOf(chapter))));
  useEffect(() => {
    const frame = requestAnimationFrame(() => readFirstQuestion());
    return () => cancelAnimationFrame(frame);
  }, []);

  const finishAnswer = () => {
    setProcessing(true);
    window.clearTimeout(processingTimer.current);
    processingTimer.current = window.setTimeout(() => setProcessing(false), PROCESSING_MS);
  };

  const stopSample = () => {
    setSampleQueued(false);
    setSampleStart(null);
  };

  // Plays the scripted answer: transcript phrases, the synthetic voice and the story capture all
  // come from one timeline, read every frame. React only hears about real transcript changes.
  const sampleEnded = useEffectEvent(() => {
    setSampleStart(null);
    finishAnswer();
  });
  const captureStory = useEffectEvent((segmentId: string) => {
    const segment = plan.segments.find((s) => s.id === segmentId);
    if (segment?.story) capture(segment.story, { sourceId: segment.id });
  });
  useEffect(() => {
    if (sampleStart === null) return;
    const signal = sampleSignal.current;
    const captured = new Set<string>();
    let shown: TranscriptSegment[] = [];
    let frame = 0;
    const tick = (now: number) => {
      const ms = now - sampleStart;
      Object.assign(signal, ms >= 0 ? syntheticSignalAt(plan.spans, ms, SAMPLE_SEED) : SILENT);
      const next = transcriptAt(plan, Math.max(0, ms));
      if (!sameTranscript(shown, next)) {
        shown = next;
        setSegments(next);
      }
      for (const segment of storiesDueAt(plan, ms)) {
        if (captured.has(segment.id)) continue;
        captured.add(segment.id);
        captureStory(segment.id);
      }
      if (ms >= plan.endMs) {
        sampleEnded();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      Object.assign(signal, SILENT);
    };
  }, [sampleStart, plan]);

  const openChapter = (id: ChapterId, message = "") => {
    stopSample();
    setChapter(id);
    setReading(startReading(questionOf(id)));
    setNotice(message);
  };

  const onReadingEnd = () => {
    setReading(null);
    if (sampleQueued) {
      setSampleQueued(false);
      setSampleStart(performance.now() + ANSWER_LEAD_MS);
    }
  };

  const playSample = () => {
    if (sampling || sampleQueued) {
      stopSample();
      return;
    }
    if (micRecording) {
      setWantsMic(false);
      mic.stop();
    }
    // A replay starts from the same shelf, so the capture can be watched again.
    reset(SHELF);
    setSegments([]);
    setPanel("transcript");
    setChapter(SAMPLE_CHAPTER);
    setReading(startReading(questionOf(SAMPLE_CHAPTER)));
    setSampleQueued(true);
    setNotice("");
    // The answer is written under the Voiceprint, below the fold of a laptop screen when the
    // sample is started from up here. Bring it into view (once the transcript is back in place),
    // so the phrase that ignites and its flight to the shelf can be seen. Nothing scrolls if it
    // is already on screen, and with reduced motion the page simply jumps.
    requestAnimationFrame(() => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({
        block: "nearest",
        behavior: still ? "instant" : "smooth",
      });
    });
  };

  const startTalking = () => {
    stopSample();
    if (!micAllowed || mic.status === "denied" || mic.status === "unsupported") {
      setPanel("microphone");
      return;
    }
    setPanel("transcript");
    setWantsMic(true);
    void mic.start();
  };

  const allowMicrophone = () => {
    setMicAllowed(true);
    setWantsMic(true);
    void mic.start();
  };

  const stopTalking = () => {
    if (sampling || sampleQueued) {
      stopSample();
      finishAnswer();
      return;
    }
    if (!wantsMic) return;
    setWantsMic(false);
    setPanel("transcript");
    mic.stop();
    finishAnswer();
  };

  const writeInstead = () => {
    stopSample();
    if (wantsMic) {
      setWantsMic(false);
      mic.stop();
    }
    setPanel((current) => (current === "write" ? "transcript" : "write"));
  };

  const saveWritten = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSegments((current) => [...current, { id: `written-${written}`, text, final: true }]);
    setWritten((n) => n + 1);
    setDraft("");
    setPanel("transcript");
    setNotice("Answer saved.");
  };

  const skip = () => {
    const index = CHAPTERS.findIndex((c) => c.id === chapter);
    const current = CHAPTERS[index];
    const next = CHAPTERS[(index + 1) % CHAPTERS.length];
    if (!current || !next) return;
    openChapter(
      next.id,
      `Moved on to ${next.label}. You can come back to ${current.label} any time.`,
    );
  };

  const signal: VoiceSignalRef | null = sampling
    ? (sampleSignal as VoiceSignalRef)
    : micRecording
      ? mic.signal
      : null;
  const mood: VoiceprintMood = reading ? "listening" : recording ? "speaking" : "idle";
  const recordState: RecordButtonState = processing
    ? "processing"
    : recording
      ? "listening"
      : wantsMic && mic.status === "error"
        ? "error"
        : "idle";
  const recordStatus =
    wantsMic && mic.status === "requesting"
      ? "Waiting for your browser's permission"
      : sampleQueued
        ? "The sample answer starts after the question"
        : undefined;

  const hasStory = stories.some((story) => story.id === NIGHT_SHIFT_FIX.id);
  const facts = BASE_FACTS + (hasStory ? STORY_FACTS : 0) + written;
  const micNotice = microphoneNotice(mic.status === "live" ? "idle" : mic.status, APP_NAME);
  const noticeKind = shownPanel === "microphone" ? micNotice?.kind : undefined;

  // Focus follows the panel: into the text box, onto the microphone choice, and back to the record
  // button when the control that had focus has gone (an answer saved, the microphone now live).
  useEffect(() => {
    const previous = previousPanel.current;
    previousPanel.current = shownPanel;
    if (previous === shownPanel && shownPanel !== "microphone") return;
    if (shownPanel === "write") panelRef.current?.querySelector("textarea")?.focus();
    else if (shownPanel === "microphone") panelRef.current?.querySelector("button")?.focus();
    else if (!document.activeElement || document.activeElement === document.body) {
      recordRef.current?.querySelector("button")?.focus();
    }
  }, [shownPanel, noticeKind]);

  return (
    <div className="mx-auto grid w-full max-w-[90rem] flex-1 gap-10 px-4 pt-4 pb-28 sm:px-8 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 lg:pb-12">
      <h1 className="sr-only">Story Studio</h1>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <ChapterTabs
            chapters={CHAPTERS}
            value={chapter}
            onChange={(id) => openChapter(id)}
            panelId={panelId}
          />
          {/* For screen-recording reviews: a scripted, fictional answer with no microphone. */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              variant="secondary"
              size="sm"
              icon={sampling || sampleQueued ? StopIcon : PlayIcon}
              onClick={playSample}
              aria-describedby={`${panelId}-sample-note`}
            >
              {sampling || sampleQueued ? "Stop sample answer" : "Play sample answer"}
            </Button>
            <span id={`${panelId}-sample-note`} className="text-sm text-text-soft">
              A fictional applicant
            </span>
          </div>
        </div>

        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={chapterTabId(panelId, chapter)}
          className="flex flex-col items-center gap-6 sm:gap-8"
        >
          {/* Two lines reserved, so a shorter question never pulls the stage up. */}
          <div className="min-h-[2.3em] w-full max-w-4xl self-start font-reading text-[length:clamp(1.75rem,1rem+2.6vw,3.5rem)]">
            <SpokenQuestion
              text={question}
              timings={reading?.text === question ? reading.timings : null}
              clock={reading?.text === question ? reading.clock : null}
              onReadingEnd={onReadingEnd}
            />
          </div>

          <div className="relative aspect-square w-[min(64vw,34dvh,26rem)] sm:w-[min(48vw,40dvh,26rem)]">
            <Voiceprint
              identity={identity}
              signal={signal}
              mood={mood}
              size="fill"
              label="Your Voiceprint"
            />
          </div>

          <div ref={panelRef} className="w-full max-w-3xl scroll-mb-24 lg:scroll-mb-6">
            {shownPanel === "write" ? (
              <form onSubmit={saveWritten} className="flex flex-col gap-3">
                <Label htmlFor={answerId}>Your answer</Label>
                <textarea
                  id={answerId}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={4}
                  className="min-h-32 w-full resize-y rounded-control border border-control bg-depth px-3 py-2 font-reading text-read text-text placeholder:text-text-soft"
                  placeholder="Write as much as you like. Paste is fine."
                />
                <Button type="submit" className="self-start" disabled={draft.trim() === ""}>
                  Save answer
                </Button>
              </form>
            ) : shownPanel === "microphone" && micNotice ? (
              <div className="flex min-h-32 flex-col justify-end gap-4">
                <p id={noticeId} className="text-base text-text">
                  {micNotice.message}
                </p>
                <div className="flex flex-wrap gap-3">
                  {micNotice.kind === "ask" ? (
                    <Button
                      icon={MicrophoneIcon}
                      onClick={allowMicrophone}
                      loading={mic.status === "requesting"}
                      aria-describedby={noticeId}
                    >
                      Allow microphone
                    </Button>
                  ) : null}
                  {micNotice.kind === "failed" ? (
                    <Button
                      icon={MicrophoneIcon}
                      onClick={allowMicrophone}
                      aria-describedby={noticeId}
                    >
                      Try the microphone again
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    icon={PencilSimpleLineIcon}
                    onClick={writeInstead}
                    aria-describedby={micNotice.kind === "ask" ? undefined : noticeId}
                  >
                    Write instead
                  </Button>
                </div>
              </div>
            ) : (
              <LiveTranscript
                segments={segments}
                ignitedIds={ignited}
                signal={signal}
                label="Your answer"
                className="h-32 sm:h-40"
                empty={
                  micRecording ? (
                    <p className="text-base">
                      Your Voiceprint is listening. This prototype doesn&apos;t write down live
                      speech yet; play the sample answer to see the transcript.
                    </p>
                  ) : (
                    <p className="text-base">
                      Answer out loud. Your words will appear here as you speak.
                    </p>
                  )
                }
              />
            )}
          </div>

          <div className="flex w-full max-w-3xl flex-col items-center gap-4">
            <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
              <div ref={recordRef}>
                <RecordButton
                  state={recordState}
                  onStart={startTalking}
                  onStop={stopTalking}
                  signal={signal}
                  status={recordStatus}
                />
              </div>
              <div className="flex h-20 items-center gap-2">
                {/* aria-disabled, not disabled: focus stays put when an answer ends. */}
                <Button
                  variant="secondary"
                  onClick={stopTalking}
                  aria-disabled={!recording && !sampleQueued}
                >
                  Done
                </Button>
                <Button
                  variant="quiet"
                  icon={PencilSimpleLineIcon}
                  onClick={writeInstead}
                  aria-pressed={panel === "write"}
                >
                  Write instead
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="quiet" onClick={skip}>
                Skip for now
              </Button>
              <Button variant="quiet" onClick={() => setHurry((on) => !on)} aria-pressed={hurry}>
                I&apos;m short on time
              </Button>
            </div>
            {/* Reserved line: notices never push the page. */}
            <p role="status" className="min-h-[2lh] max-w-prose text-center text-sm text-text-soft">
              {hurry
                ? "Short on time: from here on, only the questions your schools need. About 20 minutes to a draft-ready dossier."
                : notice}
            </p>
          </div>
        </section>
      </div>

      {/* Never taller than the screen beside the Studio, so it stays put as the page scrolls and
          the top of the shelf, where a captured story lands, is always in view. */}
      <aside
        id="shelf"
        aria-label="Your stories"
        className="plane flex h-fit flex-col gap-8 p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]"
      >
        <StoryShelf />
        <CoverageMeter lenses={coverageFor(hasStory)} headingLevel={2} />
        <p className="text-sm text-text tabular-nums">{facts} facts captured</p>
      </aside>

      {/* Phones: the shelf sits below the Studio, so this link is where flights land. */}
      <a
        ref={shelfLinkRef}
        href="#shelf"
        className="fixed right-4 bottom-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-depth px-4 text-base font-medium text-text shadow-overlay lg:hidden"
      >
        Your shelf <span className="text-text-soft tabular-nums">({count})</span>
      </a>
    </div>
  );
}
