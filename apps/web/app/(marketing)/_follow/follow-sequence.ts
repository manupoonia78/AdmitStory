// The pinned sequence (direction §4.3, plan §9.2.4). The only module that imports GSAP; it loads
// with import() from ./follow-host on desktop only.
//
// It rearranges the server-rendered stacked chapters into the pinned stage (class "is-pinned":
// statements left, frames right, all four stacked in one grid cell; marketing.css) and pins it
// for a few viewports of scroll. Scroll position picks the chapter (four equal stretches); each
// change then plays as one short, self-contained transition, so the stage never rests half-way
// between two chapters, whatever the scroll does (trackpad momentum, keys, a dragged scrollbar).
// Between chapters:
//   the outgoing statement's lines leave through their masks, the incoming ones rise in;
//   the paragraph and the position readout cross-fade;
//   the outgoing frame fades and drifts 24 px while the incoming one fades in from 24 px the other
//   side (the film cut: opacity and transform only). Scrolling back runs it in reverse direction.
// Each frame shows the sample sentence in place, so the sentence still "travels" chapter to
// chapter without an overlay that has to line up with four different layouts.
//
// Everything is created inside gsap.matchMedia(), so leaving the query (a narrower window, reduced
// motion switched on) or unmounting reverts it all and the stacked version is back.

import { SETTLE_SECONDS, springEase } from "@admitstory/ui";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DESKTOP_MOTION_QUERY } from "../_lib/gates";
import { onLenisStart } from "../_motion/smooth-scroll";

/** How long the stage stays pinned, in viewport heights (four chapters share it equally). */
const PIN_VIEWPORTS = 3.2;
/** The film cut's drift, in px. */
const DRIFT = 24;

interface Chapter {
  note: HTMLElement;
  statement: HTMLElement;
  paragraph: HTMLElement;
  frame: HTMLElement;
}

function readChapters(section: HTMLElement): Chapter[] | null {
  const chapters: Chapter[] = [];
  for (const article of section.querySelectorAll<HTMLElement>(".follow-chapter")) {
    const note = article.querySelector<HTMLElement>(".follow-note");
    const statement = article.querySelector<HTMLElement>(".follow-statement");
    const paragraph = article.querySelector<HTMLElement>(".follow-paragraph");
    const frame = article.querySelector<HTMLElement>(".follow-frame");
    if (!note || !statement || !paragraph || !frame) return null;
    chapters.push({ note, statement, paragraph, frame });
  }
  return chapters.length > 1 ? chapters : null;
}

function build(section: HTMLElement, chapters: Chapter[]) {
  const statements = chapters.map((chapter) => chapter.statement);
  let lines: HTMLElement[][] = [];
  let current = 0;
  let transition: gsap.core.Timeline | null = null;
  const glide = springEase("glide");

  /** Shows one chapter at once, the rest hidden: the rest state, and after every re-split. */
  const settle = (index: number) => {
    transition?.kill();
    transition = null;
    chapters.forEach((chapter, i) => {
      const shown = i === index;
      gsap.set(lines[i] ?? [], { yPercent: shown ? 0 : 100 });
      gsap.set([chapter.note, chapter.paragraph], { opacity: shown ? 1 : 0 });
      gsap.set(chapter.frame, { autoAlpha: shown ? 1 : 0, y: 0 });
    });
  };

  const go = (index: number) => {
    if (index === current) return;
    // A transition still playing finishes at once, so only two chapters are ever in motion.
    transition?.progress(1).kill();
    const from = chapters[current];
    const to = chapters[index];
    const sign = index > current ? 1 : -1;
    const fromLines = lines[current] ?? [];
    const toLines = lines[index] ?? [];
    current = index;
    if (!from || !to) return;
    transition = gsap
      .timeline({ onComplete: () => void (transition = null) })
      // Statement lines through their masks.
      .to(fromLines, { yPercent: -100 * sign, stagger: 0.04, duration: 0.32, ease: "power2.in" }, 0)
      .fromTo(
        toLines,
        { yPercent: 100 * sign },
        { yPercent: 0, stagger: 0.06, duration: SETTLE_SECONDS.glide, ease: glide },
        0.22,
      )
      // The paragraph and the position readout cross-fade.
      .to([from.note, from.paragraph], { opacity: 0, duration: 0.2, ease: "none" }, 0)
      .to([to.note, to.paragraph], { opacity: 1, duration: 0.35, ease: "none" }, 0.3)
      // The film cut.
      .to(from.frame, { autoAlpha: 0, y: -DRIFT * sign, duration: 0.3, ease: "power1.in" }, 0)
      .fromTo(
        to.frame,
        { autoAlpha: 0, y: DRIFT * sign },
        { autoAlpha: 1, y: 0, duration: SETTLE_SECONDS.glide, ease: glide },
        0.2,
      );
  };

  // One SplitText for all four statements. autoSplit re-splits when fonts load or the width
  // changes; the new lines take the current chapter's rest state.
  SplitText.create(statements, {
    type: "lines",
    mask: "lines",
    linesClass: "follow-line",
    autoSplit: true,
    onSplit() {
      lines = statements.map((statement) =>
        Array.from(statement.querySelectorAll<HTMLElement>(".follow-line")),
      );
      settle(current);
    },
  });

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${window.innerHeight * PIN_VIEWPORTS}`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      go(Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length)));
    },
  });

  return () => transition?.kill();
}

/** Starts the sequence on the #follow section; returns the cleanup. */
export function startFollow(section: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const media = gsap.matchMedia();
  media.add(DESKTOP_MOTION_QUERY, () => {
    section.classList.add("is-pinned");
    const chapters = readChapters(section);
    if (!chapters) {
      section.classList.remove("is-pinned");
      return;
    }
    const stop = build(section, chapters);
    return () => {
      stop();
      section.classList.remove("is-pinned");
    };
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
