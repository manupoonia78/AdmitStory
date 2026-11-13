import {
  BrandMark,
  DURATIONS,
  EASES,
  RevealObserver,
  VOICE_HUES,
  Wordmark,
  cx,
  voiceHueStyle,
} from "@admitstory/ui";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { ModelCredit, ModelSeal, ModelSealMark } from "@/components/model-seal";
import { ReadingFonts } from "@/components/reading-fonts";
import { Kit, MotionBench, Overlays } from "./_hosts";
import {
  INSTRUMENT,
  NIGHT_PAPER,
  PAPER,
  RADII,
  TYPE_ROWS,
  wavePath,
  type Step,
  type Swatch,
} from "./_tokens";

// The design system of "the literary instrument" on one page (SPEC §2): every token and every
// component, on the three surfaces the product is made of. Hidden with the other prototypes
// (never indexed, off in production). The sections outside the three material panels follow the
// Day / Night switch in the header, so the same page shows the working area both ways.

export const metadata: Metadata = { title: "Design system" };

const order = (i: number) => ({ "--i": i }) as CSSProperties;

const SECTIONS = [
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "material", label: "Material" },
  { id: "components", label: "Components" },
  { id: "voice", label: "Voice" },
  { id: "motion", label: "Motion" },
  { id: "brand", label: "Brand" },
] as const;

/* ---------- The Voiceline ---------- */

// Someone speaks, the line goes flat, then rises once: the mark. One path, so it draws in one go.
const MASTHEAD_LINE = `${wavePath(7, { width: 320, baseline: 95.4, amplitude: 26 })}H404L428 25.4L452 95.4H560`;

function MastheadLine() {
  return (
    <div aria-hidden className="flex items-end pb-8">
      <svg
        viewBox="0 0 560 96"
        fill="none"
        className="h-auto w-[min(78%,35rem)] shrink-0 overflow-visible"
      >
        <path
          d={MASTHEAD_LINE}
          pathLength={1}
          className="draw-line stroke-accent"
          style={order(3)}
          strokeWidth="1.25"
          strokeLinejoin="miter"
          strokeMiterlimit="8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="h-px flex-1 bg-edge-strong" />
    </div>
  );
}

/** A section rule: flat, with the one peak that says "here". */
function PeakRule() {
  return (
    <div aria-hidden className="flex items-end">
      <span className="h-px w-3 bg-edge-strong" />
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none" className="shrink-0">
        <path d="M0 11.5H7L12 1L17 11.5H24" className="stroke-accent" strokeWidth="1.25" />
      </svg>
      <span className="h-px flex-1 bg-edge-strong" />
    </div>
  );
}

/* ---------- Layout ---------- */

function Section({
  id,
  index,
  title,
  lead,
  children,
}: {
  id: (typeof SECTIONS)[number]["id"];
  index: number;
  title: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-10 flex-col gap-10 lg:gap-14"
    >
      <div className="reveal flex flex-col gap-6">
        <PeakRule />
        <div className="grid gap-x-6 gap-y-4 lg:grid-cols-12">
          <p className="figure text-sm text-text-label lg:col-span-1 lg:pt-4">
            {String(index).padStart(2, "0")}
          </p>
          <h2 id={`${id}-title`} className="text-display-1 lg:col-span-6">
            {title}
          </h2>
          <p className="max-w-[46ch] text-text-soft lg:col-span-4 lg:col-start-9 lg:pt-4">{lead}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

type Scope = "instrument" | "paper" | "night-paper";

const SCOPES: Record<Scope, { name: string; where: string; theme: "night" | "day" }> = {
  instrument: { name: "Instrument", where: "Marketing, Studio, casing", theme: "night" },
  paper: { name: "Paper", where: "Day reading and writing", theme: "day" },
  "night-paper": { name: "Night paper", where: "Night reading and writing", theme: "night" },
};

/** One of the three surfaces, whatever theme the page is in. */
function Panel({
  scope,
  children,
  className,
}: {
  scope: Scope;
  children: ReactNode;
  className?: string;
}) {
  const { name, where, theme } = SCOPES[scope];
  return (
    <div
      data-theme={theme}
      className={cx(
        "reveal flex min-w-0 flex-col gap-8 rounded-card border border-edge p-6 lg:p-8",
        scope === "night-paper" && "bg-sheet bg-none",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-title">{name}</h3>
        <p className="label">{where}</p>
      </div>
      {children}
    </div>
  );
}

/* ---------- Colour ---------- */

function Swatches({ items }: { items: Swatch[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.token} className="flex items-center gap-3">
          <span
            className="size-10 shrink-0 rounded-inset border border-edge-strong"
            style={{ background: `var(${item.token})` }}
          />
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-[0.75rem] leading-[1.125rem]">{item.token}</span>
            <span className="text-sm text-text-soft">{item.use}</span>
          </span>
          <span className="meta ml-auto shrink-0 pl-2">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Hierarchy is one colour at fewer and fewer per cent. The ratio is its lowest contrast here. */
function Ladder({ steps }: { steps: Step[] }) {
  return (
    <ul className="flex flex-col">
      {steps.map((step) => (
        <li
          key={step.token}
          className="grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-x-3 border-t border-edge py-3"
        >
          <span
            className="text-[1.75rem] leading-none font-[450] tracking-[-0.03em]"
            style={{ color: `var(${step.token})` }}
          >
            Aa
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-[0.75rem] leading-[1.125rem]">{step.token}</span>
            <span className="text-sm text-text-soft">{step.use}</span>
          </span>
          <span className="meta">{step.contrast}:1</span>
        </li>
      ))}
    </ul>
  );
}

function PanelGroup({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="label">{name}</p>
      {children}
    </div>
  );
}

/* ---------- Type ---------- */

function TypeScale() {
  return (
    <ul className="reveal flex flex-col">
      {TYPE_ROWS.map((row) => (
        <li
          key={row.name}
          className="grid gap-x-6 gap-y-3 border-t border-edge py-6 lg:grid-cols-12 lg:py-8"
        >
          <div className="flex flex-col gap-1 lg:col-span-3">
            <span className="font-mono text-[0.75rem] leading-[1.125rem]">{row.name}</span>
            <span className="meta">{row.spec}</span>
          </div>
          <p className={cx("min-w-0 lg:col-span-9", row.className)}>
            {row.sample}
            {row.accent ? (
              <>
                {" "}
                <em>{row.accent}</em>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

const VERBATIM = "underline decoration-voice decoration-[1.25px] underline-offset-[0.22em]";
const ADAPTED =
  "bg-[color-mix(in_srgb,var(--voice-glow)_60%,transparent)] underline decoration-voice decoration-dotted decoration-1 underline-offset-[0.22em]";

/** The reading face on a sheet, with the three ways a sentence's origin is drawn (SPEC §2.3). */
function ReadingSheet({ theme, hue }: { theme: "day" | "night"; hue: number }) {
  return (
    <div
      data-theme={theme}
      style={voiceHueStyle(hue)}
      className="reveal flex min-w-0 flex-col gap-6 rounded-card border border-edge p-4 sm:p-8 lg:p-10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-title">{theme === "day" ? "Paper" : "Night paper"}</h3>
        <p className="label">read · Source Serif 4 · 17 → 19 / 1.65</p>
      </div>
      <article className="sheet flex flex-col gap-6 p-6! sm:p-10! lg:p-12!">
        <header className="flex flex-col gap-3 font-ui">
          <p className="label">Northfield · Essay 2</p>
          <h4 className="text-display-3 text-text">
            Tell us about a decision you made without cover.
          </h4>
        </header>
        <p className="max-w-essay">
          <mark className={VERBATIM}>
            The truck died outside Nashik with forty minutes of cold left in it,
          </mark>{" "}
          and the people who could approve a second vehicle were asleep in another time zone.{" "}
          <mark className={ADAPTED}>
            I hired one on my own card and told the clinic we were late.
          </mark>{" "}
          <span className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-dashed border-needs px-2 align-baseline font-ui text-sm text-needs">
            <span aria-hidden>?</span> Which month was this
          </span>
        </p>
        <p className="note max-w-[52ch] border-l border-accent pl-3">
          Leads with the forty minutes, not the job title. The prompt asks for a decision, so the
          draft opens on the one you made alone.
        </p>
        <p className="max-w-essay">
          What I learned was not about refrigeration. <em>It was about who gets to say yes</em>, and
          how long a person will wait for permission they already know they will be given.
        </p>
        <p className="max-w-essay text-read-sm text-text-soft">
          read-sm, 15 / 1.6: for sheets shown small, in the hero&rsquo;s cards and in previews.
        </p>
      </article>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-soft">
        <li>
          <mark className={VERBATIM}>Said word for word</mark>
        </li>
        <li>
          <mark className={ADAPTED}>Yours, lightly edited</mark>
        </li>
        <li>Written for you</li>
      </ul>
    </div>
  );
}

/* ---------- Material ---------- */

function FrostStage() {
  return (
    <div className="reveal flex min-w-0 flex-col overflow-hidden rounded-frame border border-edge lg:col-span-7">
      <div className="relative min-h-72 flex-1 overflow-hidden sm:min-h-80">
        <div
          aria-hidden
          className="flex flex-col gap-1 px-6 pt-5 font-accent text-[1.75rem] leading-[1.2] whitespace-nowrap text-text-faint italic sm:px-10 sm:text-[2.5rem] lg:text-[2.75rem]"
        >
          <span>I was twenty-six and the only one awake</span>
          <span className="text-text-label">so I signed for the second truck</span>
          <span>and rang the clinic to say we were late</span>
          <span className="text-text-label">which nobody had asked me to do</span>
          <span>and nobody above me was awake to ask</span>
          <span className="text-text-label">so that was the night I stopped waiting</span>
        </div>
        <div className="absolute inset-x-4 top-8 flex h-14 items-center justify-between gap-4 rounded-full frost pr-2 pl-5 sm:inset-x-8">
          <Wordmark size={24} />
          <span className="hidden items-center gap-6 text-ui text-text-soft sm:flex">
            <span>How it works</span>
            <span>Pricing</span>
          </span>
          <span className="inline-flex min-h-9 items-center rounded-full bg-signal px-4 text-ui text-on-signal">
            Start your story
          </span>
        </div>
      </div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-edge px-6 py-4 sm:px-10">
        <span className="label">frost</span>
        <span className="meta">7% fill · 1px hairline · blur 16px · three on screen at most</span>
      </p>
    </div>
  );
}

function Materials() {
  return (
    <div className="reveal flex min-w-0 flex-col gap-6 lg:col-span-5">
      <div className="card flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="label">card</span>
          <span className="meta">24px · hairline · no shadow on dark</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip">frost-flat</span>
          <span className="chip">the same look</span>
          <span className="chip">no blur to pay for</span>
        </div>
      </div>
      <div className="placeholder flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span>Nothing here yet. One quiet line says what will be.</span>
        <span className="label">placeholder</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {RADII.map((radius) => (
          <li key={radius.token} className="flex flex-col gap-2">
            <span
              className="h-14 border border-control"
              style={{ borderRadius: `var(${radius.token})` }}
            />
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{radius.use}</span>
              <span className="meta">{radius.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Voice ---------- */

function Hues({ scope }: { scope: "instrument" | "paper" }) {
  const key = scope === "paper" ? "day" : "night";
  return (
    <Panel scope={scope}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
        {VOICE_HUES.map((hue, index) => (
          <li key={hue.id} style={voiceHueStyle(index)} className="flex flex-col gap-2">
            <svg
              viewBox="0 0 160 28"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden
              className="h-7 w-full"
            >
              <path
                d={wavePath(index + 1, { width: 160, baseline: 14, amplitude: 11 })}
                className="stroke-voice"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-voice">{hue.name}</span>
              <span className="meta">{hue[key]}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- Motion ---------- */

const EASE_USE: Record<keyof typeof EASES, string> = {
  rise: "Every entrance and reveal",
  exit: "Things leaving",
  line: "A line drawing or settling",
};

const DURATION_USE: Record<keyof typeof DURATIONS, string> = {
  press: "Pressed states",
  hover: "Hovers",
  swap: "Content swapping in place",
  reveal: "Scroll reveals",
  enter: "Page entrances",
  draw: "A Voiceline drawing",
};

function MotionTokens() {
  const longest = Math.max(...Object.values(DURATIONS));
  return (
    <div className="reveal grid gap-x-6 gap-y-10 lg:grid-cols-12">
      <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-7">
        {(Object.keys(EASES) as (keyof typeof EASES)[]).map((name) => {
          const [x1, y1, x2, y2] = EASES[name];
          return (
            <li key={name} className="flex flex-col gap-3 border-t border-edge pt-5">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden className="size-16 overflow-visible">
                <path d="M0 64H64" className="stroke-edge-strong" />
                <path
                  d={`M0 64C${x1 * 64} ${(1 - y1) * 64} ${x2 * 64} ${(1 - y2) * 64} 64 0`}
                  className="stroke-text"
                  strokeWidth="1.25"
                />
              </svg>
              <span className="font-mono text-[0.75rem] leading-[1.125rem]">--ease-{name}</span>
              <span className="text-sm text-text-soft">{EASE_USE[name]}</span>
              <span className="meta">{EASES[name].join(", ")}</span>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-col lg:col-span-5">
        {(Object.keys(DURATIONS) as (keyof typeof DURATIONS)[]).map((name) => (
          <li key={name} className="flex flex-col gap-2 border-t border-edge py-3">
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[0.75rem] leading-[1.125rem]">--dur-{name}</span>
              <span className="text-sm text-text-soft">{DURATION_USE[name]}</span>
              <span className="meta ml-auto">{DURATIONS[name]} ms</span>
            </span>
            <span
              className="h-px bg-text"
              style={{ width: `${(DURATIONS[name] / longest) * 100}%` }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Brand ---------- */

/** The favicon: the same path as app/icon.svg, heavier, brass on the instrument's black. */
function Favicon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <rect width="24" height="24" rx="5.28" fill="#0b0a09" />
      <path
        d="M2 16H8.4L12 5.5L15.6 16H22"
        fill="none"
        stroke="#e2b36b"
        strokeWidth="2.25"
        strokeMiterlimit="8"
      />
    </svg>
  );
}

function BrandPanel({ scope }: { scope: "instrument" | "paper" }) {
  return (
    <Panel scope={scope} className="justify-between">
      <BrandMark size={96} />
      <Wordmark size={48} mark={false} />
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-edge pt-6">
        <Wordmark size={24} />
        <span className="flex items-end gap-3">
          <Favicon size={64} />
          <Favicon size={32} />
          <Favicon size={16} />
        </span>
      </div>
    </Panel>
  );
}

/* ---------- Page ---------- */

export default function SystemPage() {
  return (
    <ReadingFonts>
      <RevealObserver />
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-28 px-5 pt-14 pb-28 sm:px-8 lg:gap-44 lg:px-12 lg:pt-20 lg:pb-40">
        <header className="flex flex-col gap-10 lg:gap-12">
          <p className="enter eyebrow" style={order(0)}>
            Design system · Phase 1
          </p>
          <h1 className="text-display-hero">
            <span className="enter block" style={order(1)}>
              One line,
            </span>
            <em className="enter block" style={order(2)}>
              two materials.
            </em>
          </h1>
          <MastheadLine />
          <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12">
            <p className="enter max-w-[48ch] text-lg text-text-80 lg:col-span-5" style={order(4)}>
              Everything the redesign is built from. A dark instrument for speaking, paper for
              reading and writing, and one hairline that is a voice, then a rule, then a mark.
            </p>
            <nav
              aria-label="Sections"
              className="enter flex flex-wrap content-start gap-2 lg:col-span-6 lg:col-start-7 lg:justify-end"
              style={order(5)}
            >
              {SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="chip">
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <Section
          id="colour"
          index={1}
          title={
            <>
              One text colour, <em>in steps.</em>
            </>
          }
          lead="Hierarchy is opacity, never a new colour. Brass sits on three kinds of element: the primary action, a live or marking Voiceline, and the caret."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel scope="instrument">
              <PanelGroup name="Text steps">
                <Ladder steps={INSTRUMENT.steps} />
              </PanelGroup>
              <PanelGroup name="Surfaces and brass">
                <Swatches items={INSTRUMENT.surfaces} />
              </PanelGroup>
              <PanelGroup name="Status, always with a word">
                <Swatches items={INSTRUMENT.status} />
              </PanelGroup>
            </Panel>
            <Panel scope="paper">
              <PanelGroup name="Text steps">
                <Ladder steps={PAPER.steps} />
              </PanelGroup>
              <PanelGroup name="Surfaces and brass-ink">
                <Swatches items={PAPER.surfaces} />
              </PanelGroup>
              <PanelGroup name="Status, always with a word">
                <Swatches items={PAPER.status} />
              </PanelGroup>
            </Panel>
            <Panel scope="night-paper">
              <PanelGroup name="Text steps">
                <Ladder steps={NIGHT_PAPER.steps} />
              </PanelGroup>
              <PanelGroup name="Surfaces">
                <Swatches items={NIGHT_PAPER.surfaces} />
              </PanelGroup>
              <PanelGroup name="Status, on the sheet">
                <Swatches items={NIGHT_PAPER.status} />
              </PanelGroup>
              <p className="note mt-auto border-l border-accent pl-3">
                Night paper is a warm dark sheet, never black. Text on it is a step softer than on
                the instrument, for long reading.
              </p>
            </Panel>
          </div>
        </Section>

        <Section
          id="type"
          index={2}
          title={
            <>
              Four faces, <em>one job each.</em>
            </>
          }
          lead="Geist for headlines and the interface, never bold. Instrument Serif italic for a few accent words and the transcript. Geist Mono for labels and notes. Source Serif 4 for reading."
        >
          <TypeScale />
          <div className="grid gap-6 lg:grid-cols-2">
            <ReadingSheet theme="day" hue={8} />
            <ReadingSheet theme="night" hue={1} />
          </div>
        </Section>

        <Section
          id="material"
          index={3}
          title={
            <>
              Frosted, <em>not glossy.</em>
            </>
          }
          lead="One material for things that float, the same look without the blur for things that sit in the flow. No highlights, no gradients, no shadows on dark."
        >
          <div className="grid gap-6 lg:grid-cols-12">
            <FrostStage />
            <Materials />
          </div>
        </Section>

        <Section
          id="components"
          index={4}
          title={
            <>
              The same kit, <em>three times.</em>
            </>
          }
          lead="Every action is a pill. The primary is brass on dark and ink on paper; the arrow is for going forward. Selection is an inverted fill or a sliding rule, never brass."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            {(Object.keys(SCOPES) as Scope[]).map((scope) => (
              <Panel key={scope} scope={scope}>
                <Kit />
              </Panel>
            ))}
          </div>
          <div className="reveal flex flex-col gap-4 border-t border-edge pt-5">
            <p className="label">Over the page</p>
            <Overlays />
          </div>
        </Section>

        <Section
          id="voice"
          index={5}
          title={
            <>
              Twelve hues, <em>one per voice.</em>
            </>
          }
          lead="The Voiceline takes the colour of whoever is speaking. All twelve share one lightness and chroma, none sits within 25° of brass, and a sentence's origin is never shown by hue alone."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Hues scope="instrument" />
            <Hues scope="paper" />
          </div>
        </Section>

        <Section
          id="motion"
          index={6}
          title={
            <>
              Choreographed, <em>then still.</em>
            </>
          }
          lead="Eases with fixed durations for what the page does, springs for what you move. Nothing loops in the background, and with reduced motion everything is a 120 ms fade."
        >
          <MotionTokens />
          <div className="reveal">
            <MotionBench />
          </div>
        </Section>

        <Section
          id="brand"
          index={7}
          title={
            <>
              A flat line <em>that rises once.</em>
            </>
          }
          lead="The mark is the Voiceline making its peak, which also reads as a capital A. The seal is a dial, not a stamp, and every word on it comes from the model claims."
        >
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
              <BrandPanel scope="instrument" />
              <BrandPanel scope="paper" />
            </div>
            <div className="reveal card flex flex-col items-center gap-8 p-6 lg:col-span-4 lg:p-8">
              <ModelSeal id="system-seal" className="w-full max-w-60" />
              <ModelCredit className="items-start text-left" />
              <p className="flex items-center gap-2.5 self-start text-sm text-text-soft">
                <ModelSealMark size={28} />
                <span>The 28px credit mark</span>
              </p>
            </div>
          </div>
        </Section>

        <footer className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-edge pt-6">
          <p className="meta">Source of truth: docs/design/redesign/SPEC.md §2</p>
          <p className="meta">Hidden. Never indexed, off in production.</p>
        </footer>
      </div>
    </ReadingFonts>
  );
}
