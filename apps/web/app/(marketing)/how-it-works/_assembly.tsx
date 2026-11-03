"use client";

// The assembly on /how-it-works (direction §6): the real KitAssembly driving the prototype's
// scripted run. The server HTML is the finished kit (threads drawn, openings present). Once the
// section is 40% in view it plays once, three times faster than the prototype, then offers "Play
// again". With reduced motion it never starts on its own; "Play again" still works, and KitAssembly
// itself keeps the form still and the threads opacity-only. Loaded by ./_assembly-island, which
// only exists from 1024 px.

import { KitAssembly } from "@admitstory/ui";
import { useEffect, useRef, useState } from "react";
import { SAMPLE_IDENTITY } from "../_data/sample";
import { KIT_DURATION_MS, STORIES, kitStateAt } from "./_data";

const SPEED = 3;
const TICK_MS = 100;
const START_RATIO = 0.4;

export interface AssemblyPlayerProps {
  deliverablesHeading: string;
  playAgain: string;
}

export default function AssemblyPlayer({ deliverablesHeading, playAgain }: AssemblyPlayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(KIT_DURATION_MS);
  const [playing, setPlaying] = useState(false);

  // Play once, the first time the section is 40% in view.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= START_RATIO)) return;
        observer.disconnect();
        setElapsed(0);
        setPlaying(true);
      },
      { threshold: START_RATIO },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const origin = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(KIT_DURATION_MS, (performance.now() - origin) * SPEED);
      setElapsed(next);
      if (next >= KIT_DURATION_MS) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const state = kitStateAt(elapsed);
  const finished = elapsed >= KIT_DURATION_MS;

  return (
    <div ref={ref}>
      <KitAssembly
        identity={SAMPLE_IDENTITY}
        stories={STORIES}
        deliverables={state.deliverables}
        stages={state.stages}
        deliverablesHeading={deliverablesHeading}
      />
      <div className="mt-6 flex min-h-11 justify-end">
        {finished && !playing ? (
          <button
            type="button"
            onClick={() => {
              setElapsed(0);
              setPlaying(true);
            }}
            className="inline-flex min-h-11 items-center text-signal underline-offset-4 decoration-1 hover:underline focus-visible:underline"
          >
            {playAgain}
          </button>
        ) : null}
      </div>
    </div>
  );
}
