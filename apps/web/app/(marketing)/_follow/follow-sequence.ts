// The pinned sequence (direction §4.3, plan §9.2.4). The only module that imports GSAP; it loads
// with import() from ./follow-host on desktop only.
//
// It rearranges the server-rendered stacked chapters into the pinned stage (class "is-pinned":
// statements left, frames right, all four stacked in one grid cell; marketing.css), then scrubs
// a timeline between four labels, one unit apart. Scroll position is the clock (ease "none"); the
// spring comes back in the snap that settles on a chapter. Between chapters:
//   the outgoing statement's lines leave upward through their masks, the incoming ones rise;
//   the paragraph cross-fades; the outgoing frame fades and drifts up 24 px while the incoming
//   one fades in from 24 px below (the film cut: opacity and transform only);
//   the sentence leaves its frame and travels to its slot in the next one, re-sized and
//   re-coloured, then hands back to the frame's own text.
//
// Everything is created inside gsap.matchMedia(), so leaving the query (a narrower window, reduced
// motion switched on) or unmounting reverts it all and the stacked version is back.

import { SETTLE_SECONDS, springEase } from "@admitstory/ui";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DESKTOP_MOTION_QUERY } from "../_lib/gates";
import { onLenisStart } from "../_motion/smooth-scroll";
import { CHAPTER_LABELS, slotBox, travelTarget, type TravelTarget } from "./follow-geometry";

/** The colour the sentence takes in each frame: transcript, ignited, on paper, quoted. */
const SENTENCE_COLORS = ["--text", "--voice", "--text", "--text-soft"] as const;

interface Chapter {
  note: HTMLElement;
  statement: HTMLElement;
  paragraph: HTMLElement;
  frame: HTMLElement;
  slot: HTMLElement;
}

function required<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

/** The element holding the frame's copy of the sentence (its first line is the target). */
function sentenceIn(frame: HTMLElement): HTMLElement | null {
  const slot = frame.querySelector<HTMLElement>("[data-sentence-slot]");
  if (!slot) return null;
  return (
    slot.querySelector<HTMLElement>("[data-own-words]") ??
    slot.querySelector<HTMLElement>("[data-final]") ??
    slot
  );
}

function readChapters(section: HTMLElement): Chapter[] | null {
  const chapters: Chapter[] = [];
  for (const article of section.querySelectorAll<HTMLElement>(".follow-chapter")) {
    const note = required<HTMLElement>(article, ".follow-note");
    const statement = required<HTMLElement>(article, ".follow-statement");
    const paragraph = required<HTMLElement>(article, ".follow-paragraph");
    const frame = required<HTMLElement>(article, ".follow-frame");
    const slot = frame ? sentenceIn(frame) : null;
    if (!note || !statement || !paragraph || !frame || !slot) return null;
    chapters.push({ note, statement, paragraph, frame, slot });
  }
  return chapters.length === CHAPTER_LABELS.length ? chapters : null;
}

/** A token's resolved colour (rgb), which GSAP can interpolate; var() strings it can't. */
function tokenColor(scope: HTMLElement, token: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  probe.hidden = true;
  scope.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** Each chapter's sentence target, measured at rest, relative to the section. */
function measure(section: HTMLElement, chapters: Chapter[], traveller: HTMLElement) {
  const sectionRect = section.getBoundingClientRect();
  const baseFontSize = parseFloat(getComputedStyle(traveller).fontSize) || 21;
  const targets = chapters.map((chapter): TravelTarget => {
    const rects = chapter.slot.getClientRects();
    const line = rects[0] ?? chapter.slot.getBoundingClientRect();
    // The frame's content is scaled (ScaledFrame): rendered width over layout width.
    const rendered = chapter.slot.getBoundingClientRect().width;
    const layout = chapter.slot.offsetWidth;
    const box = slotBox({
      line,
      section: sectionRect,
      frameOffset: {
        x: Number(gsap.getProperty(chapter.frame, "x")) || 0,
        y: Number(gsap.getProperty(chapter.frame, "y")) || 0,
      },
      computedFontSize: parseFloat(getComputedStyle(chapter.slot).fontSize) || baseFontSize,
      frameScale: layout > 0 ? rendered / layout : 1,
    });
    return travelTarget(box, baseFontSize);
  });
  // The traveller wraps like chapter 1's transcript: its slot's width at the traveller's scale.
  const firstSlot = chapters[0]?.slot.closest<HTMLElement>("[data-sentence-slot]");
  const firstScale = targets[0]?.scale ?? 1;
  if (firstSlot && firstScale > 0) {
    const width = firstSlot.getBoundingClientRect().width / firstScale;
    traveller.style.setProperty("--follow-sentence-width", `${Math.round(width)}px`);
  }
  return targets;
}

function build(section: HTMLElement, chapters: Chapter[], traveller: HTMLElement) {
  const statements = chapters.map((chapter) => chapter.statement);
  let targets: TravelTarget[] = [];
  const colors = SENTENCE_COLORS.map((token) => tokenColor(section, token));

  // One SplitText for all four statements. autoSplit re-splits when fonts load or the width
  // changes, reverting the timeline returned from onSplit and building a fresh one.
  SplitText.create(statements, {
    type: "lines",
    mask: "lines",
    linesClass: "follow-line",
    autoSplit: true,
    onSplit() {
      const lines = statements.map((statement) =>
        Array.from(statement.querySelectorAll<HTMLElement>(".follow-line")),
      );
      targets = measure(section, chapters, traveller);
      const target = (index: number, key: keyof TravelTarget) => () => targets[index]?.[key] ?? 0;

      // Rest state: chapter 1 showing, the rest waiting below their masks.
      chapters.forEach((chapter, index) => {
        const shown = index === 0;
        gsap.set(lines[index] ?? [], { yPercent: shown ? 0 : 100 });
        gsap.set([chapter.note, chapter.paragraph], { opacity: shown ? 1 : 0 });
        gsap.set(chapter.frame, { autoAlpha: shown ? 1 : 0, y: shown ? 0 : 24 });
        gsap.set(chapter.slot, { opacity: 1 });
      });
      gsap.set(traveller, {
        autoAlpha: 0,
        x: target(0, "x"),
        y: target(0, "y"),
        scale: target(0, "scale"),
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${window.innerHeight * 3.2}`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: () => {
            targets = measure(section, chapters, traveller);
          },
          snap: {
            snapTo: "labelsDirectional",
            duration: { min: SETTLE_SECONDS.snap, max: SETTLE_SECONDS.drift },
            delay: 0.08,
            ease: springEase("drift"),
          },
        },
      });

      CHAPTER_LABELS.forEach((label, index) => timeline.addLabel(label, index));

      for (let index = 0; index < chapters.length - 1; index += 1) {
        const from = chapters[index];
        const to = chapters[index + 1];
        if (!from || !to) continue;
        const at = index;
        timeline
          // Statement lines through their masks.
          .to(lines[index] ?? [], { yPercent: -100, stagger: 0.06, duration: 0.4 }, at + 0.05)
          .to(lines[index + 1] ?? [], { yPercent: 0, stagger: 0.06, duration: 0.4 }, at + 0.5)
          // The paragraph and the position readout cross-fade.
          .to([from.note, from.paragraph], { opacity: 0, duration: 0.3 }, at + 0.05)
          .to([to.note, to.paragraph], { opacity: 1, duration: 0.3 }, at + 0.6)
          // The film cut.
          .to(from.frame, { autoAlpha: 0, y: -24, duration: 0.45 }, at + 0.1)
          .to(to.frame, { autoAlpha: 1, y: 0, duration: 0.45 }, at + 0.45)
          // The sentence lifts out of the old frame, travels, and lands in the new one.
          .to(from.slot, { opacity: 0, duration: 0.05 }, at + 0.08)
          .fromTo(
            traveller,
            {
              autoAlpha: 1,
              x: target(index, "x"),
              y: target(index, "y"),
              scale: target(index, "scale"),
              color: colors[index] ?? colors[0],
            },
            {
              x: target(index + 1, "x"),
              y: target(index + 1, "y"),
              scale: target(index + 1, "scale"),
              color: colors[index + 1] ?? colors[0],
              duration: 0.8,
              immediateRender: false,
            },
            at + 0.08,
          )
          .set(to.slot, { opacity: 0 }, at + 0.08)
          .to(to.slot, { opacity: 1, duration: 0.06 }, at + 0.88)
          .to(traveller, { autoAlpha: 0, duration: 0.06 }, at + 0.88);
      }
      return timeline;
    },
  });
}

/** Starts the sequence on the #follow section; returns the cleanup. */
export function startFollow(section: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const media = gsap.matchMedia();
  media.add(DESKTOP_MOTION_QUERY, () => {
    const traveller = section.querySelector<HTMLElement>(".follow-sentence");
    section.classList.add("is-pinned");
    const chapters = readChapters(section);
    if (!chapters || !traveller) {
      section.classList.remove("is-pinned");
      return;
    }
    build(section, chapters, traveller);
    return () => section.classList.remove("is-pinned");
  });

  // Smooth scroll is optional and may start later (first wheel): keep ScrollTrigger in step.
  let unsubscribe: (() => void) | undefined;
  const stopWaiting = onLenisStart((lenis) => {
    unsubscribe = lenis.on("scroll", ScrollTrigger.update);
  });

  return () => {
    stopWaiting();
    unsubscribe?.();
    media.revert();
  };
}
