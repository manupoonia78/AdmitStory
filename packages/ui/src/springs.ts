// The four springs (SPEC §2.10), with no runtime dependencies. motion.ts re-exports them for
// Motion; motion-curves.ts samples them for CSS. Kept apart so code that only needs the numbers
// never pulls motion/react into its chunk.

export const SPRINGS = {
  /** Toggles, checkboxes, small state changes. */
  snap: { stiffness: 700, damping: 40, mass: 1 },
  /** Panels, sheets, the dock, layout reflow. */
  glide: { stiffness: 380, damping: 34, mass: 1 },
  /** Shared-element flights and the hero's sheets. */
  drift: { stiffness: 160, damping: 26, mass: 1.2 },
  /** Long settles. Nothing ambient uses it any more: nothing in the background moves. */
  settle: { stiffness: 90, damping: 20, mass: 1 },
} as const;

export type MotionToken = keyof typeof SPRINGS;

export const MOTION_TOKENS = Object.keys(SPRINGS) as MotionToken[];
