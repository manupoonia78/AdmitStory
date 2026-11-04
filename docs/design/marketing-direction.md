> **OVERRIDE (2026-11-02, from Manu, supersedes anything below): Interview Studio is NOT in the launch.**
> AI interview practice (drills, voice mock interviews, the interview report, the interview plan) is deferred
> and shows as **"Coming soon"** everywhere. Honest-claims rules (§14.5) apply:
>
> - Never list interview practice as included in the $100 kit or as something that works today. Where it
>   appears (pinned sequence step 4, How it works step 8, pricing ledger, FAQ, product-screen carousel) it carries a
>   visible "Coming soon" label. Say: "Interview practice is coming soon. Kit owners get it at no extra cost when it opens."
> - Pinned sequence step 4 may keep the interview-question frame as a preview, clearly labelled "Coming soon".
> - Remove the "Interview report" screen from the product-screen carousel (replace it with the Recommender brief or the Résumé Pass).
> - **Phase 8 is deferred too (Manu, 2026-11-02, later the same day):** the expert mock interview, Connect, the
>   application tracker, After decisions and notifications are not sold or promised at launch. No expert-mock plane on
>   `/pricing`, no "After decisions" ledger group, no tracker in the free list, no expert-sessions section in `/terms`,
>   and no Cal.com or LiveKit among the `/privacy` processors. See `docs/phase-8-experts-connect-tracker.md`.

# Design direction: the marketing site (Phase 9a)

Written 2 November 2026 for the public site: the landing page `/`, and `/pricing`,
`/how-it-works`, `/privacy` and `/terms`. It works inside the §6 system as it stands: the §6.3
tokens, the §6.4 type scale, the §6.5 planes and radii, and the four §6.6 springs in
`packages/ui/src/motion.ts`. It adds no colours, no easings, no durations and no type sizes. The
one new piece of machinery is a GSAP ease built from the same four springs (see "Motion plumbing").

The concept is §6.1's: **your voice becomes light.** The site is short, and it sells one thing by
letting the visitor do it: say one sentence and watch it become the first line of an essay.

## Contents

1. References: award sites and what to take
2. Rules for every marketing page
3. Motion plumbing
4. The landing page, section by section
5. `/pricing`
6. `/how-it-works`
7. `/privacy`
8. `/terms`
9. Shared chrome: nav, footer, theme switch, metadata
10. Performance plan
11. Build map, gates and what Manu provides

---

## 1. References

### Award winners

These set the bar for feel and craft. They aren't designs to copy (§0), and several are named here
mainly for what to leave out. Award facts are as reported on 2 Nov 2026. Check the links again
before quoting any of them in public.

| #   | Site and award                                                                                                                                                                    | What to take                                                                                                                                                                                                                                                                      | What to leave                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Lando Norris](https://landonorris.com), OFF+BRAND. Awwwards Site of the Year 2025 ([case](https://www.itsoffbrand.com/our-work/lando-norris))                                    | One real-time set piece (the 3D helmet) surrounded by a fast editorial page. The Voiceprint is our helmet: the only WebGL on the page, with everything around it in plain HTML.                                                                                                   | The neon yellow on near-black palette, which is §6.1's "near-black with one acid accent". Also the signature stroke drawn across the headline: our mark is the Voiceprint, not a pen. |
| 2   | [Messenger](https://abeto.co), Abeto. Awwwards Developer Site of the Year 2025                                                                                                    | A tiny world that holds its frame rate on a phone. One-finger controls. The hero must work with one thumb: one big button, and nothing that needs hover.                                                                                                                          | The hand-drawn ink outline look. It would fight the light-based Voiceprint.                                                                                                           |
| 3   | [Dropbox Brand](https://brand.dropbox.com), Daybreak. CSSDA Website of the Year 2025, Best UX ([case](https://www.awwwards.com/case-study-dropbox-brand-guidelines.html))         | Small toys that teach the product, and structure plus accessibility before motion (they logged 200+ QA issues on timing). Our toy is the "Show your words" switch on a live Workspace excerpt (§4.6).                                                                             | The slot machine itself. One toy is enough; a page full of toys loses the hero.                                                                                                       |
| 4   | [The Symphony of Vines](https://www.symphonyofvines.com), Unseen. CSSDA WOTY 2025, 2nd                                                                                            | A story told in chapters, with each change of chapter feeling like a film cut. This is how the pinned sequence (§4.3) moves between its four frames.                                                                                                                              | Cinematic video and ambient sound. We have no real footage worth that weight, and sound stays off (§6.6).                                                                             |
| 5   | [Charles Leclerc](https://charlesleclerc.com/en/), Apart and Uprising. CSSDA WOTY 2025, 3rd                                                                                       | Pacing that matches the reader's state. The marketing site can be fast and confident. Inside the product it goes quiet (§6.1), and the site should say so in its screens: calm, still UI.                                                                                         | Heavy photography. We have no hero photography, and stock portraits of "applicants" would be fake.                                                                                    |
| 6   | [Scout Motors](https://www.scoutmotors.com), Locomotive. Awwwards E-commerce SOTY 2025                                                                                            | The story, the configurator and the purchase run as one continuous flow. The visitor's own line made in the hero carries through sign-up into Story Studio (§4.2, "Keeping the line").                                                                                            | A configurator. There is nothing to configure before you've talked.                                                                                                                   |
| 7   | [Why Zero](https://why.zero.university), Zero Design Studio. Awwwards SOTM Sep 2026 and Developer Award                                                                           | The form is the delight. An education product whose sign-up is the experience. Ours is the hero: speaking is the form.                                                                                                                                                            | Origami, game maps, cursor-reactive text sprites. White with one green.                                                                                                               |
| 8   | [Oryzo AI](https://oryzo.ai), Lusion. Awwwards SOTM Apr 2026 and Developer Award, WPO 8.6 ([write-up](https://blog.lusion.co/oryzo-bts-part-3-7-website-ux-ui-and-illustrations)) | Restraint rules: about 99% of the type in one family, a four-colour palette, the product dead centre, and dry humour in the small copy. Our counts are two families (Geist, plus Newsreader as the spoken voice) and the §6.3 tokens. One line of dry humour per section at most. | Cream with orange, which is too close to §6.1's "warm cream with terracotta".                                                                                                         |
| 9   | [The Renaissance Edition](https://www.shopify.com/editions/winter2026), Shopify. Awwwards SOTM Feb 2026, Animations 9.4, WPO 8.4                                                  | A long feature list turned into a few framed exhibits, and still fast. Our "real screens" row (§4.5) is five framed exhibits in a native sideways scroller, each with one sentence.                                                                                               | Generative paintings, and scroll-jacked horizontal galleries. Ours scroll sideways natively, with snap.                                                                               |
| 10  | [ERA Residence](https://www.era-residence.com) and [Son Daven](https://sondaven.com/en), The First The Last. Awwwards SOTM Aug and Jun 2026                                       | Craft in the details: the FAQ, the footer and a day/night switch finished to the same standard as the hero. Our Night/Day switch in the footer is a small instrument, not a checkbox (§9).                                                                                        | The crafted preloader. §6.1 forbids waiting, so the page paints at once and nothing counts up to 100%. Also Son Daven's warm beige palette.                                           |
| 11  | [Terminal Industries](https://terminal-industries.com), REJOUICE. Awwwards SOTM Sep 2025                                                                                          | A dull subject made gripping by scroll storytelling, on Vercel with an ordinary framework. Proof that the pinned sequence is a normal engineering job.                                                                                                                            | Its accessibility score of 7.0. We beat it: real text, focus rings, reduced motion, and a sequence that reads correctly with no scrolling at all.                                     |
| 12  | [Exat Typeface](https://exat.hottype.co), Studio Size. CSSDA Best UI 2025                                                                                                         | Type does the work. The hero is a 144 px Geist line with almost no imagery beside the Voiceprint. The "variable weight answers your voice" rule (§6.4) is our version of kinetic type.                                                                                            | Width-axis tricks. Geist has a weight axis only.                                                                                                                                      |
| 13  | [By-Kin](https://by-kin.com), named by a 2026 Awwwards juror ([list](https://www.hontran.dev/blog/best-award-winning-websites-2026))                                              | "Confident editorial typography, weighted smooth scroll, transitions that never call attention to themselves." This is the tone for everything outside the hero and the pinned sequence: Lenis on desktop, and no section that animates itself.                                   | Nothing in particular. It's a tone reference.                                                                                                                                         |
| 14  | [Floema](https://www.floema.com/en), Bürocratik, and [MindMarket](https://mindmarket.com), Louis Paquet. Awwwards SOTM May 2026 and Dec 2025                                      | Listed to record the decision against them. Floema's hero video that grows out of the headline hurts LCP, and we have no real session footage. MindMarket's stacked before/after cards are §6.1's "identical rounded cards".                                                      | Both patterns.                                                                                                                                                                        |

### Product-site craft (not award sites)

| Reference                                                               | What to take                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) | The checklist for every page: honour reduced motion, animate only transform and opacity, let input cancel animation, `tabular-nums`, curly quotes, a space between number and unit, explicit image sizes, `<video>` over GIF, native elements first. |
| [Granola](https://www.granola.ai) and [Linear](https://linear.app)      | Section order for a product page: hero → live product → a pinned before/during/after story → real UI → trust → pricing → FAQ → footer. Real UI crops, never illustrations. A near-monochrome palette where the product carries the colour.           |
| [Benji Taylor, "Family Values"](https://benji.org/family-values)        | Put elaborate delight on rare actions (speaking your first sentence) and keep frequent ones subtle (nav, FAQ).                                                                                                                                       |
| [Cartesia](https://cartesia.ai)                                         | A voice demo in the hero: one button, and the microphone is asked for only after the tap. The difference is that ours captures, it doesn't converse.                                                                                                 |

---

## 2. Rules for every marketing page

- **One hero moment per page (§6.7).** The landing page has two linked set pieces, the hero and the
  pinned "follow one sentence" sequence, because §6.7 names both. Nothing else on any page
  animates on its own or on scroll. There are no section fade-ins: every section below the hero
  is fully painted when it scrolls into view.
- **Tokens only.** `--space`, `--depth`, `--edge`, `--text`, `--text-soft`, `--signal`, `--voice`,
  `--voice-glow`, `--silver`, plus the status colours where a status is shown. `--voice` appears
  only on applicant material: the Voiceprint, the visitor's own line, and the sample applicant's
  own words. Buttons, links and the nav never borrow it.
- **Night is the marketing default** (§6.3 lists the landing as immersive). The hero and the
  pinned sequence always sit in `<ImmersiveScope>` (Night). Every other section follows the
  theme cookie: Night if none is set, Day if the visitor chose Day. Essay sheets are Day paper
  planes (`data-theme="day"`) in either theme, as in the Workspace.
- **Two families.** Geist for display and UI. Newsreader for anything spoken or written by a
  person: the subline under the hero, transcripts, essay lines, interview questions and the
  integrity list. The one exception is the hero's live transcript, which §6.4 sets in Geist so
  its weight can answer the voice; it turns into Newsreader as it lands in the essay. That split is the brand: the product's precision against the person's voice.
- **Scale contrast is the layout.** Every section pairs one display line (64–144 px) with small UI
  text (13–17 px). There's nothing in between except reading text (19/21).
- **Sentence case. No eyebrow labels. No arrows on buttons. No sparkles. No exclamation marks.**
  Headings stand alone, with no label above them. Chapter markers are a 13 px margin note
  ("1 of 4"), not a label.
- **Planes, not cards.** Pricing is one plane split by a hairline. The FAQ is a list. Screens sit
  in a plane with a 1px `--edge` and, in Night, the `--plane-light` inner edge. There are no drop
  shadows on static elements.
- **Honest claims (§14.5).** No testimonials, ratings, user counts or logo walls until real ones
  exist. No "guaranteed", no odds, no "undetectable", no implied affiliation. School names are
  text, never logos. Every number shown is either a price or comes from the database with its
  date. The sample applicant is labelled fictional wherever they appear.
- **Copy (§6.9).** Plain, warm, direct. Buttons name the exact action. Never "Oops", "Something
  went wrong", "Unleash", "Supercharge" or "Journey". No praise of what the visitor said.
- **Accessible at tier 1.** Every page is complete and good-looking with WebGL off, GSAP not
  loaded and reduced motion on. Real text throughout (no text drawn on canvas). Focus rings use
  the §6.12 token. Touch targets are at least 44 px.

---

## 3. Motion plumbing

**Springs everywhere.** CSS uses `--spring-*` and `--spring-*-duration` from `tokens.css`. Motion
(the Workspace toy and the `/how-it-works` assembly) uses `spring(token)`. GSAP gets the same
curves:

- Add `packages/ui/src/motion-curves.ts`. It holds `springSamples(token)` (the same 2 kHz
  simulation `cssSpring` uses, moved here and imported by `motion.ts`) and
  `springEase(token): (t: number) => number`, which linearly interpolates those samples. It must
  not import `motion/react`, so the GSAP island doesn't drag Motion into its chunk.
- Timed GSAP tweens use `{ duration: SETTLE_SECONDS[token], ease: springEase(token) }`: snap 0.35,
  glide 0.48, drift 0.68 and settle 1.12 s. These are the token durations already in
  `tokens.css`.
- Scrubbed timelines use `ease: "none"` inside the timeline, because scroll position is the
  clock. The spring comes back in `snap.ease: springEase("drift")` when the sequence comes to
  rest on a chapter. `scrub: true`, with no lag number. On desktop, Lenis supplies the smoothing.
- Stagger delays (for example 40 ms between words) are delays, not new easings.

**Libraries**, used on marketing routes only (§6.11):

| Library                                               | Version (checked 2 Nov 2026)    | Used for                                                                     | Loaded                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gsap` (core, ScrollTrigger, SplitText)               | 3.15.0, free for commercial use | The pinned sequence, and the line-mask reveal of its four chapter statements | Dynamic import from `(marketing)/_motion/follow-host.tsx`, desktop only (`(min-width: 1024px) and (pointer: fine)` and no reduced motion), when `#follow` is one viewport away |
| `@gsap/react`                                         | 2.1.2                           | `useGSAP()` for scoped cleanup under StrictMode                              | Same chunk                                                                                                                                                                     |
| `lenis`                                               | 1.3.27                          | Smooth scroll on desktop marketing pages                                     | Same chunk, started on the first wheel event. `autoRaf: false`; driven by `gsap.ticker` with `lagSmoothing(0)` and `lenis.on("scroll", ScrollTrigger.update)`                  |
| `motion`                                              | 14.7.1 (installed)              | The Workspace toy (§4.6) and the `/how-it-works` assembly                    | Inside their own dynamic hosts                                                                                                                                                 |
| OGL (through `Voiceprint`)                            | installed                       | The hero Voiceprint                                                          | The existing lazy renderer import, gated as in §10                                                                                                                             |
| View Transitions (`<ViewTransition>` from React 19.3) | built in                        | Carrying the hero line to `/sign-in`, and the nav between marketing pages    | Built in                                                                                                                                                                       |

Re-check the GSAP licence page at build time, as §6.11 asks. GSAP and Lenis never load on phones,
tablets, touch-only devices or under reduced motion. Those visitors get native scroll and the
stacked sequence, which is the better experience there anyway.

**Reduced motion, in one place.** Every spring becomes a 120 ms opacity fade (tokens.css already
does this). The Voiceprint is the still SVG. There's no pin, no Lenis, no flight and no line
masks. View Transitions get `::view-transition-group(*) { animation: none }`.

---

## 4. The landing page

### Overview

| #    | Section                      | Height (desktop / phone)               | Moves?                                       |
| ---- | ---------------------------- | -------------------------------------- | -------------------------------------------- |
| 4.1  | Nav                          | 64 / 56 px, floating                   | Compacts after the hero (`glide`)            |
| 4.2  | Hero: "Say one thing"        | `100svh` / `100svh`                    | **Hero moment 1**                            |
| 4.3  | Follow one sentence          | Pinned for about 4 viewports / stacked | **Hero moment 2** (desktop); quiet on phones |
| 4.4  | How it works, in three lines | About 0.8 viewport                     | No                                           |
| 4.5  | Real screens                 | About 1 viewport                       | Native sideways scroll only                  |
| 4.6  | Your words, lit (the toy)    | About 0.9 viewport                     | Only when the visitor uses the switch        |
| 4.7  | What AdmitStories won't do   | About 1 viewport                       | No                                           |
| 4.8  | Pricing                      | About 0.9 viewport                     | No                                           |
| 4.9  | Questions                    | Content height                         | The `<details>` open on `glide`              |
| 4.10 | Start free, and footer       | About 0.9 viewport                     | No (the theme switch on `snap`)              |

The sample applicant used throughout is the Phase 0.5 one: a fictional hospital systems analyst
writing for "Northfield", a fictional school (`apps/web/app/prototype/workspace/essay.ts`). Their
sentence is the verbatim line `L041`:

> It was 2 a.m. and the feed from the lab system was dropping every fourth message.

Wherever this person appears, a 13 px note reads: "A sample applicant. Fictional, as is
Northfield."

### 4.1 Nav

**Desktop.** A floating plane 16 px from the top. The wordmark "AdmitStories" (Geist 600, 17 px) is
on the left. On the right are "How it works", "Pricing", "Sign in" (text links, UI 15) and "Start
free" (primary, solid `--signal`, `--on-signal` text, 8 px radius, 40 px tall). Over the hero the
plane is transparent with no edge. Once the hero has scrolled past, it compacts to `--depth` at
88% with a faint backdrop blur (content scrolls beneath it, which §6.3 allows) and a 1px
`--edge`, on `glide`. It carries `view-transition-name: site-header` with its animation
suppressed, so it stays still between pages.

**Phone.** The wordmark on the left, "Start free" on the right, and a 44 px "Menu" text button
that opens a full-height `Sheet` (radius 28 at the top, `glide`) listing the three links in
display-sm. No hamburger icon on its own: the word "Menu" is the control.

### 4.2 Hero: "Say one thing about yourself"

**Job.** In 30 seconds, show the whole product promise with the visitor's own voice: you talk, and
your words, unchanged, become the line an essay is built on.

**Layout, desktop (1280+).** A Night stage, `100svh`, `--space` with grain.

- The Voiceprint fills the screen: a `size="fill"` box of `min(112svh, 100vw)` centred on the
  stage. It's slightly larger than the viewport, so the form bleeds past the top and bottom
  edges. It's the subject, not wallpaper: it responds to the visitor and is still when nothing
  happens.
- The H1 sits bottom-left over the form, columns 1–9, two author-set lines in Geist 600,
  `--type-display-xl` (144 px), tracking −0.04em, leading 0.95:
  "Say one thing / about yourself."
- The subline is Newsreader 21/32 in `--text-soft`, columns 1–5, 24 px below the H1.
- The actions row is 32 px below the subline:
  - "Speak for 15 seconds" is the record button (the existing `RecordButton`, 72 px circle) with
    its label beside it in UI 17.
  - "Play a sample" is a secondary button: a ghost with a `--control-edge` border.
  - "Write instead" is a text link.
- The privacy line under the actions is UI 13, `--text-soft`.
- Bottom-right, a 13 px margin note: "Scroll to follow one sentence through AdmitStories". There's
  no bouncing chevron.

**Layout, phone (0–639).** The same stage. The Voiceprint is a `120vw` box centred in the top 55%
of the screen. The H1 is `--type-display-lg` (48 px) on three author-set lines ("Say one / thing
about / yourself."), done with a single text node and a phone-only `<br>`, so screen readers hear
one sentence. Under it are the subline (Newsreader 19/32), then the record button full width as
a 56 px bar with the circle at its left, then "Play a sample" and "Write instead" side by side.
Everything sits in the thumb zone at the bottom. From 640 px the desktop structure applies with
the type scale's own clamp.

**Copy.**

- H1: "Say one thing about yourself."
- Subline: "AdmitStories listens to your life story and turns it into your MBA application, one
  school at a time, in your own words."
- Privacy line: "Fifteen seconds. Your audio is turned into text and not kept, and neither is
  the text unless you sign up."
- Mic explainer (§6.9, verbatim): "AdmitStories needs your microphone to hear your answers. Audio is
  turned into text and not kept unless you choose to." Buttons: "Allow microphone" / "Write
  instead". (Fix the casing to "AdmitStories" in `microphone-copy.ts` when this ships. Both
  spellings appear in the spec; `APP_NAME` is "AdmitStories".)
- Sample label: "Sample voice, synthesised. The applicant is fictional."

**The choreography.** The H1 is never hidden, moved or re-rendered: it's the LCP element. The
moment lives in the Voiceprint and the words.

| Step                  | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Motion                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 0. First paint        | H1, subline and actions in HTML. `VoiceprintStill` server-rendered as the poster (sample applicant's identity, `mood="idle"`, `aria-hidden`; the figure has the label "A Voiceprint: a form drawn from the way someone speaks").                                                                                                                                                                                                                                                                                                                                                           | None                                                                                     |
| 1. The form wakes     | When the WebGL renderer is ready (gating in §10), the canvas cross-fades over the poster and starts breathing in `idle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Opacity on `glide`; breathing on `settle`                                                |
| 2. Tap "Speak"        | The explainer plane opens under the button with the §6.9 copy, and the invisible Turnstile widget renders inside it. "Allow microphone" calls `getUserMedia`, fetches the scoped STT token and opens the stream. The H1 and subline dim to 35% opacity, and the form switches to `speaking` mood fed by the live `signal`.                                                                                                                                                                                                                                                                 | Explainer on `glide` (height reserved, so nothing below moves); dim on `snap`            |
| 3. Speaking           | A 15 s ring counts down around the record button, with "0:12" in tabular numerals beside it. The live transcript appears centred over the form in Geist 500 at `--type-display-sm` (32–40 px), interim words at 40% settling to 100% (`LiveTranscript`). The active line's weight shifts ±60 with amplitude (§6.4), through `font-variation-settings` and a CSS variable written from the signal ref, never React state. The transcript box has a fixed height of three lines, and `contain: layout paint` keeps reflow local.                                                             | Interim to final on `snap` (opacity and weight only); weight follows amplitude per frame |
| 4. Stop               | At 15 s, on "Done", or after 2.5 s of silence after a sentence end (the Studio rule). Fillers are removed in code ("um", "uh", "you know", repeated words), the first letter is capitalised and a full stop added. If more than 40 words came through, the first full sentence is kept. Nothing goes to a model.                                                                                                                                                                                                                                                                           | —                                                                                        |
| 5. Words become light | Each word of the final line takes a `--voice` text glow, left to right, 40 ms apart. The form takes one bright breath (the synthetic signal spikes amplitude for 300 ms).                                                                                                                                                                                                                                                                                                                                                                                                                  | Glow on `snap`; breath on `settle`                                                       |
| 6. The sheet rises    | An essay sheet (Day paper, `--depth`, 28 px radius, max 720 px wide, Newsreader 19/32) rises from below the fold into the lower 58% of the stage. Its header (UI 13) reads "Essay 1 · first draft". Below the reserved first line are five faint ruled lines, the kit preview's locked-line treatment, so the sheet promises the rest without faking it.                                                                                                                                                                                                                                   | `drift` (translate and opacity)                                                          |
| 7. The line lands     | The words fly from the transcript into the sheet's first line along the Studio's curved flight path (`packages/ui/src/studio/flight-path.ts`), 40 ms apart, shrinking from 32 to 19 px. Each lands slightly blurred (2 px) and sharpens, and in its last 120 ms the Geist word cross-fades into the same word in Newsreader (the sheet's own text, waiting at opacity 0 in the reserved line), so the spoken line becomes written type as it lands. Then the whole line takes `--voice-glow`, which is the Workspace's your-words treatment. The transcript copy fades as its words leave. | Flight on `drift`; blur and glow on `glide`                                              |
| 8. The caption        | Under the sheet: "Word for word, that's your line. In AdmitStories every essay is built around sentences like it, and each one links back to the moment you said it." If fillers were removed: "We removed 2 filler words. Nothing else changed." Buttons: "Sign up and keep this line" (primary) and "Say it again" (ghost).                                                                                                                                                                                                                                                              | Opacity on `glide`                                                                       |

The whole moment from stop to caption is about 1.6 s, and every step can be interrupted. "Say it
again" or Escape reverses the sheet on `glide` and returns the form to `idle`, from wherever the
animation has got to.

**"Play a sample".** It plays `public/marketing/sample-line.opus` (the L041 sentence, about 6 s,
generated once with the Deepgram Aura-2 voice and committed). Alongside it is
`sample-line.json`: word timings, plus a 60 Hz amplitude, centroid and pitch-delta envelope. The
envelope drives the form through `synthetic-signal.ts`, and the transcript brightens word by word
against the timings (`TimedText`). Then steps 4–8 run. The sample's form uses the sample
applicant's identity. The audio is `preload="none"` and is fetched on the tap.

**"Write instead".** The transcript area becomes a two-line textarea in Newsreader 32 px, with the
placeholder "The night the system went down, I…" and a 200-character limit (the counter is in
tabular numerals). The button reads "Place it in an essay". Then steps 5–8 run, without the
filler step.

**The visitor's own Voiceprint.** `IDENTITY_MIN_SECONDS` is 10, so a 12–15 s answer is enough for
a usable identity. When the accumulator reports `usable`, the form's hue, filaments and swirl
re-seed to the visitor's own on the `drift` spring, and the caption adds: "That's your
Voiceprint, drawn from how you spoke. It's yours across AdmitStories." A written answer uses
`identityFromText`. If the speech is too short to be usable, the sample form stays and no claim
is made.

**Keeping the line.** The line and the identity go to `sessionStorage` (wrapped in try/catch) and
nowhere else. "Sign up and keep this line" navigates to `/sign-in?from=line` inside a transition.
The lit line is wrapped in `<ViewTransition name="first-line">` on both pages, so it flies into
the sign-in plane, where the heading becomes "Keep your first line" over the line itself. After
sign-up, the first-run's last screen shows "Start Story Studio with the line you said on our
homepage" as a checkbox, on by default. Only then is it sent to the server, as the first turn's
seed. If sessionStorage is empty or blocked, sign-in is the ordinary page.

**Empty and error states** (no "oops", and the page never blocks):

| Case                                            | Copy                                                                                              | Then                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Nothing heard                                   | "We didn't catch anything. Try again, or write it instead."                                       | Back to step 2, with focus on the record button                  |
| Microphone blocked                              | "Microphone is blocked in your browser settings. You can keep going by typing." (§6.9)            | The write-instead textarea opens, focused                        |
| Speech service busy, rate-limited or turned off | "Speaking is paused on this page right now. You can write your line instead, or play the sample." | The record button is disabled, with that text as its description |
| Turnstile failed                                | "We couldn't confirm this browser. Write your line instead, or try again in a minute."            | Write instead                                                    |
| No microphone API                               | The record button isn't shown. "Write instead" becomes the primary action.                        | —                                                                |

**Tier 2.** The same choreography with fewer particles (the renderer's own tier 2).

**Tier 1 and reduced motion.** The still SVG form (completely still under reduced motion; the
slow opacity pulse at tier 1 otherwise). Speaking still works. The transcript appears with 120 ms
fades, and there's no flight: the sheet appears in place with the line already lit. The weight
response to amplitude is off. The caption and the hand-off to sign-in are identical.

**Accessibility.** The transcript region is `aria-live="polite"`. When the line lands, a polite
announcement reads "Your line is in the essay: {line}". The record button announces its state
("Recording, 12 seconds left"). Space toggles recording only while focus is inside the hero:
there's no global key capture on marketing pages. The canvas is `aria-hidden`, and the figure has
the label.

**Backend** (one new route, no model calls):

- `POST /api/demo/stt-token` verifies the Turnstile token and rate-limits with Upstash: 3
  sessions per IP per hour, and a global daily cap set in admin. A §9b kill switch turns it off.
  It returns a scoped Deepgram key with a 30 s TTL for one connection, the `/api/stt/token`
  pattern from §7.5. The client stops sending at 15 s, and the server-side TTL ends the
  connection regardless.
- Deepgram is called with `mip_opt_out=true`. The route logs only counts, never text.
- Cost: 15 s of streaming STT is about $0.002 per visitor at Deepgram's published rate.
- With no Deepgram or Turnstile keys (dev and preview), the route returns 503 and the "Speaking is
  paused" state shows. In development, `DEMO_FAKE_STT=1` replays the sample transcript through the
  fake provider from Phase 2.

### 4.3 Follow one sentence (pinned sequence)

**Job.** Show the whole product in one minute without a feature list. One spoken sentence passes
through four real screens: transcript, story, essay line and interview question.

**Desktop (1024+ with a fine pointer, no reduced motion).** A Night stage pinned for about 3.2
viewport heights of scroll. Two columns:

- Left, columns 1–5: the chapter statement in Geist 600 `--type-display-lg` (96 px), two short
  lines, with a Newsreader 19/32 paragraph under it in `--text-soft`. The margin note above it
  ("1 of 4", UI 13, tabular numerals) isn't a label: it's a position readout and it changes in
  place.
- Right, columns 6–12: the frame. It's a plane (`--depth`, 16 px radius, edge light) holding a
  real component rendered with fixture data, not a screenshot: the components exist in
  `packages/ui`, and real HTML stays sharp and selectable.
- The sentence is one absolutely positioned element in Newsreader, layered above the frames. It
  is the shared element: it travels from frame to frame, re-sized and re-coloured, while the
  frames cut under it.

| Chapter | Statement (display)                  | Paragraph (Newsreader)                                                                                                                                                 | Frame (real components, fixture data)                                                                                                                                                                                                                                                | The sentence                                                                       |
| ------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1       | "You say it, / once."                | "Story Studio asks one question at a time and listens. Talk for twenty minutes or two hours. Nothing is asked twice."                                                  | Story Studio: the `SpokenQuestion` "You led the go-live with no manager in place. What was the moment you were most worried it would fail?", a small `VoiceprintStill` and the `LiveTranscript` with the sentence in it.                                                             | Transcript text, Newsreader 21, in place                                           |
| 2       | "It becomes / a story."              | "Every story you tell is kept with its facts: who, when, what changed, the numbers. You check them once, and they stay the same everywhere."                           | A `StoryCard` (expanded): "The night-shift fix · Work, 2024", traits "Initiative" and "Impact", and three facts with "Confirmed" checks ("2 a.m. go-live", "Every fourth message dropped", "No manager in place"). The phrase ignites in `--voice` (the Studio's capture treatment). | It condenses into the card's golden-line slot, Newsreader 17                       |
| 3       | "It opens / your essay."             | "Drafts reuse your sentences where they're good, and each one keeps a link to the moment you said it. Anything you haven't told us becomes a question, never a guess." | The Workspace document sheet (Day paper) with the first two sentences of `essay.ts`, the first lit in `--voice-glow`. A small provenance plane under it: "You said this in Story Studio, 14 Oct, 9:41 pm". A `NeedChip`: "What did the vendor say when you called? About 20 words."  | It lands as the essay's first line, Newsreader 19, with the glow                   |
| 4       | "It comes back / in your interview." | "Interview practice is built from the same file, so the questions follow up on what you actually wrote."                                                               | The duet stage, still: the silver interviewer form facing a small form in the applicant's hue. The caption, in silver Newsreader: "You mentioned the go-live. What would you do differently now?" Under it, talking points from the same story (UI 15).                              | It shrinks into a quoted reference under the question ("From your Essay 1"), UI 13 |

**Choreography (GSAP, scrubbed).**

```ts
// follow-sequence.tsx: inside useGSAP, inside gsap.matchMedia({ desk: "(min-width:1024px) and (pointer:fine) and (prefers-reduced-motion:no-preference)" })
const tl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: {
    trigger: "#follow",
    start: "top top",
    end: () => `+=${innerHeight * 3.2}`,
    pin: true,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true, // recompute the sentence's target rects on resize
    snap: {
      snapTo: "labelsDirectional",
      duration: { min: 0.35, max: 0.68 }, // snap..drift settle durations
      delay: 0.08,
      ease: springEase("drift"),
    },
  },
});
```

- Labels `c1`, `c2`, `c3` and `c4` are spaced one unit apart. Within each change of chapter:
  - The outgoing statement's lines leave upward through their masks (SplitText `type: "lines"`,
    `mask: "lines"`, `autoSplit: true`, yPercent 0 → −100, staggered 0.06).
  - The incoming lines rise (yPercent 100 → 0).
  - The paragraph cross-fades.
  - The outgoing frame fades and drifts up 24 px while the incoming frame fades in from 24 px
    below. This is the film cut: only opacity and transform.
  - Across the same span, the sentence tweens x, y and scale from its rect in the old frame to
    its slot in the new one, measured on refresh. Its colour changes with it: `--text` in the
    transcript, `--voice` while it ignites, `--text` on paper with `--voice-glow` behind it, and
    `--text-soft` as a quote.
- At rest on each label, nothing moves. Users can stop anywhere, and the snap settles them on the
  nearest chapter in the direction they were scrolling.
- SplitText's built-in aria (`aria-label` on the parent, `aria-hidden` on the pieces) keeps each
  statement read as one line. `autoSplit` re-splits after the fonts load, so there's no shift.
- Under the pin, the four chapters also exist as real DOM in order. A screen reader or keyboard
  user reads chapters 1–4 as normal content, and the visual pin is only an arrangement of them.

**Phones, tablets, touch and reduced motion: the stacked version.** No GSAP. The four chapters are
stacked sections. Each has its statement in `--type-display` (40–64 px), its paragraph, and its
frame full-width below. The frame is scaled to fit with `transform: scale()` from a fixed
desktop layout of 720 px, inside a box with a fixed aspect ratio, so there's no reflow or CLS.
The sentence sits in place in each frame. Inside `@supports (animation-timeline: view())`, and only
without reduced motion, each chapter's sentence glow fades from 0 to its full opacity across
`animation-range: entry 30% cover 45%`. That is the one thing that responds to scroll, and it's
part of the hero sequence, not a section fade-in. Without support, or under reduced motion, the
glow is simply on.

**Tier 1 on desktop** (low GPU but no reduced-motion preference). The pin and SplitText still run,
because they're DOM, not WebGL. The duet frame's forms are `VoiceprintStill`.

### 4.4 How it works, in three lines

**Job.** Say the order of things and the time each takes, without a diagram.

**Layout.** Back to the page theme. A heading in `--type-display` (64 px): "Twenty minutes to a
first draft." It's honest per §2 principle 8, which says "possible from a résumé plus a 20-minute
conversation", so the paragraph under it says so. Below are three rows. Each row has a step in
`--type-display-sm` (40 px), a sentence in UI 17 `--text-soft`, and the time or price
right-aligned in tabular numerals (UI 17, `--text`). Hairline `--edge` rules sit between the rows.
On phones, the time sits under the sentence.

| Step                                        | Sentence                                                                                                                          | Right column      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| "Talk, or bring your résumé and talk less." | "Story Studio interviews you about your life and work. Upload a résumé and it only asks about the gaps."                          | "20–45 min"       |
| "See how admissions will read you."         | "A Profile Read and a school strategy, both free, with every number sourced and dated."                                           | "Free"            |
| "Unlock a school."                          | "Positioning, every essay and short answer with options and reasons, the form, your recommenders' briefs and interview practice." | "$100 per school" |

Paragraph under the heading: "That's the fast path, if you upload a résumé and talk for twenty
minutes. Most people come back for more, because the more you say, the more there is to choose
from." Link: "See how it works" (text link, no arrow).

No motion.

### 4.5 Real screens

**Job.** Prove the product is real and calm. No illustrations and no mock-ups of mock-ups.

**Layout.** A heading in `--type-display` (64 px): "Quiet where you work." A paragraph (UI 17):
"The cinematic part ends at the door. Inside, AdmitStories is still, fast and keyboard-first,
because nobody wants particles while cutting fourteen words at 1 a.m." This is §6.1, and the
section's one line of dry humour.

Below is a native horizontal scroller (`overflow-x: auto`, `scroll-snap-type: x mandatory`,
`scroll-padding-inline: 24px`, with `data-lenis-prevent-horizontal` set) of five exhibits. Each
exhibit is a plane holding a 2x capture and a caption (Geist 600 17 px name, then one UI 15
sentence):

1. **Dossier**: the constellation. "Your stories, placed by when they happened and what they
   prove."
2. **Profile Read**: the four-lens dial. "How an admissions reader is likely to see you, with the
   stories behind each part."
3. **School Strategy**: the horizon. "Rounds and deadlines on one line. Pick two schools to
   compare them."
4. **Workspace**: an essay with the Coach open. "Every draft explains itself: why this story, why
   this angle, why option A."
5. **Interview report**: the timeline. "A mock interview you can scrub through, scored against
   your own file."

**Sizes.** On desktop each exhibit is 880 × 560 CSS px (the capture at 1760 × 1120, AVIF, through
`next/image` with `sizes="(min-width:1024px) 880px, 88vw"`), with two visible and a third peeking.
On phones they're 88vw wide, one at a time with the next peeking. Keyboard users use the region,
which is focusable with the label "App screens, scroll sideways". Visible "Previous" and "Next"
buttons (44 px, text labels) appear on pointer devices.

**Captures.** They're taken from the real app with the fixture applicant
(`pnpm --filter @admitstory/web seed:fixtures`), in Night at 1440 × 900 with the dock visible, at
DPR 2. They're re-taken whenever those screens change. They're stored at
`apps/web/public/marketing/screens/*.avif` (about 90 KB each at quality 55) with explicit width
and height. Below the fold they lazy-load; none has priority.

**Motion.** None. Short loops were considered and dropped: real captures say "calm" better than
moving ones.

### 4.6 Your words, lit (the toy)

**Job.** Let the visitor feel the product's signature idea with one switch.

**Layout.** The heading in `--type-display` (64 px): "See which words are yours." To the left
(columns 1–4), a Newsreader 19/32 paragraph: "Press Y, or flip the switch. Sentences that came
from the applicant's own words light up. Hover one to see when they said it." Under it is the
Workspace's `YourWordsControls` switch (labelled "Show your words", `Y` shown beside it as a
key). To the right (columns 5–12), a Day paper sheet with the whole 200-word `essay.ts` essay in
Newsreader 19/32 at a 66-character measure, rendered with the real `YourWordsText`. The fictional
note sits under it.

**Behaviour.** Off by default, then the glow turns on along the `glide` easing on background
opacity. Hovering or focusing a lit sentence shows its source line in the provenance plane
(`snap`). This is exactly the Workspace behaviour, so the marketing page shows a real component.
`Y` works only while focus is inside the section.

**Phone.** The switch above the sheet, full width. Tapping a lit sentence opens its source under
it.

**Loading.** The section is rendered on the server with the switch off (the essay is plain text,
so it reads fine). The interactive island is a `next/dynamic` host that loads when the section is
within one viewport.

**Reduced motion.** The glow switches with no fade.

### 4.7 What AdmitStories won't do

**Job.** Trust. This is the section a sceptical applicant (or their consultant) reads twice.

**Layout.** On a Night plane in either theme (it's a statement, and it needs the dark): the
heading in `--type-display-lg` (96 px), "What it won't do." Then five lines in Newsreader at
`--type-display-sm` (32–40 px), `--text`, each separated by a hairline, numbered in the margin in
UI 13 tabular numerals. There are no icons.

1. "It won't invent a story, a number or a quote. If something's missing, it asks you."
2. "It won't promise admission, or tell you your odds."
3. "It won't write your recommenders' letters. It gives them a brief; they write the letter."
4. "It follows each school's rules on AI. Where a school asks you to disclose AI help, it drafts
   an honest disclosure for you to edit. Where a school doesn't allow AI-written answers, it
   coaches instead of writing."
5. "It doesn't keep your voice. Audio is turned into text and discarded, unless you ask us to
   keep it."

Under the list is a quiet line (UI 15, `--text-soft`): "We check each school's AI policy on its
own website every cycle. Here's what we have on file:" Then a compact table from the
`ai_policy` registry: school, stance in words, verified date. It shows only entries with a
verified date. It's server-rendered, cached for one hour, and limited to six rows with "See all
schools' AI policies" opening `/how-it-works#ai-policies`. **Until Manu verifies the policies,
the table isn't rendered**, and the line instead reads "Each school's policy is shown in the app
with the date we checked it."

No motion.

### 4.8 Pricing

**Layout.** One plane split by a vertical hairline on desktop, and stacked with a horizontal one
on phones. These are not two cards.

- **Left: Free.** "$0" in `--type-display-xl` (144 px on desktop, 64 px on phones), tabular. The
  line "Talk, and see how you'll be read." (Newsreader 21). Then a plain list (UI 15, a 2 px
  `--verified` tick plus words):
  - Story Studio, by voice or typing
  - Your Story Bank and Fact Sheet
  - Profile Read: how admissions will likely see you
  - School Strategy and the round planner
  - The application tracker
  - A preview of each school's kit: the positioning, which story goes where, and every
    deliverable, locked
- **Right: School kit.** "$100" in the same size, with "per school" beside it in UI 17
  `--text-soft`. The line "Everything one school asks for." Then the list:
  - Positioning and a file map for that school
  - Every essay and short answer, with options and the reasons for each
  - Refinement until you're happy (fair use)
  - Form entries and a résumé pass
  - Briefs for your recommenders
  - An interview plan, practice drills and full voice mock interviews
- Under the plane, full width (UI 15):
  - "Expert mock interview: $100 for 45 minutes with an admissions expert, with a written debrief.
    Book it inside the app."
  - "Prices in US dollars. Tax is added at checkout where it applies. Full refund within 7 days if
    you haven't marked anything final and have used fewer than 3 refinements."
- Actions: "Start free" (primary) and "See what's in a kit" (ghost, to `/pricing`).

No badges ("most popular"), no strikethrough prices, no "limited time".

### 4.9 Questions

**Layout.** The heading in `--type-display` (64 px): "Questions." Columns 1–4 hold the heading on
desktop; the list fills columns 5–12. Native `<details>`/`<summary>` rows: the question in Geist
500 at 21 px, hairline separated, with a 16 px plus that turns into a minus (rotation on `snap`).
The answer is UI 17/26 `--text-soft` at a 62-character measure. The opening height uses
`interpolate-size: allow-keywords` with `transition: height var(--spring-glide-duration)
var(--spring-glide)` where supported, and opens instantly elsewhere. Every row is closed by
default, and several can be open. `FAQPage` JSON-LD comes from the same data.

| Question                                  | Answer                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Does AdmitStories write my essays?"      | "It depends on the school. Where AI help is allowed, it drafts from your own words and shows which sentences are yours. Where it isn't, it coaches: questions, structure and critique, with no written answer. You can always choose the stricter mode."                                          |
| "Is that allowed?"                        | "Schools differ, so AdmitStories follows each one's published policy and shows it beside every essay with the date we checked. When a school asks you to disclose AI use, it drafts an honest disclosure for you to edit. Following the rules is still your responsibility, and we make it easy." |
| "Will it make my story sound impressive?" | "It will make it sound like you on a good day. It never adds achievements, numbers or quotes. When a sentence needs a detail you haven't given, it asks for it."                                                                                                                                  |
| "What happens to my voice?"               | "Your audio is turned into text and discarded. We don't keep recordings. Your transcripts and documents are encrypted, never used to train AI models, and deleted within 30 days if you delete your account."                                                                                     |
| "Can it tell me my chances?"              | "No. Nobody can honestly, and we won't pretend to. The Profile Read tells you what helps, what may raise doubts and what to do about it."                                                                                                                                                         |
| "Which schools are covered?"              | Rendered from the database: "Kits are ready for {n} schools: {list}." Then: "Is yours missing? Add it in School Strategy and vote for it. We cover schools by demand." If n is 0, the answer is "School kits open with the first verified packs. Story Studio and the Profile Read are free now." |
| "I'm short on time."                      | "Upload your résumé and choose the express session, about 20 minutes. It only asks about what the résumé doesn't say."                                                                                                                                                                            |
| "English isn't my first language."        | "Speak the way you speak. Story Studio understands many languages and accents. Your stories are kept in your own words, and drafts are written in the language the school asks for."                                                                                                              |
| "What about my recommenders?"             | "You get a brief for each one: the stories they can speak to and what each school asks of them. They can use a private page to record their own notes. They write their own letters; we don't."                                                                                                   |
| "Can I get a refund?"                     | "Yes, in full within 7 days of buying a kit, if you haven't marked any deliverable final and have used fewer than 3 refinements."                                                                                                                                                                 |

### 4.10 Start free, and the footer

**Final call.** A Night band. The visitor's own Voiceprint (if they spoke or wrote in the hero; it
reads from `sessionStorage` on the client and falls back to the sample's) is shown as a 240 px
`VoiceprintStill`, centred, still. Under it, in `--type-display-lg`: "Your story, told well, for
each school." This is §1's promise and the one centred display line on the page (§6.5 allows a
single-line hero statement). Then "Start free" (primary) and "Sign in" (text link).

**Footer.** On `--space` in the page theme, with a 1px `--edge` above. Four columns on desktop
and two on phones:

- **Product:** How it works, Pricing, Sign in
- **Trust:** What it won't do (anchor), Privacy, Terms, AI policies
- **Contact:** an email address (Manu provides it), and "Ask us to cover a school"
- **The theme switch** (see §9)

At the bottom (UI 13, `--text-soft`): "© 2026 {legal entity}. AdmitStories is not affiliated with
any school. School names are used only to describe which applications we support." No social
icons until accounts exist.

---

## 5. `/pricing`

**Job.** Answer "what exactly do I get for $100" in detail, and say what stays free.

**Hero moment: the kit that opens.** At the top, a single line in `--type-display-xl`: "$100 per
school." Below it (Newsreader 21): "Everything one school asks for, built from what you've told
us. Talking, your Profile Read and your school strategy are free."

Then the real `KitPreview` server components (from `packages/ui/src/kit/`) for a fictional
school, rendered with fixture data:

- the positioning headline (Newsreader 21, 66-character measure)
- the file map (deliverable, then the story it uses, titles only)
- the deliverables as rows, each with its limit, the story, faint ruled lines and a lock with the
  word "Locked"

Above the rows is one switch: "Show what unlocks" (`snap`). Turning it on lifts each lock
(opacity and a 4 px rise, 60 ms apart, on `snap`). Each row's ruled lines are replaced by the
first two sentences of that deliverable's fixture draft, streaming in sentence by sentence (180 ms
fade-up, space reserved, `StreamingText`), with the applicant's own sentences in `--voice-glow`.
Turning it off reverses. Reduced motion: an instant swap. The fictional note sits under it.

**Below the hero, no motion:**

1. **The ledger.** One two-column table, free and per school, with rows grouped by stage: Before
   you choose schools, For each school, Interviews, After decisions. Each row has a feature name
   (UI 15), a one-line description (UI 13 `--text-soft`) and "Included" or "—" in each column.
   It's not ticks in a grid of identical cells; the words carry it.
2. **Expert mocks.** A short plane: "$100 for 45 minutes with an admissions expert, live over
   video, with a written debrief in the app. Free to reschedule or cancel up to 24 hours before.
   A missed session is charged."
3. **Refunds and tax.** The refund rule verbatim, "Payments are processed by Paddle, our merchant
   of record, which adds tax where it applies and issues your receipt", and "No subscription. You
   pay once per school, for that application cycle."
4. **What we won't charge for.** "Talking to Story Studio, your Story Bank, your Profile Read,
   School Strategy, the tracker and every kit preview are free, with no card needed."
5. **Pricing questions**: the refund, coupons ("Launch codes and referral credit are applied at
   checkout") and a "Why not a subscription?" answer: "Applications have an end. You pay for the
   schools you apply to, once."

**Phone.** "$100 per school." at 64 px on two lines. The preview rows go full width. The ledger
becomes stacked rows, each with "Free" or "Per school" in words.

**No Paddle on this page.** Purchases start inside the app from a school's kit preview, where
the school and cycle are known. The CTA here is "Start free".

---

## 6. `/how-it-works`

**Job.** The full path, step by step, for the visitor who wants detail before signing up. It's
also the home of the AI-policy table.

**Hero moment: the assembly.** Heading in `--type-display-xl`: "From one conversation to every
school." Under it is the Phase 0.5 / Phase 4 `KitAssembly` with fixture data, playing once when it's
40% in view. The Voiceprint sits on the left and a fictional school's deliverables on the right.
Threads of light leave the form, pass through the chosen stories and reach each essay (`drift`),
and the first lines stream in. A "Play again" text button follows.

- First paint is a server-rendered SVG poster of the finished state (threads drawn, lines
  present).
- The island is a `next/dynamic` host loaded when the section is within one viewport (Motion
  plus OGL).
- Below 1024 px there are no threads, per the Phase 3–4 direction: stages first, then
  deliverables as a list with story names.
- Reduced motion and tier 1: the threads appear in place, opacity only, and the form is still.

**Then eight steps, no motion.** Each step is a row: a step number in `--type-display` tabular
numerals in the margin, a display-sm heading, two or three sentences in UI 17, the time it takes
or "Free" / "In your kit" right-aligned, and one real capture (AVIF, as in §4.5) where it helps.
On phones, the capture goes under the text.

1. "Tell your story." Story Studio by voice or typing; nine chapters; an express, standard or
   deep session; upload a résumé to skip what's on it. (20–90 min, free.)
2. "Check your facts once." The Dossier: stories with facts, numbers you confirm, and a fact
   sheet that stays identical across every school. (Free.)
3. "See how you'll be read." The Profile Read across the four lenses, plus a strengthening plan.
   No scores out of 100. (Free.)
4. "Choose schools and rounds." School Strategy: deadlines, medians against yours in words, and
   honest flags with sources. (Free.)
5. "Unlock a school." The kit: positioning, file map, every essay and short answer with options
   and reasons, the form and résumé. (A few minutes; $100.)
6. "Make each draft yours." The Workspace: your words lit, questions instead of guesses,
   refinement, and checks across the whole file. (In your kit.)
7. "Brief your recommenders." Briefs and a private page for them; they write their own letter.
   (In your kit.)
8. "Practise the interview." Drills and full voice mock interviews that follow up on what you
   wrote, plus a report you can scrub through. (In your kit. An expert mock is $100.)

**AI policies** (`#ai-policies`). The same registry table as §4.7, in full, with the stance in
words, what AdmitStories does for that stance (Draft mode / Coach mode / Disclosure helper), the
verified date and a link to the school's own page. It has the same rule: only verified entries,
and not shown at all until Manu verifies them.

**Close.** The integrity list (§4.7, compact, in UI 17) and "Start free".

---

## 7. `/privacy`

**Job.** A privacy policy people actually read, which is also legally complete. **Counsel reviews
the full text before launch (§14.4).** The text below is a structured draft, not legal advice.

**Hero moment: where your voice goes.** One SVG diagram, about 280 px tall on desktop, drawn in
`--edge` lines with UI 13 labels:

> Microphone → Speech-to-text (Deepgram) → **Text** → Your Dossier (encrypted) → Your drafts

At the speech-to-text node, a branch to "Audio" ends in a small closed mark labelled "Discarded".
A single dot of `--voice` light travels the path once when the diagram is 40% in view (`drift`,
CSS offset-path). It reaches "Discarded" on the audio branch and fades, while a second dot
continues to "Your drafts". Reduced motion: no dot, the diagram is static. A screen-reader
paragraph says the same in words.

**Layout.** Heading in `--type-display` (64 px): "Privacy." Under it: "Last updated {date}"
(UI 13). Each section has two columns on desktop: a short plain-language summary in Newsreader
19/32 on the left (columns 1–5), and the full text in UI 15/22 on the right (columns 6–12). A
sticky contents list sits in the left margin from 1280 px (UI 13). On phones, the summary sits
above each section's full text, and the contents list is a `<details>` at the top. The page follows
the theme cookie, Day or Night.

**Sections.** Each has its plain summary:

1. **What we collect.** "What you tell us, what you upload, and how you use the app. Not your
   voice recordings."
2. **Your voice.** "Audio is streamed to our speech-to-text provider, turned into text, and not
   stored by us. On the homepage, not even the text is kept unless you sign up."
3. **How we use it.** "To build your application and nothing else. No selling, and no
   advertising."
4. **AI providers.** "We use Anthropic's Claude for writing and analysis under commercial terms
   that don't train on your data." Name each processor: Anthropic, Deepgram, the TTS provider,
   LiveKit, Voyage, Paddle, Resend, PostHog, Neon, Vercel, Upstash, Cloudflare (Turnstile) and
   Cal.com. Each has its purpose and region. Data processing agreements are signed before launch
   (§14.4).
5. **Sensitive stories.** "Health, family, identity and similar stories stay private by default.
   They're used in drafts only if you say so, story by story." (§14.3)
6. **Security.** TLS; encryption at rest; application-level AES-256-GCM for transcripts,
   documents, recommender content and mock transcripts; staff access only through logged
   break-glass, visible to you on request.
7. **Retention and deletion.** Exports are deleted after 24 h. Deleting your account removes
   your content within 30 days, and backups expire within 35.
8. **Your rights.** Export everything (JSON and DOCX), correct any fact, delete your account, in
   Settings. Covers GDPR and India's DPDP Act. Contact for requests: {privacy email}.
9. **Analytics.** Marketing pages use cookieless analytics. In the app, analytics never includes
   essay or transcript text, and typed text is masked in session replays.
10. **Age.** 18 and over.
11. **Recommenders.** What a recommender's private page stores, and that the applicant never
    sees it.
12. **Changes and contact.** Placeholders for the legal entity, address and representative
    (EU/UK if required).

---

## 8. `/terms`

**Job.** Plain terms that encode the integrity rules (§14.7). **Counsel reviews before launch.**

**Layout.** Identical to `/privacy` (summary left, full text right). No hero moment: like the
recommender portal (§6.7), this page is maximum clarity. The heading is "Terms."

**Sections**, each with a plain summary:

1. **Who can use it.** 18+, one person per account.
2. **Your story must be true.** "You confirm that everything you tell us, and everything you
   submit, describes your own experiences truthfully."
3. **Schools' rules are yours to follow.** "We show each school's AI policy and help you follow
   it. Submitting within the rules is your responsibility."
4. **Recommenders write their own letters.** "Briefs help them. The letter is theirs."
5. **No promises about outcomes.** "We don't guarantee admission, interviews or scholarships, and
   we don't estimate your odds."
6. **What you own.** "Your stories, transcripts and drafts are yours. You give us the licence we
   need to process them for you, and nothing more."
7. **Payments.** "$100 per school per cycle through Paddle, our merchant of record." Then the
   refund rule verbatim, fair use on refinements, coupons and referral credit.
8. **Expert sessions.** 45 minutes, priced per expert; free to reschedule or cancel up to 24 h
   before; no-shows are charged.
9. **Acceptable use.** No uploading other people's essays as your own, no scraping, no abuse of
   the voice features.
10. **Availability, liability, termination, governing law.** Placeholders for counsel.

---

## 9. Shared chrome

**Theme switch (footer).** Two words, "Night" and "Day", in a 40 px segmented control (8 px
radius, `--edge`). A 2 px `--signal` indicator slides between them on `snap`. Under it, a 13 px
note: "Night is easier at 1 a.m." This is the ERA-style detail, finished to hero quality. It
writes the existing theme cookie (`theme-preference.ts`) and calls `applyThemeColor`. The hero
and the pinned sequence stay Night, and everything else follows.

**Route transitions between marketing pages.** These are App Router navigations, so
`<ViewTransition>` works. The page body cross-fades on `glide`, and the header stays still. The
landing → sign-in line flight is described in §4.2.

**Metadata.**

- The marketing layout overrides the root `robots` to `index: true` on these five pages only.
- `metadataBase` comes from the production domain (Manu provides it).
- Titles:
  - `/`: "AdmitStories: your MBA application, in your own words"
  - `/pricing`: "Pricing"
  - `/how-it-works`: "How it works"
  - `/privacy`: "Privacy"
  - `/terms`: "Terms"
- Descriptions are one plain sentence each.
- The OG image is `next/og`, generated at build: Night, a `VoiceprintStill` of the sample
  identity on the right, and "Say one thing about yourself." in Geist 600 on the left. It's
  1200 × 630.
- JSON-LD: `Organization`; `Product` with two `Offer`s ($0 and $100 per school) on `/pricing`;
  `FAQPage` on `/`.
- `sitemap.ts` and `robots.ts` list only the marketing pages.

**Analytics (marketing).** PostHog is loaded with `import()` on `requestIdleCallback` after
`load`, in cookieless mode (`persistence: "memory"`), with no session replay on marketing pages.
There are seven events: `hero_speak_start`, `hero_line_placed` (with `source: voice | sample |
written`, never the text), `hero_keep_line`, `sample_played`, `cta_start_free` (with the
location), `faq_open` (with the question id) and `pricing_unlock_toggle`.

**Signed-in visitors.** `/` stays a public page and doesn't read the session, so it can be cached.
"Sign in" leads to `/sign-in`, which already sends signed-in people to `/home`. The current
`(marketing)/page.tsx` redirect is removed.

---

## 10. Performance plan

**Budgets (spec §6.11, Phase 9 AC).** Mobile Lighthouse ≥ 90 on all five pages, with
Accessibility, Best Practices and SEO all at 100. LCP ≤ 2.0 s on a mid-range phone over 4G. CLS
< 0.02. TBT ≤ 150 ms. INP ≤ 200 ms.

**First-load JS ≤ 120 KB gzipped** for every marketing route. Add the five routes to
`scripts/bundle-size.ts` with that budget. The app shell isn't on these routes, so React and Next
(about 105 KB) are most of it. The marketing layout must not import from the app shell, Radix or
the dock.

**The LCP element is the H1**, which is server-rendered text in Geist.

- Geist is preloaded already (`GeistSans`). Newsreader stays `preload: false` with `display:
swap`, and next/font's adjusted fallback metrics keep the subline from shifting.
- The H1 has no entrance animation, no `opacity: 0` and no transform at first paint. Nothing is
  drawn on canvas.
- The poster `VoiceprintStill` is inline SVG, so there's no image request. Its box is sized by
  CSS before anything loads.

**What loads when.**

| Chunk                                                                                | Size target (gz)                | Desktop                                                                                                                  | Phone and tablet                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero-stage` island (state machine, buttons, transcript view, flight)                | ≤ 8 KB                          | First load (it's the hero's interactivity)                                                                               | Same                                                                                                                                                                             |
| Voiceprint renderer (OGL, shaders)                                                   | Existing chunk                  | After `load`, then `requestIdleCallback` (with a `setTimeout` fallback), only if the hero is in view and the tier is ≥ 2 | **Only on first interaction** (any tap, scroll or key) and tier ≥ 2. Lighthouse never triggers it, and real visitors get it on the first touch: the form "wakes when you arrive" |
| `detect-gpu` benchmarks (`/detect-gpu/`, self-hosted)                                | Existing                        | With the renderer                                                                                                        | With the renderer                                                                                                                                                                |
| `hero-demo` (mic, AudioWorklet, Deepgram socket, Turnstile script)                   | ≤ 15 KB plus Turnstile          | `import()` inside the "Speak" handler                                                                                    | Same                                                                                                                                                                             |
| Sample audio and envelope                                                            | About 40 KB Opus plus 6 KB JSON | Fetched on "Play a sample"                                                                                               | Same                                                                                                                                                                             |
| `follow` island (GSAP, ScrollTrigger, SplitText, `@gsap/react`, Lenis, `springEase`) | ≤ 60 KB                         | When `#follow` is within one viewport (IntersectionObserver) or on idle after the renderer, whichever is first           | **Never**                                                                                                                                                                        |
| Workspace toy (`YourWordsText` plus Motion)                                          | ≤ 35 KB                         | When §4.6 is within one viewport                                                                                         | Same                                                                                                                                                                             |
| `KitAssembly` on `/how-it-works`                                                     | Existing                        | Within one viewport                                                                                                      | Never (no threads below 1024 px)                                                                                                                                                 |
| PostHog                                                                              | Existing                        | Idle after `load`                                                                                                        | Same                                                                                                                                                                             |

**Don't start a rAF loop before idle.** A running loop starves `requestIdleCallback`. The
Voiceprint loop starts only after the renderer has loaded, and pauses when the hero is off
screen or the tab is hidden (already built). On phones it runs at the renderer's tier 2 with
DPR capped at 1.5.

**CLS.**

- The hero is `100svh`, and its essay sheet, explainer plane and caption are absolutely
  positioned or have reserved heights, so they never push content.
- The pinned section's height is the natural height of its stacked chapters. The pin spacer GSAP
  adds is created before the section is in view, and `anticipatePin` is set.
- Images have width and height. The screens scroller has a fixed aspect ratio. The stacked frames
  are scaled with `transform` inside fixed-ratio boxes.
- SplitText `autoSplit` re-splits after fonts load, behind the pin and off screen.

**TBT and INP.**

- No large client tree above the fold: the page is server components with three small islands.
- Splitting and measuring for GSAP happen on the island's first idle frame, never during a
  scroll.
- Lenis starts on the first wheel event.
- FAQ is native `<details>`.

**Rendering and caching.** The root layout reads the theme cookie, which makes every route
dynamic. Accept that for marketing pages (they have no data fetching beyond two cached queries),
and hold TTFB at p75 ≤ 300 ms on Vercel. Cache the two queries with `'use cache'` and
`cacheLife('hours')`:

- the schools with published packs, for the FAQ
- the verified AI-policy registry, for §4.7 and `/how-it-works`

If TTFB misses, the fallback is to move the theme decision for marketing routes into a tiny
inline `<head>` script that reads the cookie before paint, and render these pages statically.
Measure before choosing.

**Images.** AVIF through `next/image`, explicit `sizes`, all lazy (nothing above the fold is an
image). The OG image is built at build time.

**Headers.** The security headers from Phase 9b apply. CSP allows Turnstile
(`challenges.cloudflare.com`) and the Deepgram WebSocket (`wss://api.deepgram.com`) on `/` only.

**Checks.**

- `pnpm lighthouse` (mobile, throttled) on `/`, `/pricing`, `/how-it-works`, `/privacy` and
  `/terms`.
- `bundle:check` with the 120 KB marketing budget.
- A 60-second screen recording of the hero and the sequence at 1x for §6.13, made at tiers 3, 2
  and 1 and with reduced motion on.
- Verify on a real mid-range Android, as §6.11 asks: 60 fps through the hero moment.

---

## 11. Build map, gates and what Manu provides

**Files** (all new except where noted):

```
apps/web/app/(marketing)/
  layout.tsx                 marketing chrome: nav, footer, theme switch; no app shell
  page.tsx                   replaces the redirect; server sections in order
  _hero/hero.tsx             server: H1, subline, poster, actions markup
  _hero/hero-stage.tsx       client island (≤ 8 KB): state machine, transcript view, sheet, flight
  _hero/hero-demo.ts         lazy: mic, AudioWorklet, STT socket, Turnstile, filler cleanup
  _hero/line-cleanup.ts      pure: fillers, capitalisation, first sentence (unit-tested)
  _hero/keep-line.ts         sessionStorage hand-off (try/catch), read by /sign-in and first-run
  _motion/follow-host.tsx    next/dynamic host, desktop-only gate
  _motion/follow-sequence.tsx GSAP + ScrollTrigger + SplitText + Lenis
  _sections/*.tsx            how-it-works-lines, screens, your-words (+ host), wont-do, pricing, faq, final
  _data/sample.ts            the fictional applicant's sentence, story, essay excerpt, interview question
  pricing/page.tsx           + _unlock-toggle (client)
  how-it-works/page.tsx      + _assembly-host.tsx
  privacy/page.tsx, terms/page.tsx, _legal/legal-layout.tsx
  opengraph-image.tsx, sitemap.ts, robots.ts
apps/web/app/api/demo/stt-token/route.ts
apps/web/public/marketing/sample-line.opus, sample-line.json, screens/*.avif
packages/ui/src/motion-curves.ts      springSamples, springEase (motion.ts imports from it)
```

**Tests** (AC unit tests per the testing policy; no e2e):

- `line-cleanup` cases.
- `springEase` matches `cssSpring` samples.
- The STT token route refuses without Turnstile, rate-limits on the fourth call and returns 503
  when killed or unkeyed.
- Honest-claims lint: a test greps the marketing copy for the banned words in §6.9 and §14.5
  ("guarantee", "odds" outside a negation, "undetectable", "unleash", "supercharge", "journey",
  "oops") and for "!" in copy strings.
- The FAQ and AI-policy sections render nothing unverified.
- The bundle budget.

**Gates.** The HANDOFF gates, plus Lighthouse mobile ≥ 90 on the five pages.

**What Manu provides for this part:**

1. **The domain**, for `metadataBase`, the canonical URLs and the OG image.
2. **Deepgram key and Cloudflare Turnstile keys.** Until they exist, the hero offers "Play a
   sample" and "Write instead" only, which is a complete experience.
3. **The legal entity name, address and contact emails** (hello and privacy) for the footer and
   the legal pages, and **counsel's review** of `/privacy` and `/terms`.
4. **Verification of the school packs and AI policies.** Until then, the FAQ school list and the
   AI-policy tables don't render.
5. **Sign-off from screen recordings** (§6.13) of the hero and the sequence at each tier.
6. **Optional:** a motion or brand designer's pass on the Voiceprint art direction and the
   wordmark (§6.13 item 5). This direction is built to accept their tokens without structural
   change.

**Deliberately not built:**

- testimonials, ratings or user counts (none are real yet)
- a talk-to-an-AI-coach demo (cost, and it isn't what the hero sells)
- ambient sound
- a preloader
- hero video
- a blog
- per-school landing pages (`/schools/[slug]`, a good SEO follow-up once packs are verified)
