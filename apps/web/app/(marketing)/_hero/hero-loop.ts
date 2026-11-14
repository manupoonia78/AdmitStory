// The hero's loop (SPEC §3.5), loaded lazily by ./hero-loop-gate. Plain DOM: no React, no Motion.
// It takes over the poster the server rendered and plays, about eleven seconds a pass:
//
//   hold → the sheets leave, the line settles → rest → the next applicant speaks, word by word,
//   the line moving with the voice → the line settles → three sheets rise from it → the spoken
//   sentence is marked on the top sheet → the margin notes appear → hold
//
// One clock drives everything, and it only advances inside requestAnimationFrame. So when the
// hero is off screen, the tab is hidden or the visitor presses pause, the frame loop is cancelled
// and the running animations are paused: zero frames, and it resumes from the same instant.
//
// The line is one canvas stroke a frame. Words, sheets and notes are DOM, moved with the Web
// Animations API on transform, opacity and (words only) filter. Each animation runs *from* a start
// state *to* the element's own style, so if anything is cancelled the element is simply at rest.

import { syntheticSignalAt, type VoicedSpan } from "@admitstory/ui";
import {
  LINE_BASE,
  LINE_HEIGHT,
  LINE_LG,
  LINE_STROKE,
  POSTER,
  lineAt,
  lineSegments,
  type LineForm,
} from "./voiceline-shape";

const EASE_RISE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_EXIT = "cubic-bezier(0.4, 0, 1, 1)";
const EASE_LINE = "cubic-bezier(0.65, 0, 0.35, 1)";

/** The times of one pass, in milliseconds. */
const T = {
  firstHold: 2400,
  hold: 3000,
  sheetLeave: 500,
  sheetLeaveGap: 60,
  leave: 1000,
  rest: 400,
  word: 420,
  settle: 900,
  sheetRise: 680,
  sheetRiseGap: 120,
  mark: 1000,
  markDraw: 500,
  notes: 1200,
  noteGap: 150,
  note: 300,
  risen: 1800,
} as const;

/** How dim the sentence rests once its sheets are up. */
const SAID_REST = "0.64";

interface Sample {
  fan: HTMLElement;
  say: HTMLElement;
  who: HTMLElement | null;
  words: HTMLElement[];
  spans: VoicedSpan[];
  sheets: HTMLElement[];
  notes: HTMLElement[];
  mark: HTMLElement | null;
}

function all(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

function readSample(fan: HTMLElement, say: HTMLElement): Sample {
  const words = all(say, "[data-w]");
  return {
    fan,
    say,
    who: say.querySelector<HTMLElement>("[data-hero-who]"),
    words,
    spans: words.map((word) => ({
      startMs: Number(word.dataset.s) || 0,
      endMs: Number(word.dataset.e) || 0,
    })),
    sheets: all(fan, "[data-hero-sheet]"),
    notes: all(fan, "[data-hero-note]"),
    mark: fan.querySelector<HTMLElement>("[data-hero-mark]"),
  };
}

/** Starts the loop on the server-rendered hero. Returns the function that stops it for good. */
export function startHeroLoop(hero: HTMLElement): () => void {
  const horizon = hero.querySelector<HTMLElement>("[data-hero-horizon]");
  const canvas = horizon?.querySelector("canvas");
  const context = canvas?.getContext("2d");
  const fans = all(hero, "[data-hero-fan]");
  const says = all(hero, "[data-hero-say]");
  if (!horizon || !canvas || !context || fans.length < 2 || fans.length !== says.length) {
    return () => {};
  }
  // Named again so the functions below see them as present, not possibly missing.
  const line: HTMLElement = horizon;
  const surface: HTMLCanvasElement = canvas;
  const pen: CanvasRenderingContext2D = context;
  const samples = fans.map((fan, index) => readSample(fan, says[index] as HTMLElement));
  const pauseButton = hero.querySelector<HTMLButtonElement>("[data-hero-pause]");
  const wide = window.matchMedia("(min-width: 64rem)");
  const drift =
    getComputedStyle(document.documentElement).getPropertyValue("--spring-drift").trim() ||
    EASE_RISE;

  // ----- The clock and its queue ---------------------------------------------------------------

  let clock = 0;
  let queue: { at: number; run: () => void }[] = [];
  const after = (ms: number, run: () => void) => {
    queue.push({ at: clock + ms, run });
  };

  const running = new Set<Animation>();
  function animate(
    element: HTMLElement,
    from: Keyframe,
    duration: number,
    easing: string,
  ): Animation | null {
    let animation: Animation;
    try {
      animation = element.animate([{ ...from, offset: 0 }], { duration, easing });
    } catch {
      // An engine that can't parse linear() gets the plain ease.
      try {
        animation = element.animate([{ ...from, offset: 0 }], { duration, easing: EASE_RISE });
      } catch {
        return null;
      }
    }
    running.add(animation);
    const done = () => running.delete(animation);
    animation.addEventListener("finish", done);
    animation.addEventListener("cancel", done);
    return animation;
  }

  // ----- The line ------------------------------------------------------------------------------

  let form: LineForm = LINE_LG;
  let cssWidth = 0;
  let ratio = 1;
  let stroke: CanvasGradient | string = "";
  /** The speaking level drawn now, 0 to 1, and what it is heading for. */
  let level: number = POSTER.level;
  /** Seconds along the wave. Frozen at the poster's moment until the first sentence. */
  let waveTime: number = POSTER.t;
  let poster = true;
  let speaking: { from: number; spans: VoicedSpan[] } | null = null;
  let holding = true;
  let flatDrawn = false;

  function measure() {
    form = wide.matches ? LINE_LG : LINE_BASE;
    cssWidth = line.clientWidth;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    surface.width = Math.round(cssWidth * ratio);
    surface.height = Math.round(LINE_HEIGHT * ratio);
    const style = getComputedStyle(line);
    const neutral = style.getPropertyValue("--hero-line").trim() || "rgb(244 241 234 / 0.2)";
    const brass = style.getPropertyValue("--accent").trim() || "#e2b36b";
    try {
      const gradient = pen.createLinearGradient(0, 0, surface.width, 0);
      gradient.addColorStop(0, neutral);
      gradient.addColorStop(form.tint[0], neutral);
      gradient.addColorStop(form.tint[1], brass);
      gradient.addColorStop(1, brass);
      stroke = gradient;
    } catch {
      stroke = brass;
    }
    flatDrawn = false;
    draw();
  }

  function draw() {
    const width = surface.width;
    const mid = surface.height / 2;
    const start = form.rise[0];
    // The poster is drawn for its reference width so it matches the SVG it replaces exactly.
    const shapeWidth = poster ? form.ref : cssWidth;
    const height = form.amp * ratio * level;
    pen.clearRect(0, 0, width, surface.height);
    pen.beginPath();
    pen.moveTo(0, mid);
    pen.lineTo(start * width, mid);
    if (level > 0.002) {
      const count = lineSegments(shapeWidth, form);
      for (let i = 1; i <= count; i += 1) {
        const x = start + ((1 - start) * i) / count;
        pen.lineTo(x * width, mid + height * lineAt(x, shapeWidth, waveTime, form));
      }
    } else {
      pen.lineTo(width, mid);
    }
    pen.strokeStyle = stroke;
    pen.lineWidth = LINE_STROKE * ratio;
    pen.lineJoin = "round";
    pen.stroke();
    flatDrawn = level <= 0.002;
  }

  // ----- One pass ------------------------------------------------------------------------------

  let current = 0;

  function hold(ms: number) {
    holding = true;
    after(ms, leave);
  }

  function leave() {
    holding = false;
    const sample = samples[current] as Sample;
    sample.sheets.forEach((sheet, index) => {
      after(index * T.sheetLeaveGap, () => {
        sheet.style.opacity = "0";
        animate(sheet, { opacity: 1, translate: "0 0" }, T.sheetLeave, EASE_EXIT);
        sheet.style.translate = "0 calc(-12 * var(--u))";
      });
    });
    const resting = getComputedStyle(sample.say).opacity;
    sample.say.style.opacity = "0";
    animate(sample.say, { opacity: resting }, 400, EASE_EXIT);
    after(T.leave, rest);
  }

  function rest() {
    const previous = samples[current] as Sample;
    current = (current + 1) % samples.length;
    const sample = samples[current] as Sample;
    poster = false;
    level = 0;
    waveTime = 0;

    previous.fan.setAttribute("data-off", "");
    previous.say.setAttribute("data-off", "");
    for (const sheet of sample.sheets) {
      sheet.style.opacity = "0";
      sheet.style.translate = "";
    }
    for (const note of sample.notes) note.style.opacity = "0";
    if (sample.mark) sample.mark.style.backgroundSize = "0% 100%, 0% 1.25px";
    for (const word of sample.words) word.style.opacity = "0";
    if (sample.who) sample.who.style.opacity = "0";
    sample.say.style.opacity = "";
    sample.fan.removeAttribute("data-off");
    sample.say.removeAttribute("data-off");
    after(T.rest, speak);
  }

  function speak() {
    const sample = samples[current] as Sample;
    speaking = { from: clock, spans: sample.spans };
    if (sample.who) {
      sample.who.style.opacity = "";
      animate(sample.who, { opacity: 0 }, 300, EASE_RISE);
    }
    sample.words.forEach((word, index) => {
      after(sample.spans[index]?.startMs ?? 0, () => {
        word.style.opacity = "";
        animate(
          word,
          { opacity: 0, transform: "translateY(10px)", filter: "blur(6px)" },
          T.word,
          EASE_RISE,
        );
      });
    });
    after(sample.spans.at(-1)?.endMs ?? 0, () => {
      speaking = null;
      after(T.settle, rise);
    });
  }

  function rise() {
    const sample = samples[current] as Sample;
    sample.sheets.forEach((sheet, index) => {
      after(index * T.sheetRiseGap, () => {
        sheet.style.opacity = "";
        animate(
          sheet,
          { opacity: 0, translate: "0 calc(60 * var(--u))", rotate: "0deg", scale: "0.96" },
          T.sheetRise,
          drift,
        );
      });
    });
    sample.say.style.opacity = SAID_REST;
    animate(sample.say, { opacity: 1 }, 600, EASE_LINE);
    after(T.mark, () => {
      if (!sample.mark) return;
      sample.mark.style.backgroundSize = "";
      animate(sample.mark, { backgroundSize: "0% 100%, 0% 1.25px" }, T.markDraw, EASE_LINE);
    });
    sample.notes.forEach((note, index) => {
      after(T.notes + index * T.noteGap, () => {
        note.style.opacity = "";
        animate(note, { opacity: 0 }, T.note, EASE_RISE);
      });
    });
    after(T.risen, () => hold(T.hold));
  }

  // ----- Frames --------------------------------------------------------------------------------

  let frame = 0;
  let last = 0;
  let playing = false;

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    // A long gap (a throttled tab coming back) counts as one ordinary frame.
    const dt = Math.min(64, Math.max(0, now - last));
    last = now;
    clock += dt;

    if (queue.length > 0) {
      const due = queue.filter((item) => item.at <= clock);
      if (due.length > 0) {
        queue = queue.filter((item) => item.at > clock);
        due.sort((a, b) => a.at - b.at).forEach((item) => item.run());
      }
    }

    // The poster holds its frozen frame; otherwise the level follows the voice, quickly up and
    // slowly down, and the wave only travels while there is something to see.
    if (poster && holding) return;
    // The synthetic voice peaks near 0.7; the poster was drawn at 0.86, so the live line is
    // lifted to the same height.
    const target = speaking
      ? Math.min(1, syntheticSignalAt(speaking.spans, clock - speaking.from, 7).amplitude * 1.3)
      : 0;
    const follow = target > level ? 60 : speaking ? 110 : 150;
    level += (target - level) * (1 - Math.exp(-dt / follow));
    if (level > 0.002) {
      if (!poster) waveTime += dt / 1000;
      draw();
    } else if (!flatDrawn) {
      level = 0;
      draw();
    }
  }

  // ----- Running and stopping ------------------------------------------------------------------

  let inView = true;
  let userPaused = false;

  function sync() {
    const should = inView && !document.hidden && !userPaused;
    if (should === playing) return;
    playing = should;
    if (playing) {
      last = performance.now();
      running.forEach((animation) => animation.play());
      frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      running.forEach((animation) => animation.pause());
    }
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.1;
      sync();
    },
    { threshold: [0, 0.1] },
  );
  observer.observe(hero);
  const resize = new ResizeObserver(measure);
  resize.observe(horizon);
  document.addEventListener("visibilitychange", sync);

  const togglePause = () => {
    userPaused = !userPaused;
    if (pauseButton) {
      pauseButton.dataset.state = userPaused ? "paused" : "playing";
      const label = userPaused ? pauseButton.dataset.playLabel : pauseButton.dataset.pauseLabel;
      if (label) pauseButton.setAttribute("aria-label", label);
    }
    sync();
  };
  if (pauseButton) {
    pauseButton.hidden = false;
    pauseButton.dataset.state = "playing";
    pauseButton.addEventListener("click", togglePause);
  }

  // The canvas draws the poster's own frame, then the SVG steps aside.
  measure();
  horizon.setAttribute("data-live", "");
  hold(T.firstHold);
  sync();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    document.removeEventListener("visibilitychange", sync);
    pauseButton?.removeEventListener("click", togglePause);
    running.forEach((animation) => animation.cancel());
    queue = [];
  };
}
