"use client";

import {
  Button,
  DrawerContent,
  Drawer,
  GapQuestionsPlane,
  KitAssembly,
  TextField,
} from "@admitstory/ui";
import { ArrowClockwiseIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { usePrototypeIdentity } from "../_shared/identity";
import {
  GAP_QUESTIONS,
  KIT_DURATION_MS,
  POSITIONING_POINTS,
  SCHOOL,
  STORIES,
  fileMapSummary,
  kitStateAt,
} from "./script";

const TICK_MS = 100;

/**
 * A clock for the scripted run: elapsed milliseconds that can pause, resume and restart. Ticks a
 * few times a second; the assembly only changes on whole sentences and stage changes, and every
 * animation inside runs on its own springs.
 */
function useScriptClock(startAt: number) {
  const [elapsed, setElapsed] = useState(startAt);
  const [playing, setPlaying] = useState(startAt < KIT_DURATION_MS);
  const origin = useRef(0);

  useEffect(() => {
    if (!playing) return;
    origin.current = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const next = Math.min(KIT_DURATION_MS, performance.now() - origin.current);
      setElapsed(next);
      if (next >= KIT_DURATION_MS) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // Elapsed is read once when play starts; the interval owns it afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return {
    elapsed,
    playing,
    finished: elapsed >= KIT_DURATION_MS,
    toggle: () => setPlaying((value) => !value),
    replay: () => {
      setElapsed(0);
      origin.current = performance.now();
      setPlaying(true);
    },
  };
}

type GapMode = "choices" | "typing" | "voice" | "skipped" | "saved";
type Reading = "positioning" | "file-map" | null;

export function KitPrototype({ startAt }: { startAt: number }) {
  const [identity] = usePrototypeIdentity();
  const clock = useScriptClock(startAt);
  const state = kitStateAt(clock.elapsed);
  const [gapMode, setGapMode] = useState<GapMode>("choices");
  const [reading, setReading] = useState<Reading>(null);
  const seconds = Math.floor(clock.elapsed / 1000);

  const replay = () => {
    setGapMode("choices");
    clock.replay();
  };

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-4 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-display-sm text-text">
            {SCHOOL.name} {SCHOOL.cycle} kit
          </h1>
          <p className="text-lg text-text-soft">
            Built from your 9 stories and 61 facts. Start reading whatever is ready while the rest
            drafts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-soft tabular-nums">
            Scripted run, {seconds} of {KIT_DURATION_MS / 1000} seconds
          </p>
          <Button
            variant="secondary"
            icon={clock.playing ? PauseIcon : PlayIcon}
            onClick={clock.toggle}
            disabled={clock.finished}
          >
            {clock.playing ? "Pause" : "Resume"}
          </Button>
          <Button variant="secondary" icon={ArrowClockwiseIcon} onClick={replay}>
            Replay
          </Button>
        </div>
      </div>

      <KitAssembly
        identity={identity}
        stories={STORIES}
        deliverables={state.deliverables}
        stages={state.stages}
        deliverablesHeading={`What ${SCHOOL.short} asks for`}
        onStageAction={(id) => setReading(id === "positioning" ? "positioning" : "file-map")}
        aside={
          <GapQuestionsPlane
            count={state.gapCount}
            onAnswerByVoice={() => setGapMode("voice")}
            onTypeAnswers={() => setGapMode("typing")}
            onSkip={() => setGapMode("skipped")}
          >
            {state.gapCount === null || gapMode === "choices" ? undefined : (
              <GapFollowUp mode={gapMode} onMode={setGapMode} />
            )}
          </GapQuestionsPlane>
        }
      />

      <Drawer open={reading !== null} onOpenChange={(open) => (open ? null : setReading(null))}>
        <DrawerContent
          title={reading === "positioning" ? "Positioning" : "File map"}
          description={
            reading === "positioning"
              ? `What ${SCHOOL.short} must see, and how your file shows it.`
              : "The story that leads each part of your application."
          }
        >
          {reading === "positioning" ? (
            <ul className="flex list-disc flex-col gap-3 pl-5 font-reading text-read text-text">
              {POSITIONING_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : (
            <dl className="flex flex-col divide-y divide-edge">
              {fileMapSummary().map((row) => (
                <div key={row.title} className="flex flex-col gap-0.5 py-3">
                  <dt className="font-medium text-text">{row.title}</dt>
                  <dd className="text-text-soft">From your story {row.story}</dd>
                </div>
              ))}
            </dl>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** What the gap plane shows once a choice is made. Fake: nothing leaves the page. */
function GapFollowUp({ mode, onMode }: { mode: GapMode; onMode: (mode: GapMode) => void }) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const formId = useId();

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [mode]);

  if (mode === "skipped" || mode === "saved") {
    return (
      <p ref={headingRef} tabIndex={-1} className="text-text-soft outline-none">
        {mode === "saved"
          ? "Answers saved. The drafts will use them."
          : "Drafting with gaps. Each gap becomes a question inside its draft, so you can answer it later."}
      </p>
    );
  }

  if (mode === "voice") {
    return (
      <div className="flex flex-col gap-4">
        <p ref={headingRef} tabIndex={-1} className="text-text-soft outline-none">
          In the product you answer these out loud, one at a time. This prototype shows the
          questions only.
        </p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 font-reading text-read text-text">
          {GAP_QUESTIONS.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onMode("typing")}>
            Type answers instead
          </Button>
          <Button variant="quiet" onClick={() => onMode("skipped")}>
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onMode("saved");
  };

  return (
    <form id={formId} onSubmit={save} className="flex flex-col gap-4">
      <p ref={headingRef} tabIndex={-1} className="text-text-soft outline-none">
        A sentence or two each is plenty. Leave any you can’t answer yet.
      </p>
      {GAP_QUESTIONS.map((question) => (
        <TextField key={question} label={question} name={question} autoComplete="off" />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save answers</Button>
        <Button variant="quiet" onClick={() => onMode("skipped")}>
          Skip for now
        </Button>
      </div>
    </form>
  );
}
