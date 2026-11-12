"use client";

// The hero's only first-load code (plan §9.1.2): the state machine, the two actions, and the
// gates that decide when anything heavier loads.
//
//   the live Voiceprint   ./hero-voiceprint (lazy): desktop after load, on idle, while the hero is
//                          in view; phones on the first touch, scroll or key; never under reduced
//                          motion (the poster stays). Also when the visitor's own form arrives.
//   everything else       ./hero-experience (lazy): the sample, writing, the sheet and the flight. Prefetched when a pointer or focus reaches an
//                          action, so it is usually there by the time of the tap.
//
// Imports are kept to React, small local modules and types: no Motion, no Radix, no icons.

import type { LiveVoiceSignal, VoiceprintIdentity, VoiceprintMood } from "@admitstory/ui";
import { Suspense, lazy, useEffect, useReducer, useRef, useState } from "react";
import { HERO_ACTIONS, HERO_COPY } from "../_copy/hero";
import { PHONE_QUERY, REDUCED_MOTION_QUERY, rendererGate } from "../_lib/gates";
import { INITIAL_HERO_STATE, heroReducer, type HeroState } from "./hero-state";
import { ACTIONS_BOX, PLAY_CLASSES, PlayGlyph } from "./hero-ui";

const loadExperience = () => import("./hero-experience");
const HeroExperience = lazy(loadExperience);
const HeroVoiceprint = lazy(() => import("./hero-voiceprint"));

function matches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

const DIM_PHASES = new Set<HeroState["phase"]>(["sample"]);

export function HeroStage() {
  const [state, dispatch] = useReducer(heroReducer, INITIAL_HERO_STATE);
  const signal = useRef<LiveVoiceSignal>({ amplitude: 0, centroid: 0, pitchDelta: 0 });
  const [identity, setIdentity] = useState<VoiceprintIdentity | null>(null);
  const [mood, setMood] = useState<VoiceprintMood>("idle");
  const [rendererOpen, setRendererOpen] = useState(false);
  const playRef = useRef<HTMLButtonElement>(null);
  const previousPhase = useRef(state.phase);

  // Back to idle (Escape, Cancel, "Try another line"): focus returns to the main control instead
  // of falling to the page.
  useEffect(() => {
    const was = previousPhase.current;
    previousPhase.current = state.phase;
    if (state.phase !== "idle" || was === "idle") return;
    playRef.current?.focus({ preventScroll: true });
  }, [state.phase]);

  // The renderer gate (direction §10). A rAF loop before idle would starve requestIdleCallback,
  // so nothing animates until the gate opens.
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    const phone = matches(PHONE_QUERY);
    const input = {
      phone,
      loaded: document.readyState === "complete",
      idle: false,
      interacted: false,
      heroInView: true,
      tier: null,
      reducedMotion: matches(REDUCED_MOTION_QUERY),
    };
    const check = () => {
      if (rendererGate(input) === "load") {
        setRendererOpen(true);
        cleanup();
      }
    };
    if (rendererGate(input) === "never") return;
    const cleanups: (() => void)[] = [];
    const cleanup = () => cleanups.splice(0).forEach((fn) => fn());

    if (phone) {
      const interact = () => {
        input.interacted = true;
        check();
      };
      for (const type of ["pointerdown", "keydown", "scroll"] as const) {
        window.addEventListener(type, interact, { once: true, passive: true });
        cleanups.push(() => window.removeEventListener(type, interact));
      }
      return cleanup;
    }
    const observer = new IntersectionObserver(([entry]) => {
      input.heroInView = entry?.isIntersecting ?? false;
      check();
    });
    observer.observe(hero);
    cleanups.push(() => observer.disconnect());
    const idle = () => {
      const run = () => {
        input.loaded = true;
        input.idle = true;
        check();
      };
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(run, { timeout: 3000 });
        cleanups.push(() => window.cancelIdleCallback(id));
      } else {
        const id = window.setTimeout(run, 1200);
        cleanups.push(() => window.clearTimeout(id));
      }
    };
    if (input.loaded) idle();
    else {
      window.addEventListener("load", idle, { once: true });
      cleanups.push(() => window.removeEventListener("load", idle));
    }
    return cleanup;
  }, []);

  // While the sample plays, the H1 and subline dim (marketing.css).
  useEffect(() => {
    document.getElementById("hero")?.toggleAttribute("data-dim", DIM_PHASES.has(state.phase));
  }, [state.phase]);

  const prefetch = () => void loadExperience().catch(() => {});
  const play = () => {
    void loadExperience().catch(() => {});
    dispatch({ type: "sample" });
  };
  const live = rendererOpen || identity !== null;

  return (
    <div onPointerEnter={prefetch} onFocusCapture={prefetch}>
      {live ? (
        <Suspense fallback={null}>
          <HeroVoiceprint identity={identity} signal={signal} mood={mood} />
        </Suspense>
      ) : null}
      {state.phase === "idle" ? (
        <div className={ACTIONS_BOX}>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <button ref={playRef} type="button" className={PLAY_CLASSES.button} onClick={play}>
              <span className={PLAY_CLASSES.circle}>
                <PlayGlyph />
              </span>
              {HERO_ACTIONS.play}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-control px-3 text-base text-signal underline-offset-4 hover:underline"
              onClick={() => dispatch({ type: "write" })}
            >
              {HERO_ACTIONS.write}
            </button>
          </div>
          <p className="mt-4 max-w-[34rem] text-sm text-text-soft">{HERO_COPY.note}</p>
        </div>
      ) : (
        <Suspense fallback={<div className={ACTIONS_BOX} />}>
          <HeroExperience
            state={state}
            dispatch={dispatch}
            signal={signal}
            identity={identity}
            setIdentity={setIdentity}
            setMood={setMood}
          />
        </Suspense>
      )}
    </div>
  );
}
