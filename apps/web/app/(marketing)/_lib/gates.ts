// When the marketing site's heavier pieces may load (direction §10, plan §3.5). Pure: the browser
// bindings live in ../_motion/media.ts, so these rules can be read (and reasoned about) alone.
//
//   the hero's WebGL Voiceprint   rendererGate
//   the pinned sequence (GSAP)    followGate
//   Lenis smooth scroll           smoothScrollGate
//
// "wait" means not yet, "load" means now, "never" means not on this device or setting.

/** Desktop with a mouse or trackpad, and motion welcome: the only place GSAP and Lenis run. */
export const DESKTOP_MOTION_QUERY =
  "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** Phones and tablets: below the laptop breakpoint (spec §6.12), or touch-first. */
export const PHONE_QUERY = "(max-width: 1023px), (pointer: coarse)";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type Gate = "wait" | "load" | "never";

/** The renderer tier (packages/ui voiceprint/tier.ts): 1 is the still SVG, 2–3 are WebGL. */
export type RendererTier = 1 | 2 | 3;

/** Desktop motion is allowed when the query matches and the visitor hasn't asked to save data. */
export function desktopMotionAllowed({
  matches,
  saveData,
}: {
  matches: boolean;
  saveData: boolean;
}): boolean {
  return matches && !saveData;
}

export interface RendererGateInput {
  phone: boolean;
  /** The window `load` event has fired. */
  loaded: boolean;
  /** An idle callback has run since load. */
  idle: boolean;
  /** The visitor has tapped, scrolled or pressed a key. */
  interacted: boolean;
  heroInView: boolean;
  /** Null while the tier is still unknown (detect-gpu hasn't answered). */
  tier: RendererTier | null;
  reducedMotion?: boolean;
}

/**
 * The hero's live Voiceprint (direction §10). Desktop: after load, on idle, while the hero is in
 * view. Phone: only on the first interaction, so Lighthouse never triggers it. Tier 1 and reduced
 * motion keep the still poster for good.
 */
export function rendererGate(input: RendererGateInput): Gate {
  if (input.reducedMotion || input.tier === 1) return "never";
  if (input.phone) return input.interacted ? "load" : "wait";
  return input.loaded && input.idle && input.heroInView ? "load" : "wait";
}

export interface FollowGateInput {
  /** desktopMotionAllowed(): desktop, fine pointer, no reduced motion, no Save-Data. */
  desktop: boolean;
  /** #follow is within one viewport. */
  nearFollow: boolean;
  /** An idle callback has run after the hero's renderer settled. */
  idleAfterRenderer: boolean;
}

/** The pinned sequence: desktop only, when #follow is near or on idle, whichever is first. */
export function followGate({ desktop, nearFollow, idleAfterRenderer }: FollowGateInput): Gate {
  if (!desktop) return "never";
  return nearFollow || idleAfterRenderer ? "load" : "wait";
}

/** Lenis: desktop only, and only once the visitor uses a wheel (trackpads included). */
export function smoothScrollGate({ desktop, wheel }: { desktop: boolean; wheel: boolean }): Gate {
  if (!desktop) return "never";
  return wheel ? "load" : "wait";
}
