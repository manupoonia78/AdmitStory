// Springs for the hero's WAAPI animations, read from tokens.css at run time (so reduced motion's
// 120 ms linear fade, which tokens.css swaps in, comes for free) and the word flight's geometry.
// Plain functions: no Motion in the hero's chunks.

import { flightControlPoint, quadraticPoint } from "@admitstory/ui";

export type SpringName = "snap" | "glide" | "drift" | "settle";

export interface Spring {
  easing: string;
  ms: number;
}

const FALLBACK_MS: Record<SpringName, number> = { snap: 350, glide: 480, drift: 680, settle: 1120 };

export function readSpring(name: SpringName): Spring {
  const style = getComputedStyle(document.documentElement);
  const easing = style.getPropertyValue(`--spring-${name}`).trim() || "ease-out";
  const raw = style.getPropertyValue(`--spring-${name}-duration`).trim();
  const value = parseFloat(raw);
  const ms = Number.isFinite(value)
    ? raw.endsWith("ms")
      ? value
      : value * 1000
    : FALLBACK_MS[name];
  return { easing, ms };
}

export function prefersStill(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  // Tier 1 (the still Voiceprint): no flight either (direction §4.2).
  return document.querySelector('#hero [data-voiceprint][data-tier="1"]') !== null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const STEPS = 24;

/**
 * Flies a copy of `from` (a transcript word, Geist) onto `to` (the same word waiting in the
 * sheet, Newsreader) along the Studio's curved flight path: shrinking to the sheet's size, a 2 px
 * blur that sharpens as it lands, and in the last 120 ms the copy cross-fades into the sheet's own
 * word. Resolves when it has landed. `abort` cancels everything at once.
 */
export function flyWord(
  from: HTMLElement,
  to: HTMLElement,
  delayMs: number,
  spring: Spring,
  signal: AbortSignal,
): Promise<void> {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const computed = getComputedStyle(from);
  const clone = document.createElement("span");
  clone.textContent = from.textContent;
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    position: "fixed",
    left: `${a.left}px`,
    top: `${a.top}px`,
    margin: "0",
    whiteSpace: "pre",
    pointerEvents: "none",
    zIndex: "60",
    transformOrigin: "0 0",
    font: computed.font,
    letterSpacing: computed.letterSpacing,
    color: computed.color,
    textShadow: computed.textShadow,
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.append(clone);

  const fromSize = parseFloat(computed.fontSize) || 32;
  const toSize = parseFloat(getComputedStyle(to).fontSize) || 19;
  const scale = toSize / fromSize;
  const p0 = { x: a.left, y: a.top };
  const p2 = { x: b.left, y: b.top };
  const control = flightControlPoint(p0, p2, { bow: 0.22, minBow: 24, maxBow: 160 });
  const frames: Keyframe[] = [];
  for (let step = 0; step <= STEPS; step += 1) {
    const t = step / STEPS;
    const point = quadraticPoint(p0, control, p2, t);
    const blur = t < 0.5 ? 0 : t < 0.85 ? ((t - 0.5) / 0.35) * 2 : (1 - (t - 0.85) / 0.15) * 2;
    frames.push({
      offset: t,
      transform: `translate(${point.x - a.left}px, ${point.y - a.top}px) scale(${lerp(1, scale, t)})`,
      filter: `blur(${blur.toFixed(2)}px)`,
    });
  }
  const options = { delay: delayMs, fill: "both" as const };
  const flight = clone.animate(frames, { ...options, duration: spring.ms, easing: spring.easing });
  const fadeAt = delayMs + Math.max(0, spring.ms - 120);
  const fadeOut = clone.animate([{ opacity: 1 }, { opacity: 0 }], {
    delay: fadeAt,
    duration: 120,
    fill: "both",
  });
  const fadeIn = to.animate([{ opacity: 0 }, { opacity: 1 }], {
    delay: fadeAt,
    duration: 120,
    fill: "both",
  });
  const leave = from.animate([{ opacity: 1 }, { opacity: 0 }], {
    delay: delayMs,
    duration: 80,
    fill: "both",
  });
  const all = [flight, fadeOut, fadeIn, leave];
  const cleanup = () => clone.remove();
  signal.addEventListener("abort", () => {
    for (const animation of all) animation.cancel();
    cleanup();
  });
  return Promise.all(all.map((animation) => animation.finished)).then(
    () => {
      to.style.opacity = "1";
      for (const animation of [fadeIn]) animation.cancel();
      cleanup();
    },
    () => cleanup(),
  );
}
