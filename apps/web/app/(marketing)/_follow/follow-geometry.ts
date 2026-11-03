// The pinned sequence's maths (plan §9.2), pure so it can be reasoned about alone. The travelling
// sentence is one element positioned at the section's top-left with transform-origin 0 0; to sit
// on a frame's sentence it moves to that sentence's first line box and scales by the ratio of the
// two font sizes.

export const CHAPTER_LABELS = ["c1", "c2", "c3", "c4"] as const;

/** A frame sentence's first line box, relative to the section, at rest. */
export interface SlotBox {
  left: number;
  top: number;
  /** The rendered font size in CSS px, after the frame's own scale. */
  fontSize: number;
}

export interface TravelTarget {
  x: number;
  y: number;
  scale: number;
}

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** Where the traveller goes to sit on `slot`, given its own unscaled font size. */
export function travelTarget(slot: SlotBox, baseFontSize: number): TravelTarget {
  const scale = baseFontSize > 0 ? slot.fontSize / baseFontSize : 1;
  return {
    x: finite(slot.left, 0),
    y: finite(slot.top, 0),
    scale: finite(scale, 1) > 0 ? finite(scale, 1) : 1,
  };
}

/**
 * A slot's box from DOM measurements: the first line rect (client coordinates), the section's
 * rect, any translation GSAP has applied to the slot's frame (so a frame mid-tween still measures
 * at rest), the computed font size and the frame's scale (rendered width / layout width).
 */
export function slotBox(input: {
  line: { left: number; top: number };
  section: { left: number; top: number };
  frameOffset: { x: number; y: number };
  computedFontSize: number;
  frameScale: number;
}): SlotBox {
  return {
    left: input.line.left - input.section.left - input.frameOffset.x,
    top: input.line.top - input.section.top - input.frameOffset.y,
    fontSize: input.computedFontSize * (input.frameScale > 0 ? input.frameScale : 1),
  };
}
