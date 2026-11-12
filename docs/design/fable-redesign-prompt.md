# AdmitStories redesign: "The Literary Instrument"

## What I want and why

AdmitStories (admitstories.com) is my AI platform for MBA applicants. An applicant tells their life story once, by voice or text, in Story Studio. AdmitStories turns it into school-by-school positioning, essay drafts that show their reasoning and mark which words are the applicant's own, recommender briefs, application-form answers, a narrative-first résumé, and introductions to real people from each school (Connect).

The product works and the site looks good, but it looks like a good AI tool, and I want more than that. When someone opens any page, the craft should stop them for a second. It should be a site people remember and send to friends, and one that could win Site of the Day on Awwwards or the FWA. Do the best design and front-end work you're capable of. Don't play it safe and don't stop at good.

**You have full freedom over the identity.** The palette, type, layout, wordmark (`components/brand-mark.tsx`), favicon, iconography, illustration language and the feel of every screen are yours to reinvent. Nothing about the current look is sacred. The direction below is my starting brief, not a cage: if you see a stronger concept, propose it in the spec with your reasons and the values that make it work. What is fixed: the product facts, honesty, accessibility and performance rules further down. Inside those, aim for the most beautiful app anyone has seen.

That ambition comes with a condition. My users are anxious, ambitious people about to spend real money on something that shapes their life. The design has to read as precise and trustworthy first and impressive second. The award winners I mean are calm and exact (editorial publications, precision instruments, well-made physical objects), not loud. Each page gets one moment of awe, staged well, and everything around it stays quiet so that moment lands.

Do not borrow layouts, flows or visual language from ApplicantLab, mbaMission onTrack or any other admissions product. Use original work only: no copied templates, no paid prompt packs, no scraped assets, no stock video. Every new visual is drawn in code (SVG, canvas, CSS) so we own it.

## What has already been tried (read this first)

This is the third visual direction, so learn from the first two:

1. **Glass + WebGL "studio" (2026-11-03): rejected the same day as looking "like a kid's site".** Chrome-gradient titles, glossy pills, floating 3D objects, unpadded and unformatted items. The lesson: effects without composition read as cheap, and so does big type set carelessly. Big display type is fine; big display type with loose spacing and no grid is not. No WebGL anywhere. `apps/web/public/detect-gpu` is a leftover from that attempt; delete it if nothing references it.
2. **"Paper" editorial (current, 2026-11-03/04).** Warm paper `#f3efe8`, ink `#1a1713`, one bronze accent, Newsreader / Hanken Grotesk / JetBrains Mono, flat ink buttons, no glows. It's calm and readable but too quiet and too familiar. Keep its discipline (one accent, hierarchy from opacity, generous padding, honest labels) and replace everything about its look.

## The product facts you must design around

These are true today. Never contradict them in copy or visuals. Where my older notes disagree with the code, the code wins, and you should tell me.

**Name and voice.** The brand is **AdmitStories**: one word, capital A and S. The package scope stays `@admitstory/*`. Contact addresses are hello@ and privacy@admitstories.com (`apps/web/app/(marketing)/_copy/chrome.ts`).

**Pricing** (source: `apps/web/lib/payments/plans.ts`, `(marketing)/_data/pricing.ts`; read the prices from there and never hard-code them):
- Free: talking in Story Studio (the first 30 answers), the Profile Read, and a school strategy/preview per school.
- 1 school: $100.
- **5 schools: $349**, the hero offer: "usually $500" in strikethrough plus a "most chosen" badge.
- 10 schools: $699.
- The pricing story: other services charge about $349 for guidelines only; we draft the essays.
- **All sales are final.** Never mention, promise or design for refunds anywhere.

**Live vs. coming.** Payments run live on Dodo Payments. Don't touch checkout behaviour.
- **Interview practice is NOT live.** It's deferred (`apps/web/lib/interview/coming-soon.ts`, full spec in `docs/phase-7-interview-studio.md`). The promise is that kit owners get it free when it opens. The marketing site may show it only as clearly labelled "coming soon". Never write "interview prep included" as if it exists today.
- **Expert 1:1 mock interviews are deferred** (Phase 8, `docs/phase-8-experts-connect-tracker.md`). No add-on card.
- The Tracker is deferred too. Keep its current state.

**Claims.** Every claim about the model comes from `apps/web/lib/model-claims.ts` and only from there: "trained on 500+ admitted MBA essays", "built with an admissions consultant and admissions directors from different schools", the seal and the ledger. Keep the seal (`components/model-seal.tsx`) as a brand element and redesign how it looks if you like, but never rewrite the claims or add new ones.
- Never invent testimonials, admit rates, user counts or school endorsements.
- Where social proof will go, build a `SocialProofSlot` component that renders **nothing** in production until I give it real content, and comment where it sits. No visible empty boxes and no placeholder copy ship. (`components/placeholder-copy.ts` and its test enforce this.)

**Samples.** All sample applicants are fictional, and the fictional school is "Northfield". Keep the existing varied samples: the night-shift analyst (`_data/sample.ts`), the fintech PM (`_data/sample-words.ts`) and the family packaging business (`_sections/app-preview.tsx`). Any new sample is a new fictional person, not the same one again. School-specific example stories (`lib/strategy/showcase-stories.ts`) stay labelled "illustrative, not a real client".

**Connect faces.** The stock faces in `public/people` are existing, labelled illustrative portraits. They show roles only, never names or schools. Keep them labelled. The "drawn in code" rule applies to new visuals.

**Schools.** 16 verified school packs are published. Show school names as plain typeset text. No logos or crests. The landing list is `(marketing)/_data/schools.ts`.

**No microphone on the landing page.** Manu decided this on 2026-11-12: no live mic demo and no Turnstile on `/`. The hero is a scripted, procedural sample. The existing "Write your own line" toy runs entirely in the browser. It may stay, move or be redesigned, but it must remain client-only.

## How to work

**Read before you design.** Go through the repo: the stack (Next 16, React 19, Tailwind 4, pnpm + turbo monorepo), the routes, `packages/ui` (tokens.css, theme.css, render.css, motion.ts, springs.ts, the studio/workspace/shell components), the marketing sections, and `HANDOFF.md`. Keep every route, every piece of working functionality and all data handling.

This is a presentation-layer job. Don't touch backend logic, APIs, auth, payments, the DB schema or the prompts in `packages/ai/src/prompts`. If a screen genuinely can't work without such a change, stop and tell me first.

**Write the spec before any code**, at `docs/design/redesign/SPEC.md`. It should read like a senior designer's brief to a developer:
- real values for every visible element: size per breakpoint, weight, line-height, tracking, and colour with opacity;
- motion for every element: trigger, delay, duration, easing, and from → to;
- no adjective standing alone: "premium" or "cinematic" must come with the values that produce them;
- a page-by-page "signature moment" table: one memorable moment per page, what it is, and what it costs in JS and per-frame time.

Phase 0 writes the system and the landing hero to full values, and every other screen as a composition sketch (layout, signature moment, key type sizes). Each later phase starts by expanding its own screens in the spec to full values, then builds them. The spec is the source of truth between sessions: when you change a value while building, change it in the spec too.

**Build the system first.** Put tokens, the type scale, the one surface material, buttons, inputs, cards and the motion utilities in one place (`packages/ui`). Then build screens from it. Reuse it everywhere instead of styling things one-off. Keep the existing utility names in `render.css` (`plane`, `eyebrow`, `meta`, `placeholder`, etc.) working, or migrate every caller in the same change.

**Build one screen at a time, then look at it.**
1. Take screenshots at 1440×900 and 390×844 (plus a 375px check for horizontal scroll).
2. Look at them as images and score the screen against the rubric at the end.
3. Fix the three weakest scores with concrete value changes and screenshot again.
4. Move on only when the average is 8+ and nothing is below 7.

**Report with evidence** in `docs/design/redesign/REPORT.md`, with images in `docs/design/redesign/shots/` (`before/` taken in Phase 0, `after/` as each screen lands). For each screen include before/after screenshots, the scores, and anything you couldn't do. Don't claim something works unless you've seen it working.

### Environment rules (these protect production)

- **The repo-root `.env.local` points at the PRODUCTION database.** Never run migrations, seeds, `packs:publish`, `admin:*` or any DB script with it.
- For signed-in screenshots, run a local Postgres:
  1. `brew install postgresql@17 pgvector` (already installed); initdb into a scratch dir; then `pg_ctl -o "-p 5455 -k '' -h 127.0.0.1"`.
  2. Run `packages/db` migrate and `apps/web` `seed:fixtures` with `DATABASE_URL` set in the shell environment. Real env vars override `.env.local`.
  3. Start the app the same way, with blank RESEND, TURNSTILE and ANTHROPIC values.
  4. Sign in through the magic link written to `.outbox`.
  5. Leave port 5433 alone. That's Manu's own database.
- Browsers: Playwright from `@playwright/test` with `chromium.launch({ channel: "chrome" })`, because the sandbox can't download browsers. Use `@axe-core/playwright` for accessibility. Use `waitUntil: "load"` on `/sign-in`.
- Work on the branch `redesign/literary-instrument` (Phase 0 creates it off `phase-0`). Commit to that branch only, as described in the session protocol, so a new session can always see where things stand. Never commit to `main` or `phase-0`, never push and never deploy. I review and merge.
- Gates, run on every screen: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter @admitstory/web bundle:check`.
  - Don't write new tests. Testing waits until after launch.
  - Keep the existing tests passing. Update `packages/ui/src/contrast.test.ts` and the motion tests to match the new tokens instead of deleting them. The contrast test is your AA check.

## Design direction (REDESIGN mode)

**Concept: "the literary instrument."** A premium editorial publication crossed with a precision instrument: warm, human typography carrying the story inside a quiet, exact interface.
- **Dark** for the marketing site, Story Studio and the interview room.
- **Warm paper** for reading and writing: the essay editor, the school workspace documents, the recommender portal and legal pages.

**Signature idea, the thing people remember: voice becomes story becomes essays.**

In the hero, a fine-line waveform runs along the lower third. It's drawn in SVG or canvas and driven by procedural noise, not audio. As it "speaks", the words of a fictional applicant's sentence surface above it one at a time in italic serif. After a beat, the sentence lifts and splits into three essay cards ("Why Northfield", "Short-term goal", "A time you led") that settle into a fanned stack on the right. Each card has a thin margin note in mono showing the reasoning, for example: *"leads with the 3 a.m. call: ownership before title."* Then it loops with a different fictional sentence.

- It replaces the current "See it happen" hero sample and reuses its fictional lines where they're good (`_hero/hero-demo.ts`, `_copy/hero.ts`).
- The animation pauses when offscreen and when the tab is hidden.
- It renders as a composed, beautiful still frame under `prefers-reduced-motion`. Design that frame on purpose.
- It never blocks the headline or the CTA. The H1 is server-rendered and is the LCP element; the animation is a lazy island.
- The canvas costs under 4ms per frame and stops when hidden.
- This is the only heavy effect on the landing page. Everything else stays quiet.

**One moment per page.** Every other page and app screen gets one smaller choreographed moment that belongs to its job, defined in the spec table. Examples:
- Story Studio: the waveform answering your voice.
- Dossier: chapters drawing onto the timeline.
- School workspace: positioning lines settling in.
- Essay editor: your own words lighting up as yours.
- Unlock: the pack assembling.

Nothing beyond that one moment per page.

**Colour tokens** (refine in the spec, keep the logic):

```css
:root{
  --bg:#0A0A0B;            /* marketing, Studio, interview room */
  --fg:#F4F1EA;            /* warm paper white */
  --fg-80:rgba(244,241,234,.80); --fg-60:rgba(244,241,234,.60); --fg-40:rgba(244,241,234,.40);
  --line:rgba(244,241,234,.12);
  --paper:#F7F5F0; --ink:#141414; --ink-60:rgba(20,20,20,.62);   /* reading + writing surfaces */
  --accent:#E2B36B;        /* brass on dark: primary CTA fill, waveform, text caret */
  --accent-ink:#9A6B1F;    /* brass on paper, AA contrast */
}
html,body{background:var(--bg);color:var(--fg)}   /* first rule: no white flash */
```

- Hierarchy comes from opacity steps, not new colours. Use the accent on no more than three element types.
- The app keeps its **Day/Night preference** (`packages/ui/src/theme-preference.ts`: cookie, applied before first paint, no flash). Define both themes. In Night, paper surfaces become a warm dark "night paper", not pure black. Immersive screens (Studio, kit generation, interview) stay Night, as they do now. Marketing is dark-only, with paper sections where the content is reading or writing (the essay showcase).
- The four existing voice hues (`voice-hues.ts`) mark whose words are whose. Refit them to the new palette and keep them distinguishable for colour-blind users.
- Banned: purple or indigo gradients, glow orbs, blobs, radial-gradient "visuals", heavy shadows, chrome or metallic text, glossy pills, floating 3D objects, emoji as icons.
- Add a faint SVG grain over dark surfaces (opacity 0.05–0.08, `pointer-events: none`, one static image, never animated).

**Type** (load through `next/font` and replace the current three faces; `geist` is already installed):
- **Instrument Serif** italic for display accents: 1–3 words in a headline, in `--fg-60`, not brighter. Also used for the live transcript and the waveform words.
- **Geist** for headlines and UI. Headlines are weight 400–500, never bold, with tracking −0.03 to −0.045em and line-height about 0.95.
- **Geist Mono** for labels and margin notes: 11–12px uppercase, +0.18em tracking, 40–60% opacity.
- **A reading serif for long-form essay text on paper.** Instrument Serif has no text cut, so pick one with a real text optical size, keep it to one or two weights, and justify the choice in the spec.
- The hero H1 is `clamp(44px, 7vw, 112px)`, at least 5× the body size. Body text is 15–17px at 1.55.
- Break headlines by hand. Phone line breaks get their own arrays, as `_copy/hero.ts` already does.
- Subset the fonts and budget their weight in the spec. The current fonts were trimmed from 279 KB to 123 KB, so don't regress that.

**Material and components:**
- **One frosted material:** backdrop blur around 16px on a 6–8% fill with a hairline edge. Define it once and use it for the nav, chips, the floating toolbar and secondary buttons. It's frosted, not glossy: no highlights or gradients on it.
- **Buttons are pills.** The primary is solid brass on dark, or ink on paper, with an arrow in a small circle that nudges 2px on hover.
- **Radii:** pills for actions, 24px for cards, 32px for the large product frames.
- The root `app/layout.tsx` and `app/error.tsx` must not import `Button` or anything from Radix. Use `buttonStyles()` on a plain element (see the bundle notes below).

**Motion:**
- **Library:** Motion (`motion/react`) is the house library, and the springs live in `packages/ui/src/springs.ts` and `motion.ts`. GSAP is used in exactly one place, `_follow/follow-sequence.ts`. If you rebuild that section, move it to Motion and drop GSAP. Don't add new GSAP.
- **Lenis smooth scroll** is installed. Keep it only if it doesn't fight sticky sections or native scroll on phones, and justify that in the spec.
- **Entrances** run nav → eyebrow → H1 (per-word blur-rise, 90ms stagger) → sub → CTA. Each step is opacity 0→1, y 24px→0 and blur 8px→0 over 0.8s with `cubic-bezier(0.22,1,0.36,1)`. Everything is done by 1.5s.
- **Scroll reveals** fire once at a 15% threshold.
- **Hovers** stay at scale ≤ 1.03, 150–250ms.
- **Nothing in the background** pulses or floats.
- **If JS fails**, the rest state is fully visible. Start from visible and animate from a class added by JS, never from server-rendered `opacity:0`.
- **Known traps already fixed. Don't reintroduce them.**
  - React `<ViewTransition update>` caused a double blink on lazy-island reveals. Marketing `PageTransition` is keyed by pathname, enter/exit only.
  - The scroll-scrubbed "follow one sentence" sequence broke on laptops: it rested mid-transition and the text doubled. It now steps between chapters, with each change a self-contained tween. Don't bring back scroll-scrub or snap.
  - Deferred "never" islands whose HTML streams late are loaded on the client if still empty after `load` (`deferred.tsx`). Keep that guard.

**Copy voice:** confident, warm and specific. Never salesy, no hype words, no lorem. Copy lives in `_copy/*.ts`. Rewrite freely within the facts above.
- Headline candidates to improve on: "Tell it once. / Tell it well." · "Your story, admitted." · "One life story. / Every school, in its own words."
- CTAs: "Start your story" (primary, repeated in the nav) and "See how it works" (secondary).

## Screens

The routes are real. Redesign each one listed. Admin (`/admin/*`), `/prototype/*` and the email templates are out of scope; they inherit the new tokens and must still render correctly.

### Marketing (`app/(marketing)`, dark)

The current landing has 12 sections. Re-sequence and merge them into the structure below, but keep every content commitment listed. Each section is composed as a **scene**: one idea, one composed visual, generous space, and nothing else.

1. **Hero.** The signature above.
   - The headline sits anchored left in the left 55%; the waveform and essay stack sit on the right.
   - On phones, the signature recomposes below the headline at a smaller scale. It stays, it's not hidden.
   - One quiet strip runs along the bottom: three short facts about how it works, not stats.
   - The model seal can sit in the hero as a small credit.
2. **Schools strip.** The 16 school names, typeset, CSS-only.
3. **How it works.** Four steps: Tell → Position → Draft → Refine.
   - A sticky split layout: the steps list on the left; on the right, one framed product window that swaps to the matching real screen as you scroll (stepped, not scrubbed).
   - The current "follow one sentence" sequence and the real-screens stepper both fold into this.
   - The product window shows real UI built from the design system, not screenshots of the old UI.
4. **School by school.** One story, three schools, three different emphases, side by side. Use real school names from the packs and fictional-applicant content.
5. **Essays that show their thinking.** A paper scene. The essay on paper, reasoning notes in the margin, and the applicant's own words marked as theirs. The current "See which words are yours" section and the browser-only "Write your own line" toy can live here.
6. **The model.** The seal and the ledger from `model-claims.ts`, redesigned as a precise, typeset instrument panel, not a badge wall.
7. **Connect.** Real people from each school, unlocked by any pack. Keep the illustrative label.
8. **What we won't do.** Keep it: it's a trust section. Make it short and sharp.
9. **Interview practice, coming soon.** Small and honest: "Coming soon, free for kit owners when it opens." One still of the room (question, timer ring, transcript) labelled as a preview. If it can't be made honest and beautiful, drop it and tell me.
10. **Pricing.** Free → 1 school → **5 schools (hero)** → 10 schools, using the real numbers, the strikethrough and the "most chosen" badge. Say that all sales are final where terms are mentioned, without drama.
11. **FAQ.**
12. **Final CTA.**
13. **Footer.**

Also redesign `/how-it-works`, `/pricing`, `/privacy` and `/terms` (legal pages on paper, built for reading), and the OG image (`opengraph-image.tsx`), favicon and page titles.

### Entry

`/sign-in`, `/welcome` and `/first-run`. Google sign-in, magic link and passkeys all stay. These are the first signed-in impression, so make them feel like walking into a quiet room.

### App (`app/(app)`; respects Day/Night)

- **Shell.** Redesign the sidebar (256px from 1024px), the top bar and the bottom tabs below that, using the frosted material and the new type. Keep the same navigation and the command palette. The Dossier stays under Settings and the account menu.
- **Story Studio** (`/studio`, Night, immersive):
  - Full screen and dark, one prompt at a time.
  - A big record button in the same waveform language as the hero.
  - The live transcript in serif, and an easy switch to typing.
  - It should feel like talking to someone attentive, not filling in a form.
  - Keep the existing capture states, space-to-talk, the coverage meter, chapter tabs and the 30-answer free allowance gate.
- **Dossier / story map** (`/dossier`). The applicant's life as chapters on a horizontal timeline, with each chapter card showing the themes AdmitStories found. Dragging stories into school slots is **new behaviour**: put it in the spec as a proposal and don't build it without my yes.
- **Profile Read** (`/profile-read`). A beautifully typeset read with sourced, dated numbers (citation marks stay CSS-only, no Radix Tooltip).
- **Schools** (`/schools`) and the **school workspace** (`/schools/[id]` plus `preview`, `unlock`, `recommenders`, `resume`):
  - School cards you open. Inside are the tabs Essays · Application · Video · Recommenders · Résumé. Each is a document in the middle with its chat panel on the right.
  - The positioning summary, essay prompts with status, and progress shown quietly.
  - Keep the free preview showcase and the tap-to-save round/reapplicant choices.
  - **Unlock** is the money screen. Make the 5-school pack the obvious, calm choice, and keep the Dodo checkout flow untouched.
- **Essay editor** (`/workspace/[deliverableId]` and the in-school document tabs):
  - A paper surface at about 68 characters per line.
  - Reasoning notes in the right margin in mono.
  - The version scrubber restyled as a version timeline, and a word count against the limit (`limit-counter`).
  - "Your words" provenance highlighting, the revision review/diff, and the floating frosted toolbar.
  - Keep every existing editor function and shortcut.
- **Home / dashboard** (`/home`). Schools, deadlines and next actions, calm and scannable.
- **Recommenders** (`/recommenders`, `/recommenders/[id]`) and the **recommender portal** (`/r/[token]`). The portal is seen by people who aren't my customers. It's paper, readable, and has to work on a phone in one sitting.
- **Résumé** (`/resume`, `/resume/review`), **Connect** (`/connect`), **Settings** (`/settings`, `privacy`, `security`).
- **Interview** (`/interview`). It stays a "coming soon" page, but redesign it as a beautiful still of the room (question, timer ring, transcript) with the honest promise. Don't build the live room.
- Empty, loading and error states for every screen above. These count in the Polish score.

## Hard requirements

**Accessibility.**
- WCAG AA contrast, checked by `contrast.test.ts` and axe.
- Visible focus states and full keyboard access.
- Tap targets ≥ 44px.
- `prefers-reduced-motion` respected everywhere.

**Mobile is designed, not just stacked.**
- Rescale the type and recompose the media.
- The signature is still present on phones.
- No horizontal scroll at 375px.
- Use 100dvh and safe-area insets.
- The Tailwind theme has **no `md:` breakpoint**, only `sm`, `lg` and `xl`. Design to those or add one deliberately in the spec.

**Performance.** Speed is part of the look.
- LCP under 2.5s on a mid-range phone.
- Fonts preloaded with `display: swap` and metric-matched fallbacks: no layout shift from fonts or from the looping hero text.
- **First-load JS budgets** (`apps/web/scripts/bundle-budget.ts`): **155 KB gz** on marketing routes and **160 KB gz** on app routes. The app shell alone is about 152 KB, so:
  - large client screens load behind `next/dynamic` "host" modules (the server still renders them);
  - a `"use client"` module ships all of its exports, so split files rather than importing one helper from a big module;
  - importing a helper *from* a module you're dynamic-loading pulls it back into first load;
  - Radix Tooltip/popper costs about 30 KB, so draw hover labels in CSS;
  - a top-level `z.enum()` drags Zod (about 31 KB) into the browser, so validators stay in `@admitstory/shared/schemas`;
  - anything in the root layout or root boundaries must avoid `Button` and Radix.
- To see what fills a chunk, build once with `productionBrowserSourceMaps: true` and read the maps.

**Dependencies.**
- Don't add new dependencies without saying why. Prefer what's installed (Motion, `geist`, `@phosphor-icons/react` for icons, Tailwind 4).
- Prettier must not touch `packages/ai/src/prompts/**/*.md`. It's already ignored, so keep it that way.

**Cleanliness.** Zero console errors, no failed requests, no hydration warnings, and no placeholder copy.

## Review rubric (score each screen 1–10)

1. **First glance.** One focal point; it reads as studio-made in three seconds.
2. **Signature.** There's one screenshot-worthy moment.
3. **Typography.** Confident display type, calm body, consistent scale.
4. **Composition and space.** Generous and aligned, with a clear path from message to action.
5. **Colour and light.** Small palette, intentional accent, protected text.
6. **Media integration.** Visuals feel composed into the layout, not dropped in.
7. **Motion.** Choreographed, physical and restrained; reduced motion works.
8. **Mobile.** Recomposed, not just stacked.
9. **Copy.** Specific, believable, with a point of view, and true to the product facts above.
10. **Polish.** States, radii, favicon/title; no stray scrollbars or shifts.

The bar is an average of 8+ with nothing under 7. Be a harsh judge: score as an Awwwards jury would, not as the author.

## Phases

This work runs across many sessions, and any session can end without warning when usage runs out. So it's split into nine phases, each sized to fit one session. I start every session with a short message naming the phase. Do only the phase I name; never start the next one on your own.

| Phase | What it covers | Ends with |
|---|---|---|
| **0. Read, capture, spec** | Read the repo and this prompt. Create the branch. Write `docs/design/redesign/shoot.mjs` (Playwright, channel "chrome": every route in this prompt at 1440×900 and 390×844, plus a 375px overflow check, signed-in routes through the local DB) and `docs/design/redesign/local-db.md` (the exact commands to start the local Postgres, migrate, seed, start the app and sign in). Capture **before** screenshots of every screen. Write SPEC.md: the system and the hero to full values, every other screen as a composition sketch, the signature-moment table, the font and JS budget. Create PROGRESS.md. | **Stop for my review** of the spec summary. |
| **1. Design system** | Fonts, tokens for dark, paper and Night paper, the type scale, grain, the frosted material, buttons, inputs, cards, chips, tabs, focus rings and motion utilities, all in `packages/ui`. The wordmark and favicon. Migrate the `render.css` utilities so every existing screen still renders. Update the contrast and motion tests. A hidden `/prototype/system` page that shows every token and component on dark, paper and Night paper. | Screenshot of `/prototype/system`; all gates green. |
| **2. Landing hero** | The marketing nav, the hero signature, the reduced-motion still frame, the phone composition, the bottom facts strip. Per-frame cost measured, LCP measured. | **Stop for my review** of hero screenshots and scores. |
| **3. Landing, all scenes** | Landing sections 2–13 (schools strip through footer), the GSAP follow sequence moved to Motion, Lenis kept or removed. | Full-page screenshots, scores per section, bundle:check under 155 KB. |
| **4. Other marketing + entry** | `/how-it-works`, `/pricing`, `/privacy`, `/terms`, OG image, page titles, `/sign-in`, `/welcome`, `/first-run`. | Screenshots and scores. |
| **5. Shell, home, Studio** | App shell (sidebar, top bar, bottom tabs, command palette, account menu, toasts), `/home`, `/studio` with every capture state and the allowance gate. | Screenshots in Day and Night, scores. |
| **6. Schools and the editor** | `/schools`, `/schools/[id]` with all tabs and chat panels, `preview`, `unlock` (checkout untouched), `/workspace/[deliverableId]`, `/kits/[id]`. | Screenshots and scores; a test-mode unlock still opens the Dodo overlay. |
| **7. The rest of the app** | `/dossier` (plus the drag proposal, unbuilt), `/profile-read`, `/recommenders`, `/recommenders/[id]`, `/r/[token]`, `/resume`, `/resume/review`, `/connect`, `/settings` and its subpages, `/interview` (coming soon), `/tracker`, and every empty, loading, error and not-found state. | Screenshots and scores. |
| **8. Final pass** | Whole-site consistency sweep against the spec, axe on every route, Lighthouse on `/` and `/home` at mobile settings, 375px overflow on every route, console and network clean, reduced motion on every route, admin still renders. Finish REPORT.md. | REPORT.md complete; a summary for me. |

If a phase can't finish in one session, the next session continues it. If a phase finishes early, stop anyway and tell me; don't start the next one.

## Session protocol

`docs/design/redesign/PROGRESS.md` is the memory between sessions. Treat it as the most important file in this job. It holds:
- the phase table with a status per phase (not started, in progress, awaiting review, done);
- for the current phase, a checklist of every screen and step, each ticked when done;
- a **Next step** line saying exactly what to do first when a session resumes;
- decisions made and why, and anything I approved, changed or rejected (with the date);
- the latest scores per screen;
- open problems and things you need from me.

**At the start of every session:**
1. Read this prompt, then PROGRESS.md, then the parts of SPEC.md for the current phase.
2. Run `git status` and `git log --oneline -15` on `redesign/literary-instrument`. If there are uncommitted changes, a previous session was cut off: inspect them, keep what's sound, and note it in PROGRESS.md.
3. If my message contains feedback or approval, write it into PROGRESS.md before doing anything else.
4. Start the local environment from `local-db.md` if the phase needs signed-in screens.
5. Continue from the **Next step** line.

**While working**, assume the session could end at any moment:
- After each screen or step is done and its gates pass, tick it in PROGRESS.md, update **Next step**, and commit on the branch with a message like `redesign(p3): pricing scene`.
- Never leave more than about an hour of work uncommitted.
- Don't spend usage re-reading the whole repo every session; PROGRESS.md and SPEC.md exist so you don't have to.

**At the end of a phase:** set the phase to "awaiting review" (Phases 0 and 2) or "done" (the others), write the phase summary into REPORT.md, commit, and give me a short summary: what changed, the scores, screenshots to look at, and anything you need from me. Then stop.
