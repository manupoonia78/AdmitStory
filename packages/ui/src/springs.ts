// The four springs (spec §6.6), with no runtime dependencies. motion.ts re-exports them for Motion;
// motion-curves.ts samples them for CSS and GSAP. Kept apart so code that only needs the numbers
// (the marketing site's GSAP island) never pulls motion/react into its chunk.

export const SPRINGS = {
  /** Toggles, checkboxes, small state changes. */
  snap: { stiffness: 700, damping: 40, mass: 1 },
  /** Panels, sheets, the dock, layout reflow. */
  glide: { stiffness: 380, damping: 34, mass: 1 },
  /** Hero entrances, shared-element flights, Voiceprint threads. */
  drift: { stiffness: 160, damping: 26, mass: 1.2 },
  /** Ambient breathing and slow ambient motion. */
  settle: { stiffness: 90, damping: 20, mass: 1 },
} as const;

export type MotionToken = keyof typeof SPRINGS;

export const MOTION_TOKENS = Object.keys(SPRINGS) as MotionToken[];
