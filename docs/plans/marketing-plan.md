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

# Implementation plan: the marketing site (Phase 9a)

Written 2 November 2026 for the `marketing-site` branch in the worktree
`/Users/manu/Desktop/AdmitStory-marketing`. It turns `docs/design/marketing-direction.md` (the
brief, called **the direction** below) into work that can be built. The spec references are
§6 (design system), §6.7, §6.11, §6.13, §13, §14.5 and §14.7, and §16 Phase 9.

The direction decides what the site looks like, says and does. This plan decides where each piece
lives, what it costs in JavaScript, how the pieces fit together, and who builds what. Where the
two disagree, the **Deviations** section explains why. Everything else in the direction applies as
written, and each package brief points back to its sections.

Order of work:

1. **FOUNDATION** (one agent, run first and alone): dependencies, shared files, the marketing
   layout and chrome, primitives, data, SEO plumbing, the budget and Lighthouse scripts, and a
   **stub for every file a build package owns**, so the tree builds green before any package starts.
2. **BUILD packages A to E**, run in parallel. Their owned paths don't overlap. A package only
   edits files it owns. It reads Foundation files but doesn't edit them.
3. **INTEGRATE** (one agent, run last): gates, the bundle check, Lighthouse, the phase doc and the
   patch.

---

## 0. What the code tells us (findings that shape this plan)

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                     | Consequence                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | The current `/` (a redirect with no client code) measures **140.5 KB gz** of first-load JS in the 1 Nov build. That's React DOM plus the Next runtime (about 133 KB: chunks of 70.3, 34.8, 8.5, 8.2, 4.3, 3.6 and 3.2 KB), the root `error.tsx` (3.6 KB) and `ToastProvider` (4.0 KB), all from the root layout.                                                            | The direction's **120 KB marketing budget can't be met**. The budget becomes **155 KB gz** for marketing routes, with a target of ≤ 152 KB on `/` (see Deviation D1). Every extra KB on `/` must be justified.                                                                                                |
| F2  | **A `"use client"` module ships all of its exports**, and much of `packages/ui` is client code built on `motion/react`: `RecordButton`, `LiveTranscript`, `TimedText`, `SpokenQuestion`, `StoryCard`, `YourWordsText`, `StreamingText`, `KitAssembly` and `DuetStage`. Rendering any of them from a server component puts Motion (about 30 KB or more) into the first load. | The hero's first-load island must not import any of these. The other sections render real components through a **deferred-hydration island** (Foundation `_ui/deferred.tsx`, §3.4): the server renders the real component's HTML, and its JavaScript loads only when needed, or never if the frame is static. |
| F3  | `Sheet`, `Dialog`, `Tooltip` and `Button` import Radix (`Button` uses `Slot`). `ThemeToggle` imports Phosphor icons. `setThemePreference` is re-exported from `theme-toggle.tsx`, so importing it pulls in the toggle.                                                                                                                                                      | The marketing chrome uses native `<dialog>` for the phone menu, `buttonStyles()` (server-safe) on `<a>` and `<button>` elements, and imports the theme store from its own module (Foundation re-points the `@admitstory/ui` export).                                                                          |
| F4  | `Voiceprint` lazy-loads the OGL renderer **immediately after mount** (tiers 2–3), and `tier.ts` lazy-loads `detect-gpu` on first use.                                                                                                                                                                                                                                       | The hero mounts `<Voiceprint>` only when the renderer gate opens (direction §10). Until then it shows the server-rendered `VoiceprintStill` poster.                                                                                                                                                           |
| F5  | `@admitstory/voice/client` already has everything the speak demo needs: `startPcmCapture`, `createDictationSession({ fetchToken })` and `fetchSttToken({ endpoint, body })`. `readSttTokenBody` requires `remainingSeconds`. Refusal codes are fixed (`email_unverified`, `voice_minutes_used`, `stt_unavailable`).                                                         | The demo route returns the standard `SttTokenResponse` with `remainingSeconds: 15`. Refusals return `refusal: "stt_unavailable"` plus a `reason` field that the hero reads with its own small fetch wrapper.                                                                                                  |
| F6  | Without `DEEPGRAM_API_KEY`, `selectSttProvider()` returns the **fake** provider. It points at the local fake Deepgram server (`pnpm --filter @admitstory/voice fake-stt`, `ws://localhost:8787`), which turns real microphone audio into honest placeholder words. `fakeProvidersAllowed()` is true only in development or on a local `APP_URL`.                            | The hero works end to end in development with the fake server running. If that server isn't running, the socket fails and the hero falls back to "Speaking is paused… write your line instead, or play the sample". The direction's `DEMO_FAKE_STT` flag isn't needed (Deviation D5).                         |
| F7  | A Deepgram grant's TTL only covers the **handshake**: the socket stays open after the token expires (`stt/deepgram.ts`). `STT_TOKEN_TTL_SECONDS` is 60. `listenQuery` doesn't set `mip_opt_out`.                                                                                                                                                                            | The 15-second cap is enforced by the client and by a 20-second server-side kill (Deviation D6). The demo route appends `mip_opt_out=true` to the URL it mints.                                                                                                                                                |
| F8  | Rate limits are **in-process** (`lib/api.ts`; Upstash isn't configured). Kill switches (§9b) don't exist yet.                                                                                                                                                                                                                                                               | The demo route uses an in-process limiter (3 per IP per hour, plus a daily global cap), with `DEMO_STT=off` as an env kill switch, behind a small interface that Phase 9b swaps for Upstash and PostHog flags.                                                                                                |
| F9  | `'use cache'` / `cacheLife` need `cacheComponents: true`, which would change rendering for the **whole app**. No route uses it.                                                                                                                                                                                                                                             | Marketing's two queries use a 1-hour in-process memo (`lib/marketing/public-data.ts`) and fail soft (an error means "nothing verified"). `cacheComponents` stays off (Deviation D4).                                                                                                                          |
| F10 | `KitPreview` pieces live in `packages/ui/src/strategy/kit-preview.tsx` (`PositioningBlock`, `FileMapList`, `LockedDeliverables`) and are server-safe. The direction says `packages/ui/src/kit/`.                                                                                                                                                                            | `/pricing` imports them from `@admitstory/ui`.                                                                                                                                                                                                                                                                |
| F11 | Public school data: `listSeedSchools(db)` returns `publishedPack`. The only AI-policy reads are admin-scoped (`listAiPolicies`) or per cycle (`getVerifiedAiPolicy`).                                                                                                                                                                                                       | Foundation adds `listVerifiedAiPolicies(db)` to `packages/db/src/repos/schools.ts`: verified rows only, joined to school name, cycle and source URL.                                                                                                                                                          |
| F12 | The **magic link** opens in a new tab, and `sessionStorage` is per tab.                                                                                                                                                                                                                                                                                                     | The "keep this line" hand-off uses `localStorage` with a 24-hour expiry, cleared once it's used or declined (Deviation D2).                                                                                                                                                                                   |
| F13 | The interview report (Phase 7) and recommender briefs (Phase 6) aren't built yet.                                                                                                                                                                                                                                                                                           | The "Real screens" exhibit 5 shows the live-mock duet (from the Phase 0.5 prototype) instead of the report until Phase 7 ships (Deviation D7). Copy that describes those features stays, because the site launches after Phases 6–8.                                                                          |
| F14 | `apps/web/e2e/redirects.spec.ts` expects `/` to redirect.                                                                                                                                                                                                                                                                                                                   | Foundation removes `"/"` from that list. That's an edit to an existing e2e file; no new e2e file is added.                                                                                                                                                                                                    |
| F15 | No `middleware.ts` or `proxy.ts` exists. The CSP is only `frame-ancestors 'none'`, so Turnstile and `wss://api.deepgram.com` aren't blocked.                                                                                                                                                                                                                                | No proxy and no CSP change in 9a. The per-route CSP for `/` (Turnstile, Deepgram) is listed for Phase 9b.                                                                                                                                                                                                     |

---

## 1. Dependencies

Checked on npm on 2 November 2026:

| Package                                                                  | Version (exact)                                       | Licence                                                                                                                                                                                                                                                                                                                       | Size (min + gzip -9)                                    | Decision                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsap`                                                                   | **3.15.0** (latest; published 13 Apr 2026)            | GSAP "Standard 'no charge' license" (gsap.com/standard-license, re-read 2 Nov 2026). Free for commercial use, all plugins included (ScrollTrigger, SplitText). The one restriction is on tools that let users build no-code visual animations competing with Webflow. AdmitStory isn't one. Record this in `docs/decisions/`. | core 27.7 KB, ScrollTrigger 17.6 KB, SplitText 3.6 KB   | **Add** to `apps/web` dependencies. Import `gsap`, `gsap/ScrollTrigger` and `gsap/SplitText` only inside `_follow/follow-sequence.ts`.                                                        |
| `lenis`                                                                  | **1.3.27** (latest; 15 Oct 2026). Skip `2.0.0-dev.*`. | MIT                                                                                                                                                                                                                                                                                                                           | about 5 KB gz minified (8 KB for the unminified `.mjs`) | **Add** to `apps/web`. Import `lenis` (the core, not `lenis/react`) only inside `_motion/smooth-scroll.ts`. Its peer dependencies (react, vue, @nuxt/kit) are all optional.                   |
| `@gsap/react`                                                            | 2.1.2 (verified; peer `gsap ^3.12.5`)                 | GSAP standard licence                                                                                                                                                                                                                                                                                                         | about 1 KB                                              | **Not added.** The pinned sequence drives existing server-rendered DOM from a plain module (`gsap.matchMedia()` and `ctx.revert()` in an effect's cleanup), so no React tree needs `useGSAP`. |
| `motion`, `ogl`, `detect-gpu`, `@marsidev/react-turnstile`, `posthog-js` | installed                                             | —                                                                                                                                                                                                                                                                                                                             | —                                                       | Reused. The hero loads Turnstile's `api.js` itself rather than through `@marsidev/react-turnstile`, to keep that wrapper out of the hero chunk.                                               |

Install with `pnpm --filter @admitstory/web add gsap@3.15.0 lenis@1.3.27 --save-exact` (Foundation
only). The combined follow chunk (GSAP core, ScrollTrigger, SplitText, Lenis and our code) is
about 55 KB gz, inside the direction's ≤ 60 KB.

---

## 2. Routes, layouts and file map

```
apps/web/app/
  sitemap.ts                         F   the five marketing URLs only
  robots.ts                          F   allow /, disallow app paths, link sitemap
  (marketing)/
    layout.tsx                       F   metadata, viewport, marketing theme wrapper, nav, footer,
                                         Organization JSON-LD, view-transition styles, smooth-scroll host
    page.tsx                         F   "/" composes the sections in order (replaces the redirect)
    opengraph-image.tsx              E   1200x630 next/og, inherited by all five pages
    _chrome/                         F   site-nav, nav-compact (client), menu-dialog (client),
                                         site-footer, theme-switch (client)
    _ui/                             F   section primitives, deferred island, json-ld, ai-policy-table,
                                         cta links, scaled frame, fictional note, margin note
    _motion/                         F   smooth-scroll.ts (Lenis, lazy), smooth-scroll-host.tsx,
                                         media.ts (desktop gate), springs for GSAP re-exported
    _lib/                            F   gates.ts (pure), track.ts (analytics), seo.ts (metadata builders)
    _data/                           F   sample.ts (fictional applicant), pricing.ts, screens.ts (capture manifest)
    _copy/
      shared.ts, chrome.ts           F
      honest-claims.test.ts          F   scans every _copy/*.ts
      hero.ts                        A
      follow.ts                      B
      landing.ts, faq.ts             C
      pricing-page.ts, how-it-works.ts  D
      privacy.ts, terms.ts, keep-line.ts  E
    _hero/                           A   hero.tsx, hero-stage.tsx, hero-voiceprint.tsx, hero-result.tsx,
                                         hero-demo.ts, hero-sample.ts, hero-state.ts, line-cleanup.ts, tests
    _follow/                         B   follow-section.tsx, frames/*, follow-host.tsx,
                                         follow-sequence.ts, follow-geometry.ts, tests
    _sections/                       C   how-it-works-lines, real-screens, your-words (+ island),
                                         wont-do, pricing, faq, final-call, tests
    pricing/                         D   page.tsx, _unlock-toggle (island), _ledger, _data.ts, tests
    how-it-works/                    D   page.tsx, _assembly (island), _steps, _data.ts, tests
    _legal/                          E   legal-layout.tsx, contents.tsx, voice-path-diagram.tsx
    privacy/page.tsx                 E
    terms/page.tsx                   E
  api/demo/stt-token/route.ts (+ test)  A
  prototype/marketing-screens/**     C   dev-only capture compositions (prototype gate applies)
  sign-in/**                         E   the "Keep your first line" mode
  first-run/**                       E   the "Start Story Studio with the line…" checkbox
apps/web/lib/
  marketing/                         F   first-line.ts, routes.ts, public-data.ts, site-url.ts (+ tests)
  studio/turn.ts, studio/homepage-line.ts  E   the first-turn opener
  env.ts                             F   SITE_URL, DEMO_STT, DEMO_DAILY_CAP
apps/web/public/marketing/
  sample-line.json (+ .webm/.m4a when keyed)  A
  screens/*.avif                     C
apps/web/scripts/
  bundle-size.ts, bundle-budget.ts (+ test), lighthouse.ts   F
  marketing-sample.ts                A
  capture-marketing-screens.ts       C
packages/ui/src/
  motion-curves.ts (+ test), motion.ts, index.ts   F
packages/db/src/repos/schools.ts     F   listVerifiedAiPolicies
apps/web/e2e/redirects.spec.ts       F   drop "/" from the redirect list
```

Underscore folders are private in the App Router, so none of them become routes.

### 2.1 The marketing layout (`(marketing)/layout.tsx`, Foundation)

- **No app shell.** It must not import `AppShell`, the dock, Radix, `ThemeToggle` or anything under
  `packages/ui/src/shell` except `ViewTransitionStyles`, `SharedElement` and `RouteTransition`
  (these are small and Radix-free).
- **Theme.** It reads the theme cookie and renders
  `<div data-marketing-theme data-theme={immersiveTheme(pref)} class="bg-space text-text min-h-dvh">`.
  This gives Night by default, and Day only when the visitor chose Day (direction §2). The hero and
  `#follow` add their own `data-theme="night"` and `grain`. Essay sheets add `data-theme="day"`.
  `generateViewport()` returns `themeColors(pref, { immersive: true })`.
- **Metadata.** `robots: { index: true, follow: true }` overrides the root's noindex.
  `metadataBase: siteUrl()`. Each page sets `alternates.canonical`. The `/` title is absolute:
  "AdmitStory: your MBA application, in your own words". The other pages use the root template
  (`%s | AdmitStory`).
- **Structure.** `SkipLink` (server-safe), `<SiteNav/>`, `<main id="main">` holding the page in a
  `<ViewTransition>` (the `route` class, cross-fade on glide), `<SiteFooter/>`, then
  `<OrganizationJsonLd/>`, `<ViewTransitionStyles/>` plus the marketing VT rule
  (`site-header` with no animation), and `<SmoothScrollHost/>`.
- **Analytics.** No `PostHogIdentity`. Marketing events go through `_lib/track.ts` (§3.6).

### 2.2 Signed-in visitors

`/` no longer reads the session (cacheable shell; direction §9). "Sign in" goes to `/sign-in`,
which already redirects signed-in people to `/home`.

---

## 3. Foundation building blocks (details the packages rely on)

### 3.1 `packages/ui/src/motion-curves.ts`

- Moves `simulate()` out of `motion.ts` and exports it as `springSamples(token)`, with the same
  2 kHz semi-implicit Euler. `motion.ts` imports it (so `cssSpring` is unchanged and
  `motion.test.ts` stays green).
- `springEase(token): (t: number) => number` linearly interpolates the samples over a 0..1
  progress. It overshoots like the spring, and returns exactly 0 at t ≤ 0 and 1 at t ≥ 1.
- `SETTLE_SECONDS: Record<MotionToken, number>`: 0.35, 0.48, 0.68 and 1.12, derived from
  `cssSpring(token).durationMs` and asserted equal to the `tokens.css` durations.
- It must **not** import `motion/react`. It imports `SPRINGS` from a new
  `packages/ui/src/springs.ts`, which `motion.ts` re-exports, so `motion.ts` keeps its public API.
- Exported from `index.ts`. GSAP code imports it through `@admitstory/ui` (optimizePackageImports
  resolves it to the module).

### 3.2 `apps/web/lib/marketing/first-line.ts` (the hand-off contract between A and E)

```ts
export const FIRST_LINE_KEY = "admitstory.first-line.v1";
export const FIRST_LINE_TRANSITION = "first-line"; // <SharedElement name> on both pages
export const FIRST_LINE_MAX_CHARS = 200;
export const FIRST_LINE_TTL_MS = 24 * 60 * 60 * 1000;
export interface FirstLine {
  line: string;
  source: "voice" | "sample" | "written";
  identity: VoiceprintIdentity | null;
  removedFillers: number;
  savedAt: number;
}
export function saveFirstLine(value: Omit<FirstLine, "savedAt">, storage?, now?): boolean;
export function readFirstLine(storage?, now?): FirstLine | null; // validates, expires
export function clearFirstLine(storage?): void;
export function parseFirstLine(raw: string | null, now: number): FirstLine | null; // pure
```

Every storage access is wrapped in try/catch, and a blocked storage returns null or false.
Validation: `line` is trimmed, 1–200 characters, with no control characters. `identity` passes the
same checks as `prototype/_shared/identity.ts#parseStoredIdentity` (copy that logic; don't import
from the prototype). `source: "sample"` is never offered to keep (the sample isn't the visitor's
line), so `saveFirstLine` refuses it.

### 3.3 Section primitives (`(marketing)/_ui/`, server-safe unless marked)

- `Section`: a `<section>` with the 12-column grid (`grid-cols-4 sm:grid-cols-8 lg:grid-cols-12`),
  16 px phone gutters, a max width of 1440 and vertical rhythm. Props: `theme?: "night" | "page"`,
  `grain?`, `labelledBy`.
- `DisplayHeading`: `level`, `size: "sm" | "md" | "lg" | "xl"` mapped to `text-display-*`, author
  line breaks via `lines: string[]`, and `phoneBreaks` for phone-only `<br class="sm:hidden">`.
  It renders one text node per line plus `<br>`, so a screen reader hears one sentence.
- `MarginNote` (13 px, `tabular-nums`, `text-text-soft`), `FictionalNote` (the fixed sentence from
  `_copy/shared.ts`) and `Hairline` lists (`HairlineList` with `HairlineRow`).
- `CtaLink`: `next/link` styled with `buttonStyles({ variant })`, with variants primary, ghost
  (secondary) and text. Each has a `track` prop that adds a `data-track` attribute (read by one
  delegated listener in the layout: no client code per link).
- `PlaneFrame`: a plane with `--depth`, a 16 px radius, a 1px `--edge` and `--plane-light`.
- `ScaledFrame`: a fixed design width (720 by default) scaled into a fixed `aspect-ratio` box with
  a CSS container query, `transform: scale(calc(100cqw / 720px))`, done in CSS only with no JS
  measuring.
- `JsonLd`: `<script type="application/ld+json">` with `JSON.stringify(...).replace(/</g, "\\u003c")`.
- `AiPolicyTable`: a server component. Props: `rows` (from `public-data.ts`), `limit?`,
  `variant: "compact" | "full"`. It returns **null** when `rows` is empty. Full adds "What
  AdmitStory does" (Draft mode, Coach mode or Disclosure helper, mapped from the stance as in
  `packages/ui` `AUTHORSHIP_ORDER` and `modeExplanation`) and the school's own link.
- `Deferred` (client, `_ui/deferred.tsx`): see 3.4.

### 3.4 Deferred hydration: real components without their JavaScript in first load

```tsx
"use client";
export function deferred<P>(
  load: () => Promise<{ default: ComponentType<P> }>,
  when: "never" | "visible" | "idle" | "interaction",
): ComponentType<P & { margin?: string }>;
```

How it works: the returned component renders `<div data-island ref>` around
`<Suspense fallback={null}><Lazy {...props}/></Suspense>`. On the server, `Lazy` resolves
straight away, so the real component's HTML is in the response. On the client, `Lazy` waits on a
gate promise (an IntersectionObserver within `margin`, default one viewport; `requestIdleCallback`;
first pointer or key; or never). React keeps the server HTML in place while a boundary suspends
during hydration, and hydrates it when the code arrives. Each package writes its own island file:

```tsx
"use client";
import { deferred } from "../_ui/deferred";
export const StoryFrameIsland = deferred(() => import("./frames/story-frame"), "never");
```

The lazy target is an **app-local** `"use client"` module that statically imports from
`@admitstory/ui`. Never `import("@admitstory/ui")` dynamically, because a dynamic import of the
barrel isn't tree-shaken.

**Foundation must prove this before handing off.** In a production build:

1. The island's chunk isn't in `/`'s `firstLoadChunkPaths`.
2. `curl` of `/` contains the component's markup. Note whether it sits in place or arrives as a
   streamed `<template>` swap; either is acceptable, but record which.
3. No hydration warnings in the console.
4. A `"never"` island never requests its chunk (check the Network panel, or count requests with
   Playwright in a scratch script that isn't committed).

If any of these fails, the fallback is a `next/dynamic` host (`ssr: true`) mounted only after
visibility. Its static HTML twin is rendered by the server in the meantime, and Foundation writes
down the pattern for the packages. Record the outcome in this file under "Foundation notes".

### 3.5 Gates (`_lib/gates.ts`, pure; `_motion/media.ts`, the browser bindings)

- `DESKTOP_MOTION_QUERY = "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)"`
- `desktopMotionAllowed({ matches, saveData })`: false under Save-Data too.
- `rendererGate({ phone, loaded, idle, interacted, heroInView, tier })` returns
  `"wait" | "load" | "never"`. Desktop: `loaded && idle && heroInView && tier !== 1`. Phone:
  `interacted && tier !== 1` (direction §10).
- `followGate({ desktop, nearFollow, idleAfterRenderer })` returns `"wait" | "load" | "never"`
  (never on phones or under reduced motion).
- `smoothScrollGate({ desktop, wheel })`: Lenis starts on the first `wheel` event only.

### 3.6 Analytics (`_lib/track.ts`)

`MARKETING_EVENTS` = `hero_speak_start`, `hero_line_placed` (`source`), `hero_keep_line`,
`sample_played`, `cta_start_free` (`location`), `faq_open` (`id`), `pricing_unlock_toggle` (`on`).
`track(event, props)` is typed so that props are only enums, ids or booleans, never free text. It
does nothing without `POSTHOG_KEY`. Otherwise it `import()`s posthog-js on `requestIdleCallback`
after `load` and inits with `persistence: "memory"` and `disable_session_recording: true`, then
queues events until it's ready. One delegated `click` listener in the layout reads `data-track`.

### 3.7 Data (`_data/`, `lib/marketing/public-data.ts`)

- `_data/sample.ts`: `SAMPLE_LINE` (L041, verbatim), `SAMPLE_IDENTITY` (a fixed
  `VoiceprintIdentity`, `source: "voice"`), `SAMPLE_STORY: StoryCardData` ("The night-shift fix ·
  Work, 2024", traits, three confirmed facts), `SAMPLE_PARAGRAPHS` and `SAMPLE_SOURCES` (copied
  from `prototype/workspace/essay.ts`, with a test asserting the L041 text matches the prototype),
  `SAMPLE_QUESTION_STUDIO`, `SAMPLE_QUESTION_INTERVIEW`, `SAMPLE_NEED`, `SAMPLE_PROVENANCE`
  ("You said this in Story Studio, 14 Oct, 9:41 pm") and `SAMPLE_SCHOOL = "Northfield"`.
- `_data/pricing.ts`: `KIT_PRICE_USD = 100` and display `"$100"` (reuses `KIT_PRICE` from
  `@admitstory/ui`), `EXPERT_MOCK`, `FREE_FEATURES[]`, `KIT_FEATURES[]`, `REFUND_RULE` (verbatim)
  and `TAX_LINE`. Used by C (landing §4.8), D (`/pricing`) and E (`/terms` §7) so the three can't drift.
- `_data/screens.ts`: the capture manifest `{ id, file, width: 1760, height: 1120, alt, name, caption }`
  for dossier, profile-read, strategy, workspace and live-mock, plus `screenAvailable(id)`, a
  server-only `existsSync` in `public/`, so a missing capture is left out rather than shown broken.
- `public-data.ts` (server-only): `packSchools()` returns `{ name, shortName }[]` from
  `listSeedSchools`, keeping only those with `publishedPack`. `verifiedPolicies()` returns rows
  from `listVerifiedAiPolicies`. Both have a 1-hour in-process memo, a 2 s timeout, and `[]` on
  any error, logging only the error name.

### 3.8 SEO plumbing

- `lib/marketing/site-url.ts`: `siteUrl()` is `SITE_URL` (new optional env var: Manu's domain),
  else `APP_URL`.
- `lib/marketing/routes.ts`: `MARKETING_ROUTES = ["/", "/pricing", "/how-it-works", "/privacy", "/terms"]`.
  The sitemap, robots, the bundle budget and Lighthouse all read it.
- `app/sitemap.ts`: those five, absolute, with `lastModified` set to the build date (privacy and
  terms use their "last updated" constants once E adds them; until then the build date).
- `app/robots.ts`: `allow: "/"`, `disallow: ["/api/", "/admin", "/prototype", "/r/", "/home",
"/studio", "/workspace", "/kits", "/schools", "/settings", "/welcome", "/first-run"]`, plus the
  sitemap URL. App pages also keep their `noindex`.
- `_lib/seo.ts`: `pageMetadata({ title, description, path })` builds title, description,
  canonical, `openGraph` (type website, siteName, url) and `twitter: { card: "summary_large_image" }`.
  The OG image comes from E's `opengraph-image.tsx` by file convention.
- JSON-LD: `Organization` (F, layout), `FAQPage` (C, `/`), `Product` with two `Offer`s (D, `/pricing`).

### 3.9 Budget and Lighthouse scripts

- `scripts/bundle-budget.ts` (pure, tested): `budgetFor(route)` returns 155 for
  `MARKETING_ROUTES` and 160 for everything else. `bundle-size.ts` uses it and prints the budget
  per row.
- `scripts/lighthouse.ts`: a `--marketing` flag that runs only the five marketing pages, with no
  database or session (signed out). Categories are performance, accessibility, best-practices and
  **seo**. Thresholds: performance ≥ 0.90, and accessibility, best practices and SEO = 1.00 (the
  direction's bar). Port from `APP_URL` (3100 in this worktree). The default mode is unchanged.

---

## 4. The speak-in-hero route (`POST /api/demo/stt-token`, package A)

```
POST /api/demo/stt-token
body: { turnstileToken?: string }            (Zod, ≤ 4 KB)
200:  SttTokenResponse & { remainingSeconds: 15 }     Cache-Control: no-store
4xx/5xx: { error, refusal: "stt_unavailable", reason }  reason ∈
         "paused" (kill switch or no provider), "turnstile", "rate_limited", "unavailable"
```

In order:

1. **Kill switch.** `DEMO_STT === "off"`, or the daily global cap is reached, gives 503
   `paused`.
2. **Turnstile.** If `TURNSTILE_SECRET_KEY` is set, verify with `siteverify` (secret, response,
   `remoteip`). On non-local hosts, also check `hostname === new URL(APP_URL).hostname` and
   `action === "hero_demo"`, the same rule as `lib/auth.ts`. A failure gives 403 `turnstile`. With
   no keys, a local `APP_URL` skips the check and any other host gives 503 `paused`.
3. **Rate limit.** In-process: 3 per IP per hour. The IP is the first `x-forwarded-for` hop, else
   `x-real-ip`, else `"unknown"`, hashed (SHA-256 truncated) before it's used as a key. Over the
   limit gives 429 `rate_limited`. A `DemoLimiter` interface allows an Upstash version in 9b.
4. **Provider.** `voiceProviders().stt`. If it's `fake` and `!fakeProvidersAllowed()`, the
   response is 503 `paused`. Otherwise call
   `mint({ userId: "demo", language: "en", keyterms: [], utteranceEndMs: DEFAULT_UTTERANCE_END_MS })`
   and append `mip_opt_out=true` to the URL. A mint failure gives 503 `unavailable`.
5. **Logging.** One `console.info("[demo-stt]", { outcome })` per call: counts only, never text,
   IP or token.

Client side (A's `hero-demo.ts`, loaded inside the Speak handler):

- Get Turnstile: inject `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`
  once, then `turnstile.render(el, { sitekey, action: "hero_demo", appearance: "interaction-only",
size: "flexible" })` inside the explainer plane (its height is reserved). With no site key
  (`process.env.TURNSTILE_SITE_KEY` is inlined empty), skip it.
- `fetchDemoToken()` POSTs, reads `reason`, and maps it to the error table in direction §4.2.
- `createDictationSession({ fetchToken, retryDelaysMs: [], utteranceEndMs })`, with
  `startPcmCapture` sharing one `AudioContext` with an `AnalyserNode` that feeds a
  `VoiceSignalRef`, plus `createIdentityAccumulator()`. Stop at 15 s, on "Done", or after 2.5 s of
  silence following a sentence end (`endsSentence`). A connection that fails (the fake server
  isn't running, or the network) shows the "Speaking is paused" state. A 20 s watchdog disposes
  everything regardless.
- In development: run `pnpm --filter @admitstory/voice fake-stt` next to `pnpm dev`. With it, the
  hero shows the fake's placeholder words, and they go through cleanup and placement like real
  ones. Without it, the paused state appears. Both are expected and documented.

---

## 5. "Keep this line": the hand-off into sign-in and Studio (package E, with A)

1. **Landing (A).** After the line lands, "Sign up and keep this line" calls
   `saveFirstLine({ line, source, identity, removedFillers })`, then
   `track("hero_keep_line")`, then `router.push("/sign-in?from=line")` inside `startTransition`.
   The lit line is wrapped in `<SharedElement name={FIRST_LINE_TRANSITION}>`.
2. **Sign-in (E).** `from=line` is added to the page's `SearchParams` schema (`z.literal("line")`).
   In line mode the server renders the heading "Keep your first line", plus a reserved slot
   (Newsreader 19/32, two lines tall) holding a small client component, `KeptLine`. It reads
   `readFirstLine()` through `useSyncExternalStore` (server snapshot null, so a client navigation
   has the line at commit and the View Transition pairs). The line sits in
   `<SharedElement name={FIRST_LINE_TRANSITION}>` with `--voice-glow`. If storage is empty or
   blocked, `KeptLine` swaps the heading for the ordinary `SIGN_IN_COPY.headline`, inside the same
   reserved box, so there's no shift. The rest of the form is unchanged.
3. **First run (E).** On the last step ("time"), if `readFirstLine()` returns a line, show the
   checkbox "Start Story Studio with the line you said on our homepage" (checked by default), with
   the line quoted under it in Newsreader. `completeFirstRun` gains an optional `firstLine`
   (Zod: trimmed, 1–200 characters). When it's sent, the server creates a source
   `{ kind: "conversation_note", text: line, meta: { origin: "homepage_line" } }` with the existing
   `createSource` (encrypted, no migration). The client clears storage after the action succeeds,
   or immediately if the box is unchecked.
4. **Studio opener (E).** In `lib/studio/turn.ts`, next to `expressOpener`, add `homepageOpener`.
   When this is the user's first session and it has no turns yet, and an unused `homepage_line`
   source exists, the first `seedQuestion` becomes "On our homepage you said: “{line}” Tell me what
   happened next." (copy in `_copy/keep-line.ts`; sentence case, no praise). The source is then
   marked used (`meta.usedAt`). If that can't be done without a migration or a model change,
   leave the opener out and record why. The source still reaches the Dossier through the normal
   extraction path. Existing Studio tests must stay green.

---

## 6. Tests (vitest, unit project; no new Playwright files)

| Package | File                                                                                                                         | What it asserts                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F       | `packages/ui/src/motion-curves.test.ts`                                                                                      | `springEase(t)` matches `cssSpring` samples at the 41 points (±0.002); 0 and 1 at the ends; overshoot exists for snap and glide; `SETTLE_SECONDS` equals the tokens.css durations.                                                                                                                                                                               |
| F       | `(marketing)/_copy/honest-claims.test.ts`                                                                                    | Loads every `_copy/*.ts` (`import.meta.glob`, eager) and walks all string values. Fails on "guarantee", "undetectable", "unleash", "supercharge", "journey", "oops", "something went wrong" or "!". "odds", "chance" and "admission" pass only inside a negated sentence ("won't", "don't", "not", "no", "never", "nobody"). Also unit-tests the scanner itself. |
| F       | `lib/marketing/first-line.test.ts`                                                                                           | Round trip, 24 h expiry, malformed JSON, over 200 characters, refuses `sample`, a throwing storage returns null or false.                                                                                                                                                                                                                                        |
| F       | `(marketing)/_lib/gates.test.ts`                                                                                             | The renderer, follow and smooth-scroll gates across phone, desktop, reduced motion, Save-Data and tier 1.                                                                                                                                                                                                                                                        |
| F       | `lib/marketing/public-data.test.ts`                                                                                          | Unverified policies are never returned; a database error gives `[]`; the memo expires after an hour (fake timers); `packSchools` drops schools without a pack.                                                                                                                                                                                                   |
| F       | `app/sitemap.test.ts`, `app/robots.test.ts`                                                                                  | Exactly the five routes, absolute on `siteUrl()`; robots disallows the app paths and links the sitemap.                                                                                                                                                                                                                                                          |
| F       | `scripts/bundle-budget.test.ts`                                                                                              | 155 for each marketing route, 160 otherwise.                                                                                                                                                                                                                                                                                                                     |
| F       | `(marketing)/_lib/track.test.ts`                                                                                             | The event names are exactly the seven; props reject strings over 40 characters (types plus a runtime guard); nothing loads without `POSTHOG_KEY`.                                                                                                                                                                                                                |
| F       | `(marketing)/_ui/ai-policy-table.test.tsx` (jsdom)                                                                           | Empty rows render nothing; `limit` is respected; the verified date is shown.                                                                                                                                                                                                                                                                                     |
| A       | `_hero/line-cleanup.test.ts`                                                                                                 | Fillers ("um", "uh", "erm", "you know", "like," used as a filler, repeated words "I I"), capitalisation, a full stop added, the first full sentence kept when over 40 words, punctuation kept, the removal count, empty input returns null.                                                                                                                      |
| A       | `_hero/hero-state.test.ts`                                                                                                   | Reducer: every transition in direction §4.2 including interrupt and Escape from each animating state; error mapping to the five copy cases; "No microphone API" hides Speak.                                                                                                                                                                                     |
| A       | `api/demo/stt-token/route.test.ts`                                                                                           | Refuses without a Turnstile token when keyed (siteverify stubbed); the 4th call from one IP within an hour gives 429; `DEMO_STT=off` gives 503 paused; production with no provider key and a non-local APP_URL gives 503 paused; dev with the fake gives 200 with `remainingSeconds: 15` and `mip_opt_out=true`; logs never contain the token or IP.             |
| A       | `_hero/sample.test.ts`                                                                                                       | `public/marketing/sample-line.json` parses, its word timings reproduce `SAMPLE_LINE`, and the envelope is 60 Hz and within the duration.                                                                                                                                                                                                                         |
| B       | `_follow/follow-geometry.test.ts`, `_follow/follow-section.test.tsx` (jsdom)                                                 | Rect-to-tween target maths (x, y, scale from two rects); the chapter label order; all four chapters present in DOM order with their statements and paragraphs; the fictional note; `#follow` exists.                                                                                                                                                             |
| C       | `_sections/faq.test.ts`, `_sections/sections.test.tsx` (jsdom)                                                               | FAQ JSON-LD equals the rendered Q&A; the schools answer for n=0 and n>0; the AI-policy block shows the fallback line when there are no verified rows; `Y` toggles only with focus inside the toy; screens with missing captures are left out.                                                                                                                    |
| D       | `pricing/pricing.test.ts`, `how-it-works/how-it-works.test.ts`                                                               | `Product` JSON-LD has offers 0 and 100 USD; ledger rows each say "Included" or "—" in words; the unlock toggle reducer; eight steps in order; no AI-policy table without verified rows.                                                                                                                                                                          |
| E       | `_legal/legal.test.ts`, `first-run/first-line-seed.test.ts`, `lib/studio/homepage-line.test.ts`, `sign-in/keep-line.test.ts` | Section anchors are unique and the contents match the sections; terms carry `REFUND_RULE` verbatim; `completeFirstRun` with `firstLine` creates one `conversation_note` source (db mocked); the opener fires only on a first session with no turns; `from=line` parsing.                                                                                         |

Gates for every package before it hands off: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`. Builds are run by Foundation and INTEGRATE (one at a time, because `.next` is
shared). Never run `db:migrate`, `test:integration` or `seed:fixtures`, since the database is
shared.

---

## 7. Deviations from the direction (each needs Manu's nod, and each is listed in `docs/phase-9a.md`)

| #   | Direction says                                  | Plan does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Why                                                                                                                                |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | First-load JS ≤ 120 KB on marketing routes      | ≤ 155 KB (target ≤ 152 on `/`, about 144 elsewhere). Optional lever if it's tight: move `ToastProvider` from the root layout into the layouts that toast (−4 KB on marketing), which touches files the other team uses, so only with Manu's go-ahead.                                                                                                                                                                                                                                          | F1: the framework floor is about 133 KB, and the root layout adds about 8.                                                         |
| D2  | `sessionStorage` only                           | `localStorage`, with a 24 h expiry, cleared once used or declined. The privacy line is unchanged: nothing reaches our servers until the first-run checkbox.                                                                                                                                                                                                                                                                                                                                    | F12: the magic link opens in a new tab.                                                                                            |
| D3  | `@gsap/react`                                   | Not installed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The sequence isn't a React tree; `gsap.matchMedia()` plus `revert()` covers the StrictMode cleanup.                                |
| D4  | `'use cache'` with `cacheLife('hours')`         | An in-process 1 h memo                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | F9: `cacheComponents` would change every route in the app.                                                                         |
| D5  | `DEMO_FAKE_STT=1` replays the sample            | Development uses the existing fake STT server (real microphone, placeholder words). If it isn't running, the hero shows the paused state.                                                                                                                                                                                                                                                                                                                                                      | It reuses the Studio's path with no new fake. The sample is already covered by "Play a sample".                                    |
| D6  | A server-side 30 s TTL ends the connection      | Client cap at 15 s, a 20 s watchdog, `retryDelaysMs: []`, and the token TTL stays at the provider's (60 s)                                                                                                                                                                                                                                                                                                                                                                                     | F7: the Deepgram TTL only covers the handshake. A hard server cap needs a relay, which is out of scope. This goes in 9b as a risk. |
| D7  | Exhibit 5: interview report                     | The live-mock duet until Phase 7 ships the report                                                                                                                                                                                                                                                                                                                                                                                                                                              | F13: only real screens.                                                                                                            |
| D8  | `sample-line.opus` generated with Aura-2        | There's no key yet. `scripts/marketing-sample.ts` writes `sample-line.json` (estimated word timings with `estimateWordTimings`, and an envelope from `syntheticSignalAt`) now. "Play a sample" then runs silently with captions, and the label reads "Sample, shown without sound. The applicant is fictional." With `DEEPGRAM_API_KEY`, the script generates `sample-line.webm` (Opus) and `sample-line.m4a` (AAC, for older Safari) and real timings, and the label becomes the direction's. | No keys exist. Opus in WebM isn't safe on older Safari.                                                                            |
| D9  | Phone menu uses `Sheet`                         | Native `<dialog>` styled as the sheet (radius 28 at the top, glide)                                                                                                                                                                                                                                                                                                                                                                                                                            | F3: Radix stays off marketing routes.                                                                                              |
| D10 | Static HTML twins vs real components            | Real components rendered through deferred islands (§3.4)                                                                                                                                                                                                                                                                                                                                                                                                                                       | F2. This keeps the "real components, not mock-ups" rule without paying for their JS.                                               |
| D11 | Per-route CSP for Turnstile and Deepgram on `/` | Deferred to 9b                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | F15: the current CSP doesn't block them, and the full CSP is a 9b item.                                                            |

---

## 8. FOUNDATION scope (run first, alone)

1. **Dependencies.** `gsap@3.15.0` and `lenis@1.3.27` (exact) in `apps/web`, plus the lockfile.
   Write `docs/decisions/0xx-gsap-lenis.md` with the licence check (date, URL, the clause).
2. **`packages/ui`.** Add `springs.ts`, `motion-curves.ts` (+ test). `motion.ts` imports from
   them. In `index.ts`, export `springSamples`, `springEase` and `SETTLE_SECONDS`, and re-export
   `setThemePreference` and `useThemePreference` from `./components/theme-store` instead of
   `./components/theme-toggle` (same names, so no breaking change).
3. **`packages/db`.** Add `listVerifiedAiPolicies(db)` to `repos/schools.ts` (verified only,
   ordered by school name, newest cycle per school), exported through the repos barrel.
4. **Env.** Add `SITE_URL` (optional URL), `DEMO_STT` (`"on" | "off"`, default on) and
   `DEMO_DAILY_CAP` (int, default 500) to `ServerEnv` and `.env.example`.
5. **`lib/marketing/`.** `first-line.ts`, `routes.ts`, `site-url.ts` and `public-data.ts`, with
   tests.
6. **Marketing layout and chrome.** `(marketing)/layout.tsx` and `_chrome/*`:
   - **Nav.** Server markup. `nav-compact.tsx` is a tiny client module: an IntersectionObserver on
     `#hero-end` (pages without a hero render compact from the start), which toggles
     `data-compact` and so drives the CSS change to `--depth`/88% with blur and `--edge` on glide.
     `menu-dialog.tsx` is a native `<dialog>` with a "Menu" button (44 px) and focus return.
     `view-transition-name: site-header` with no animation.
   - **Footer.** Four columns (two on phones), the copyright and affiliation lines, `{legal entity}`
     and the email addresses as clearly marked constants in `_copy/chrome.ts` (Manu provides the
     values).
   - **Theme switch.** "Night" and "Day" as a two-option radio group with a sliding 2 px
     `--signal` indicator on snap, and the note "Night is easier at 1 a.m.". It writes through
     `setThemePreference` and also updates `[data-marketing-theme]`. Arrow keys work.
   - **Smooth scroll.** `_motion/smooth-scroll.ts` exports `getLenis(): Promise<Lenis | null>`, a
     singleton. `SmoothScrollHost` starts it on the first `wheel` when `desktopMotionAllowed`,
     with `autoRaf: true`. B attaches ScrollTrigger to it.
   - **Track.** One delegated click listener for `data-track`.
7. **Primitives and data.** `_ui/*` (§3.3, including the verified `Deferred` primitive, §3.4,
   `AiPolicyTable` and `JsonLd`), `_lib/gates.ts`, `_lib/track.ts`, `_lib/seo.ts`, `_data/*`,
   `_copy/shared.ts` (the fictional note, the five integrity lines, `REFUND_RULE`, `TAX_LINE`),
   `_copy/chrome.ts`, and `_copy/honest-claims.test.ts`.
8. **SEO.** `app/sitemap.ts`, `app/robots.ts`, Organization JSON-LD in the layout, and
   `pageMetadata()`.
9. **`/` and stubs.** Replace `(marketing)/page.tsx` with the section composition below, and
   create **minimal real-content stubs** (no lorem ipsum: the heading plus one sentence from the
   direction) for every file a package owns and that `page.tsx` or the routes import:

   ```tsx
   // (marketing)/page.tsx (Foundation owns this; packages never edit it)
   export const metadata = pageMetadata({
     title: { absolute: HOME_TITLE },
     description: HOME_DESCRIPTION,
     path: "/",
   });
   export default function Home() {
     return (
       <>
         <Hero /> {/* ./_hero/hero            (A) */}
         <FollowSection /> {/* ./_follow/follow-section (B) */}
         <HowItWorksLines /> {/* ./_sections/how-it-works-lines (C) */}
         <RealScreens /> {/* ./_sections/real-screens (C) */}
         <YourWordsSection /> {/* ./_sections/your-words (C) */}
         <WontDoSection /> {/* ./_sections/wont-do (C) */}
         <PricingSection /> {/* ./_sections/pricing (C) */}
         <FaqSection /> {/* ./_sections/faq (C) */}
         <FinalCall /> {/* ./_sections/final-call (C) */}
       </>
     );
   }
   ```

   Stub files: `_hero/hero.tsx`, `_follow/follow-section.tsx`, the seven `_sections/*.tsx`,
   `pricing/page.tsx`, `how-it-works/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`,
   `_legal/legal-layout.tsx`, `opengraph-image.tsx`, `api/demo/stt-token/route.ts` (returns 503
   paused), and empty `_copy/{hero,follow,landing,faq,pricing-page,how-it-works,privacy,terms,keep-line}.ts`
   (each `export {}`). Section components that are async (FAQ, wont-do) take no props and fetch
   through `public-data.ts` themselves.

10. **Scripts.** `bundle-budget.ts` (+ test) wired into `bundle-size.ts`; `lighthouse.ts
--marketing`. Add the `apps/web/package.json` scripts `marketing:sample` (`tsx
scripts/marketing-sample.ts`) and `capture:screens` (`tsx
scripts/capture-marketing-screens.ts`), with stub script files that print "not built yet".
    Remove `"/"` from `e2e/redirects.spec.ts`.
11. **Prove it.** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
&& pnpm --filter @admitstory/web bundle:check`. Record the **measured floor for each marketing
    route** and the result of the deferred-island proof (§3.4) under "Foundation notes" at the end
    of this file. Start `next start --port 3100` once to check `/` renders with the stubs (curl),
    then stop it.

Foundation must not edit: `apps/web/app/layout.tsx` (not needed), `next.config.ts` (not needed),
any `packages/ui` component other than `index.ts`, `motion.ts` and the new files, sign-in,
first-run or Studio files.

---

## 9. BUILD packages

Each brief below is complete in itself. The same text goes into the structured hand-off. Common
rules for every package:

- **Edit only your owned paths.** Read anything else. If you need a change outside your paths,
  don't make it: write it under "Requests" in your report.
- **Follow the direction's sections** cited in your brief. Copy goes in your `_copy/*.ts` file as
  exported constants (the honest-claims test scans it), in sentence case, with no "!", and is
  honest per §14.5.
- **Tokens only** (`--space`, `--depth`, `--edge`, `--text`, `--text-soft`, `--signal`, `--voice`,
  `--voice-glow`, `--silver`) and the `text-display-*` and spring utilities. No new colours,
  easings, durations or type sizes. `--voice` only on applicant material.
- **Performance.** Nothing you add to a route's first load except what your brief allows. Real
  `packages/ui` components that use Motion go through `deferred()` islands. Measure with
  `bundle:check` only if your brief says you may build, otherwise leave it to INTEGRATE.
- **Accessibility.** WCAG 2.2 AA, 44 px targets, the §6.12 focus ring, real text, reduced motion
  and tier 1 complete. Check at 390, 768, 1024, 1280 and 1440 px in Night and Day.
- **Gates.** `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` before handing
  off. If you start a server, use port 3100 and stop it afterwards. Don't run `pnpm build` (one
  `.next` is shared; INTEGRATE builds). Never `db:migrate`, `test:integration` or
  `seed:fixtures`. No git commits.

### 9.1 Package A: the hero and the speak route

**Read first.** Direction §2, §4.2 (all of it, including the choreography table, the error table
and "Keeping the line") and §10. This plan's §0 (F2, F4–F8), §3.2, §3.4–3.6, §4, §5 step 1 and
§7 (D2, D5, D6, D8). Code: `packages/ui/src/studio/{record-button,live-transcript,timed-text,flight-path,synthetic-signal,word-timing}`,
`packages/ui/src/voiceprint/{voiceprint,identity,audio,tier}`,
`packages/voice/src/client/{dictation,capture,token,endpointing}.ts`,
`apps/web/app/api/stt/token/route.ts` (+ test) and `apps/web/lib/voice/server.ts`.

**Owns.** `apps/web/app/(marketing)/_hero/**`, `apps/web/app/(marketing)/_copy/hero.ts`,
`apps/web/app/api/demo/**`, `apps/web/public/marketing/sample-line.*` and
`apps/web/scripts/marketing-sample.ts`.

**Build.**

1. **`_hero/hero.tsx` (server, export `Hero`).**
   `<section id="hero" data-theme="night" class="grain">`, `100svh`, `aria-labelledby` the H1.
   - **Poster.** A `<figure aria-label>` holding `VoiceprintStill identity={SAMPLE_IDENTITY} size="fill" label=""`.
     Desktop box: `min(112svh, 100vw)`, centred, bleeding past top and bottom. Phone box: `120vw`,
     centred in the top 55%.
   - **H1.** `DisplayHeading` xl: "Say one thing / about yourself." on desktop, and "Say one /
     thing about / yourself." on phones through phone-only `<br>`. One sentence for screen
     readers. It's the LCP element: no animation, opacity or transform at first paint, ever.
   - **Subline.** Newsreader 21/32 (19/32 on phones), `--text-soft`.
   - **`<HeroStage/>`** (below).
   - **Margin note.** Bottom-right, 13 px: "Scroll to follow one sentence through AdmitStory".
   - **Sentinel.** `<div id="hero-end">` at the bottom edge (the nav compacts after it).
   - **Phone layout.** The record control is a full-width 56 px bar with the circle on its left,
     then "Play a sample" and "Write instead" side by side, all in the thumb zone.
2. **`_hero/hero-stage.tsx` (`"use client"`, the only first-load hero code, ≤ 8 KB gz of its own).**
   - **State.** `hero-state.ts` (a pure reducer: idle, explaining, requesting, listening,
     finishing, placing, placed, writing, sample, and the five error cases).
   - **First-paint controls.**
     - "Speak for 15 seconds": a 72 px circle styled exactly like `RecordButton`'s idle state
       (`bg-signal text-on-signal`, inline mic SVG, label in UI 17).
     - "Play a sample": `buttonStyles({ variant: "secondary" })`.
     - "Write instead": a text button.
     - The privacy line.
     - A reserved transcript box (three lines, `contain: layout paint`), and absolutely positioned
       slots for the explainer, sheet and caption, so nothing below ever moves.
   - **Allowed imports.** React, `cx`, `buttonStyles`, types, `_lib/gates`, `_lib/track`,
     `lib/marketing/first-line` and `_data/sample`. **Not allowed:** `motion/react`, Phosphor,
     Radix, or any `packages/ui` client component.
   - **Renderer gate.** Use `rendererGate`.
     - Desktop: after `load`, then `requestIdleCallback` (with a `setTimeout` fallback), and only
       while the hero is in view.
     - Phone: only on the first `pointerdown`, `scroll` or `keydown`.
     - When the gate opens, lazy-mount `hero-voiceprint.tsx` (`React.lazy`): an absolutely placed
       `<Voiceprint size="fill" identity mood signal label="">` over the poster, which stays
       underneath. Tier 1 and reduced motion never load it.
   - **Prefetch.** On `pointerenter` or `focus` of any action, prefetch the `hero-result` chunk.
   - **Space key.** Space toggles recording only while focus is inside `#hero`.
3. **`_hero/hero-result.tsx` (lazy).** Direction steps 3 and 5–8:
   - **Live transcript.** `LiveTranscript` in Geist 500 at `--type-display-sm`, centred over the
     form. The active line's weight shifts ±60 with amplitude through a CSS variable written in
     rAF from the signal ref, never React state.
   - **Glow.** Each word takes a `--voice` glow, staggered 40 ms.
   - **The sheet.** `data-theme="day"`, `--depth`, 28 px radius, max 720 px, Newsreader 19/32,
     with the header "Essay 1 · first draft", a reserved first line and five faint ruled lines.
     It rises on drift.
   - **The flight.** Use `packages/ui/src/studio/flight-path.ts` (`flightControlPoint`,
     `quadraticPoint`, `flightBox`) driven by WAAPI with `cssSpring("drift")`, 40 ms apart,
     32 → 19 px. Each word lands with a 2 px blur that sharpens, and in its last 120 ms the Geist
     word cross-fades into the waiting Newsreader word. Then the line takes `--voice-glow`.
   - **Caption.** The direction's caption, plus the fillers sentence when fillers were removed,
     plus the Voiceprint sentence when the identity is usable.
   - **Actions.** "Sign up and keep this line" (primary) and "Say it again" (ghost).
   - **Wrap the lit line** in `<SharedElement name={FIRST_LINE_TRANSITION}>`.
   - **Announce.** `aria-live="polite"`: "Your line is in the essay: {line}".
   - **Interrupts.** Escape or "Say it again" reverses from wherever the animation is, on glide,
     and returns the form to idle.
   - **Reduced motion and tier 1.** No flight and no weight response; the sheet appears in place
     with the line already lit, with 120 ms fades.
4. **`_hero/hero-demo.ts` (`import()` inside the Speak handler).** Implements this plan's §4
   client side.
   - **Explainer.** The plane opens under the button (its height is reserved) with the §6.9 copy,
     cased "AdmitStory", and the buttons "Allow microphone" and "Write instead".
   - **Microphone.** `getUserMedia` is called only after "Allow microphone".
   - **Turnstile.** Load the explicit-render script yourself, in the explainer, with action
     `hero_demo`. Skip it when `process.env.TURNSTILE_SITE_KEY` is empty.
   - **Token.** `fetchDemoToken()` POSTs to `/api/demo/stt-token`, reads `reason`, and maps it to
     the error table.
   - **Dictation.** `createDictationSession({ retryDelaysMs: [] })`, with `startPcmCapture` and an
     `AnalyserNode` feeding a `VoiceSignalRef` on one `AudioContext`.
   - **Identity.** `createIdentityAccumulator()`. When it reports `usable`, re-seed the form to the
     visitor's identity on drift.
   - **Recording state.** The real `RecordButton` (lazy) in the same 72 px box, a 15 s ring, and
     "0:12" in tabular numerals. Announce "Recording, 12 seconds left".
   - **Dim.** The H1 and subline dim to 35% on snap. Opacity only, so the LCP is unaffected.
   - **Stop.** At 15 s, on "Done", or after 2.5 s of silence after a sentence end. A 20 s
     watchdog disposes everything regardless.
   - **No microphone API.** Hide Speak and make "Write instead" the primary action.
   - **Service unavailable** (no token, socket failure, or the dev fake server not running).
     Show "Speaking is paused on this page right now. You can write your line instead, or play
     the sample." and disable Speak with that text as its description.
5. **`_hero/hero-sample.ts`.**
   - **Data.** Fetch `/marketing/sample-line.json` on tap. If the manifest lists audio, create
     `<audio preload="none">` on tap (`.webm` Opus, falling back to `.m4a`).
   - **Playback.** The clock drives `syntheticSignalAt` (the form) and `TimedText` (the words),
     then steps 4–8 run.
   - **Without audio.** Run silently on a timer, labelled "Sample, shown without sound. The
     applicant is fictional." (D8).
   - **Keeping.** The sample can't be kept: its caption actions are "Say your own line" (primary,
     back to Speak or Write) and "Start free".
6. **Write instead.**
   - A two-line textarea in Newsreader 32 px with the placeholder "The night the system went
     down, I…" and a 200-character limit. The counter is in tabular numerals.
   - The button reads "Place it in an essay". Then steps 5–8 run, with no filler step.
   - Identity comes from `identityFromText`.
7. **`_hero/line-cleanup.ts` (pure).**
   - Remove fillers: um, uh, erm, "you know", and repeated words.
   - Capitalise the first letter and add a full stop.
   - Over 40 words, keep the first full sentence.
   - Return `{ line, removed }`, or `null` when nothing is left (the "Nothing heard" state).
8. **Keep the line.** `saveFirstLine(...)`, then `track("hero_keep_line")`, then
   `router.push("/sign-in?from=line")` inside `startTransition`. Also track `hero_speak_start`,
   `hero_line_placed` (`source`) and `sample_played`.
9. **`app/api/demo/stt-token/route.ts`.** Exactly this plan's §4, including the hashed IP, the
   in-process `DemoLimiter`, `DEMO_STT`, `DEMO_DAILY_CAP` and `mip_opt_out=true`. Logs carry
   counts only.
10. **`scripts/marketing-sample.ts`.**
    - Without a key: write `sample-line.json` from `estimateWordTimings`, plus a 60 Hz
      `{ amplitude, centroid, pitchDelta }` envelope from `syntheticSignalAt`, with `audio: null`.
      Commit the JSON.
    - With `DEEPGRAM_API_KEY`: also synthesise with Aura-2, write `.webm` and `.m4a`, and take the
      timings from the TTS output.
    - Foundation already added the `marketing:sample` script entry.

**Tests.** `line-cleanup.test.ts`, `hero-state.test.ts`, `api/demo/stt-token/route.test.ts` (mock
`server-only` and the providers as `api/stt/token/route.test.ts` does) and `sample.test.ts`. The
cases are in §6.

**Done when** the four gates pass, the hero works in `pnpm dev` (port 3100) with and without
`pnpm --filter @admitstory/voice fake-stt` running, "Write instead" and "Play a sample" reach the
caption, and Escape interrupts cleanly. Report the hero's import list so INTEGRATE can check the
8 KB budget.

### 9.2 Package B: follow one sentence (the pinned sequence)

**Read first.** Direction §2, §3 (motion plumbing), §4.3 (all of it) and §10 (the follow chunk,
CLS). This plan's §1 (GSAP and Lenis), §3.1, §3.3–3.5 and §7 D3/D10. Code:
`packages/ui/src/studio/{spoken-question,live-transcript,story-card}.tsx`,
`packages/ui/src/workspace/{your-words-text,need-chip}.tsx`,
`packages/ui/src/voiceprint/voiceprint-still.tsx`, `packages/ui/src/interview/duet-stage.tsx`,
`(marketing)/_data/sample.ts`, `_ui/deferred.tsx` and `_motion/smooth-scroll.ts`. The GSAP 3.15
docs for ScrollTrigger (pin, snap `labelsDirectional`) and SplitText (`mask`, `autoSplit`,
`aria`).

**Owns.** `apps/web/app/(marketing)/_follow/**` and `apps/web/app/(marketing)/_copy/follow.ts`.

**Build.**

1. **`_follow/follow-section.tsx` (server, export `FollowSection`).**
   - `<section id="follow" data-theme="night" class="grain">` with a visually hidden h2.
   - Four `<article data-chapter>` in DOM order. Each has:
     - the MarginNote "n of 4" in tabular numerals;
     - an h3 statement on two author-set lines;
     - the Newsreader 19/32 paragraph;
     - the frame: `PlaneFrame` plus `ScaledFrame` (720 design width, fixed aspect ratio).
   - The fictional note.
   - **This is the stacked version:** phones, tablets, touch, reduced motion and no-GSAP all get
     it, and it must look finished on its own. Statements are `--type-display` (40–64 px).
   - **Sentence glow.** Inside `@supports (animation-timeline: view())` and with no reduced
     motion, each chapter's sentence glow fades 0 → full over
     `animation-range: entry 30% cover 45%`. Otherwise it's simply on.
   - Copy is in `_copy/follow.ts` (the statements and paragraphs from the direction's table).
2. **Frames (`_follow/frames/*.tsx`, `"use client"`).** These are lazy targets rendered through
   `deferred(() => import(...), "never")` islands, so their real HTML is server-rendered and their
   JS never loads. Use the real components with `_data/sample.ts`:
   1. **Studio.** `SpokenQuestion` (no clock, static), a small `VoiceprintStill` and
      `LiveTranscript` with the sentence as a final segment.
   2. **Story.** `StoryCard`, expanded: "The night-shift fix · Work, 2024", the traits, three
      "Confirmed" facts, and the phrase in `--voice`.
   3. **Workspace.** A sheet with `data-theme="day"` holding the first two essay sentences, the
      first lit with `--voice-glow`. Use `YourWordsText` with `on`. Add the provenance plane and
      the `NeedChip`.
   4. **Interview.** A still duet: a silver `VoiceprintStill` facing a small applicant-hue one,
      the silver Newsreader caption, talking points in UI 15, and the quoted reference "From your
      Essay 1".

   Each frame marks its sentence slot with `data-sentence-slot`.

3. **`_follow/follow-host.tsx` (`"use client"`, ≤ 1 KB, rendered by the section).**
   - It uses `followGate`: it loads when `#follow` is within one viewport (IntersectionObserver),
     or on idle after the hero renderer, whichever comes first. It never loads on phones, tablets,
     touch, reduced motion or Save-Data.
   - Then `import("./follow-sequence")`, and call `startFollow(sectionEl, { lenis: await getLenis() })`,
     which returns a cleanup. Run it in an effect and clean up on unmount.
4. **`_follow/follow-sequence.ts` (the only module that imports `gsap`, `gsap/ScrollTrigger` and `gsap/SplitText`).**
   - **Setup.** `gsap.registerPlugin(ScrollTrigger, SplitText)`, then
     `gsap.matchMedia().add(DESKTOP_MOTION_QUERY, ...)`.
   - **Layout switch.** Add a class (`is-pinned`) that switches the section's CSS to the
     two-column pinned arrangement:
     - Left, columns 1–5: the statements and paragraphs stacked in place, at `--type-display-lg`.
     - Right, columns 6–12: the frames stacked.
     - One `aria-hidden` travelling sentence element (Newsreader) layered above the frames.

     The four articles stay in the DOM and in reading order.

   - **Timeline.** As in the direction's code block: `ease: "none"`, `end: +=innerHeight*3.2`,
     `pin`, `scrub: true`, `anticipatePin: 1`, `invalidateOnRefresh`, and snap with
     `labelsDirectional`, durations 0.35–0.68 and `ease: springEase("drift")`. Labels c1–c4, one
     unit apart. Within each change of chapter:
     - SplitText `type: "lines"`, `mask: "lines"`, `autoSplit: true`, the outgoing lines going
       yPercent 0 → −100 and the incoming 100 → 0, staggered 0.06;
     - the paragraph cross-fades;
     - the outgoing frame fades and drifts up 24 px while the incoming one fades in from 24 px
       below;
     - the sentence tweens x, y and scale between `data-sentence-slot` rects, measured on refresh
       by `follow-geometry.ts` (pure), with its colour moving `--text` → `--voice` → `--text` on
       paper with glow → `--text-soft`.
   - **Lenis.** Never create a second instance: if `getLenis()` resolved, call
     `lenis.on("scroll", ScrollTrigger.update)`.
   - **Timing.** Split and measure on the first idle frame, never during a scroll.
   - **Tier 1 on desktop** still pins; the duet forms are already stills.
   - **Cleanup.** `mm.revert()` restores the stacked DOM.
5. **CLS.**
   - The pin spacer is created while the section is still one viewport away.
   - The switch happens off-screen.
   - No section fades in.
   - Verify with the Performance panel that layout shift stays 0 while scrolling past the hero.

**Tests.** `follow-geometry.test.ts` (the rect → `{ x, y, scale }` maths, and the chapter order)
and `follow-section.test.tsx` (jsdom: four chapters in DOM order with their statements and
paragraphs, the fictional note, `#follow`).

**Budget.** At most 1 KB added to `/` first load. The follow chunk (gsap, ScrollTrigger,
SplitText, our code) ≤ 60 KB gz. Lenis is in Foundation's chunk.

**Done when** the four gates pass. In `pnpm dev` at 1440 px with a mouse, the sequence pins,
snaps to chapters, interrupts cleanly and reverses. At 390 px, under reduced motion, and on touch
emulation, GSAP is never requested (Network panel) and the stacked version reads well.

### 9.3 Package C: the rest of the landing page

**Read first.** Direction §2, §4.4–4.10 (copy is verbatim from there), §9 (FAQ JSON-LD) and §10
(images, islands). This plan's §0 (F2, F11, F13), §3.3, §3.4, §3.6–3.8 and §7 D7. Code:
`packages/ui/src/workspace/{your-words-text,your-words-controls,shortcuts}`,
`packages/ui/src/voiceprint/voiceprint-still.tsx`, `apps/web/app/prototype/**` (the duet and
workspace prototypes), `packages/ui/src/{dossier,profile,strategy}` and their
`fixtures.testing.ts`, `(marketing)/_data/{sample,pricing,screens}.ts`, `_ui/*` and
`apps/web/lib/marketing/*`.

**Owns.** `apps/web/app/(marketing)/_sections/**`, `apps/web/app/(marketing)/_copy/landing.ts`,
`apps/web/app/(marketing)/_copy/faq.ts`, `apps/web/public/marketing/screens/**`,
`apps/web/scripts/capture-marketing-screens.ts` and `apps/web/app/prototype/marketing-screens/**`.

**Build.** One file per section in `_sections/`, each exporting the component that
`(marketing)/page.tsx` already imports. None of them animate on their own or fade in on scroll.

1. **`how-it-works-lines.tsx` (`HowItWorksLines`, §4.4).**
   - Page theme. The heading at `--type-display`: "Twenty minutes to a first draft.", then the
     paragraph and the "See how it works" text link.
   - Three hairline rows: the step at display-sm, the sentence in UI 17 `--text-soft`, and the
     time or price right-aligned in tabular numerals. On phones the time sits under the sentence.
2. **`real-screens.tsx` (`RealScreens`, §4.5).**
   - The heading, and the paragraph with its one dry line.
   - A native sideways scroller: `overflow-x: auto`, `scroll-snap-type: x mandatory`,
     `scroll-padding-inline: 24px`. Add Lenis's horizontal-prevent attribute; check the
     lenis 1.3.27 README for the exact `data-lenis-prevent*` name.
   - The region is focusable with the label "App screens, scroll sideways". Visible "Previous"
     and "Next" buttons (44 px, text labels) show only on `(pointer: fine)`, in a ≤ 1 KB client
     module.
   - Exhibits come from `_data/screens.ts`, filtered by `screenAvailable(id)`: a plane holding a
     `next/image` capture (AVIF, `sizes="(min-width:1024px) 880px, 88vw"`, lazy, explicit width
     and height), the name in Geist 600 at 17 px, and one UI 15 sentence. If fewer than two
     captures exist, render nothing but the heading and paragraph.
3. **Captures.**
   - **`app/prototype/marketing-screens/[id]/page.tsx`.** Dev-only under the existing prototype
     gate. It composes the **real** `packages/ui` components with fixture data, in Night at
     1440 × 900 with the dock visible where the app shows it: Dossier constellation, Profile Read
     lens instrument, School Strategy horizon, Workspace (reuse the workspace prototype), and the
     live-mock duet (D7: the interview report isn't built yet).
   - **`scripts/capture-marketing-screens.ts`.** A plain Playwright script, not a test, run
     against `pnpm dev` on port 3100. It screenshots each at DPR 2 and encodes AVIF at quality 55,
     1760 × 1120 (sharp), into `public/marketing/screens/{id}.avif`. Commit the outputs.
   - If a screen can't be composed honestly from real components, drop it and say so. Never draw
     a mock-up. Don't use `seed:fixtures`: the database is shared.
4. **`your-words.tsx` (`YourWordsSection`, §4.6).**
   - Heading, the Newsreader paragraph in columns 1–4, and the switch, with `Y` shown beside it
     as a key.
   - Columns 5–12: a Day paper sheet holding the whole `SAMPLE_PARAGRAPHS` essay, rendered with
     the real `YourWordsText` through a `deferred(..., "visible")` island (`your-words-toy.tsx`).
     The server renders the switch off.
   - **Behaviour.** The glow turns on along glide. Hover or focus shows the source line in the
     provenance plane (snap). `Y` works only while focus is inside the section. On phones the
     switch sits above the sheet, full width, and tapping a lit sentence shows its source under
     it. Reduced motion means no fade.
   - The fictional note.
5. **`wont-do.tsx` (`WontDoSection`, §4.7, `id="wont-do"`).**
   - A Night plane in either theme. The heading at display-lg: "What it won't do."
   - The five lines from `_copy/shared.ts` `INTEGRITY_LINES`, in Newsreader at display-sm,
     hairline separated, numbered in a 13 px tabular margin. No icons.
   - The quiet line, then `AiPolicyTable` `variant="compact"` `limit={6}` from
     `verifiedPolicies()`, with "See all schools' AI policies" linking to
     `/how-it-works#ai-policies`.
   - With no verified rows, the line becomes "Each school's policy is shown in the app with the
     date we checked it." and there's no table.
6. **`pricing.tsx` (`PricingSection`, §4.8).**
   - One plane split by a vertical hairline on desktop, horizontal on phones. Not two cards.
   - "$0" and "$100" at display-xl (64 px on phones), tabular, with "per school".
   - The lists come from `_data/pricing.ts`, each item with a 2 px `--verified` tick.
   - The expert line and the tax/refund line.
   - "Start free" (primary, `data-track` `cta_start_free` with location "pricing") and "See
     what's in a kit" (ghost, to `/pricing`).
   - No badges and no strikethrough.
7. **`faq.tsx` (`FaqSection`, §4.9).**
   - Heading in columns 1–4, the list in columns 5–12.
   - Native `<details>`/`<summary>`. The question in Geist 500 at 21 px, and a 16 px plus that
     becomes a minus (rotation on snap). The answer in UI 17/26 `--text-soft` at a 62-character
     measure.
   - Opening: `interpolate-size: allow-keywords` with a height transition on glide, inside
     `@supports`.
   - **Data.** In `_copy/faq.ts`. The schools answer uses `packSchools()`: with n > 0, "Kits are
     ready for {n} schools: {list}." plus the vote line; with n = 0, the fallback sentence.
   - **JSON-LD.** `FAQPage` built from the same data.
   - **Tracking.** A tiny client listener tracks `faq_open` with the question id (a capture-phase
     `toggle` listener on the section).
8. **`final-call.tsx` (`FinalCall`, §4.10).**
   - A Night band, with a 240 px `VoiceprintStill`, centred and still.
   - A tiny `deferred(..., "idle")` island swaps in the visitor's identity from `readFirstLine()`,
     in the same box, so nothing shifts.
   - The one centred display-lg line: "Your story, told well, for each school."
   - "Start free" (primary) and "Sign in" (text link).

**Tests.**

- `faq.test.ts`: the JSON-LD equals the rendered questions and answers; the schools answer for
  n = 0 and n > 0.
- `sections.test.tsx` (jsdom):
  - the wont-do fallback without verified rows;
  - `Y` only toggles with focus inside the toy;
  - missing captures are left out;
  - the pricing numbers come from `_data/pricing.ts`.

**Budget.** At most 2 KB added to `/` first load in total (the screens buttons and FAQ tracking).
The toy island loads only near the section.

**Done when** the four gates pass, all sections look right at 390–1440 px in Night and Day with
reduced motion on and off, and the captures are committed (or the missing ones are reported).

### 9.4 Package D: `/pricing` and `/how-it-works`

**Read first.** Direction §2, §5, §6, §9 (metadata, Product JSON-LD) and §10. This plan's §0 (F2,
F10), §3.3, §3.4, §3.7 and §3.8. Code: `packages/ui/src/strategy/kit-preview.tsx`,
`packages/ui/src/workspace/streaming-text.tsx`, `packages/ui/src/kit/{kit-assembly,kit-stage-list,types}`,
`apps/web/app/prototype/kit/{script.ts,kit-prototype.tsx}`,
`(marketing)/_data/{pricing,sample,screens}.ts`, `_ui/*` (`AiPolicyTable`, `JsonLd`, `deferred`)
and `apps/web/lib/marketing/public-data.ts`.

**Owns.** `apps/web/app/(marketing)/pricing/**`, `apps/web/app/(marketing)/how-it-works/**`,
`apps/web/app/(marketing)/_copy/pricing-page.ts` and `apps/web/app/(marketing)/_copy/how-it-works.ts`.

**Build.**

1. **`pricing/page.tsx`.**
   - `pageMetadata({ title: "Pricing", description, path: "/pricing" })`.
   - **Hero.** "$100 per school." at display-xl (two lines at 64 px on phones), then the
     Newsreader 21 line.
   - **The kit that opens.** The real `PositioningBlock`, `FileMapList` and `LockedDeliverables`
     from `@admitstory/ui`, with a fictional school's fixture in `pricing/_data.ts`. Mark it with
     the fictional note.
   - **The switch.** "Show what unlocks" lives in a `deferred(..., "visible")` island
     (`pricing/_unlock.tsx`). Turning it on lifts each lock (opacity plus a 4 px rise, 60 ms
     apart, on snap). Each row's ruled lines are replaced by the first two sentences of its
     fixture draft, streamed with `StreamingText` (180 ms fade-up, space reserved), with the
     applicant's own sentences in `--voice-glow`. Turning it off reverses. Reduced motion means an
     instant swap. Track `pricing_unlock_toggle`.
   - **Below, no motion:**
     - **Ledger.** A semantic `<table>` with a caption, rows grouped by stage with `<tbody>` and
       `<th scope="rowgroup">`, the feature (UI 15) and description (UI 13), and "Included" or
       "—" in words. On phones, stacked rows with "Free" or "Per school" in words.
     - **Expert mocks** plane.
     - **Refunds and tax.** `REFUND_RULE` verbatim, the Paddle sentence, and "No subscription…".
     - **What we won't charge for.**
     - **Pricing questions** (`<details>`).
   - **Product JSON-LD** with two Offers: 0 USD, and 100 USD "per school". Use the prices from
     `_data/pricing.ts`.
   - **No Paddle on this page.** The CTA is "Start free", with `data-track` `cta_start_free` and
     location "pricing-page".
2. **`how-it-works/page.tsx`.**
   - `pageMetadata({ title: "How it works", ... })`.
   - **Hero.** "From one conversation to every school." at display-xl.
   - **The assembly.** The real `KitAssembly` with fixture data copied from
     `prototype/kit/script.ts` into `how-it-works/_data.ts`. First paint is the server-rendered
     finished state (threads drawn, lines present), through a `deferred(..., "visible")` island
     at ≥ 1024 px only. It plays once when 40% in view, then shows a "Play again" text button.
   - **Below 1024 px.** No threads and no island: the stages first, then the deliverables as a
     list with story names, as server markup using the same fixture.
   - **Reduced motion and tier 1.** The threads appear in place, opacity only, with a still form.
   - **Eight steps.** Rows with the step number at `--type-display` in tabular numerals in the
     margin, a display-sm heading, 2–3 sentences in UI 17, and "Free", "In your kit" or the time,
     right-aligned. Show a capture from `_data/screens.ts` only where `screenAvailable(id)` and it
     helps. On phones the capture goes under the text.
   - **`#ai-policies`.** `AiPolicyTable` `variant="full"` from `verifiedPolicies()`. With no
     verified rows, keep the `id` and show only "Each school's policy is shown in the app with the
     date we checked it."
   - **Close.** The integrity list from `_copy/shared.ts`, compact in UI 17, then "Start free".
3. **Copy** goes in `_copy/pricing-page.ts` and `_copy/how-it-works.ts`, verbatim from the
   direction where it gives text.

**Tests.**

- `pricing/pricing.test.ts`: the Product JSON-LD offers 0 and 100 USD; every ledger row says
  "Included" or "—"; the unlock toggle reducer (on, off, interrupt).
- `how-it-works/how-it-works.test.ts`: eight steps in order with their right-column values; no
  policy table without verified rows.

**Budget.** Both routes ≤ 155 KB first load. The islands load near the viewport only.

**Done when** the four gates pass, both pages look right at 390–1440 px in Night and Day with
reduced motion on and off, and the assembly plays once and replays.

### 9.5 Package E: `/privacy`, `/terms`, the OG image and the line hand-off

**Read first.** Direction §2, §4.2 "Keeping the line", §7, §8 and §9 (metadata, OG). This plan's
§0 (F12), §3.2, §3.3, §3.8, §5 and §7 D2. Spec §13, §14.3, §14.4 and §14.7. Code:
`apps/web/app/sign-in/{page,sign-in-form}.tsx`, `apps/web/lib/sign-in-copy.ts` (+ test),
`apps/web/app/first-run/{page,first-run-flow,actions}`, `packages/db/src/repos/sources.ts`
(`createSource`), `apps/web/lib/studio/turn.ts` (`expressOpener`),
`packages/ui/src/shell/shared-element.tsx`, `packages/ui/src/voiceprint/voiceprint-still.tsx` and
`packages/ui/src/theme-preference.ts` (`THEME_COLORS`).

**Owns.** `apps/web/app/(marketing)/privacy/**`, `apps/web/app/(marketing)/terms/**`,
`apps/web/app/(marketing)/_legal/**`, `apps/web/app/(marketing)/opengraph-image.tsx`,
`apps/web/app/(marketing)/_copy/{privacy,terms,keep-line}.ts`, `apps/web/app/sign-in/**`,
`apps/web/lib/sign-in-copy.ts` and `apps/web/lib/sign-in-copy.test.ts`,
`apps/web/app/first-run/**`, `apps/web/lib/studio/turn.ts` and
`apps/web/lib/studio/homepage-line*.ts`.

**Build.**

1. **`_legal/legal-layout.tsx`.**
   - The heading at `--type-display` ("Privacy." or "Terms."), and "Last updated {date}" in UI 13
     from a constant in the copy file.
   - Each section is an `<h2 id>` with two columns on desktop: the plain summary in Newsreader
     19/32 on the left (columns 1–5), the full text in UI 15/22 on the right (columns 6–12).
   - A sticky contents list in the left margin from 1280 px (UI 13). On phones, a `<details>`
     contents list at the top, with the summary above each section's text.
   - Follows the page theme.
   - While `LEGAL_DRAFT` is true (a constant), show a quiet note: "This page is a draft under
     legal review."
2. **`privacy/page.tsx`.**
   - `pageMetadata({ title: "Privacy", ... })`.
   - **The voice-path diagram** (`_legal/voice-path-diagram.tsx`):
     - Inline SVG, about 280 px tall on desktop, `--edge` lines, UI 13 labels:
       Microphone → Speech-to-text (Deepgram) → Text → Your Dossier (encrypted) → Your drafts.
     - A branch to "Audio" ending in a small closed mark labelled "Discarded".
     - One `--voice` dot travels the path once (CSS `offset-path`, drift) when the diagram is 40%
       in view, triggered by a ≤ 0.5 KB client observer that adds a class. It reaches "Discarded"
       on the audio branch and fades, while a second dot continues to "Your drafts". Reduced
       motion means static.
     - A screen-reader paragraph says the same in words.
   - **The 12 sections** from direction §7, each with its plain summary. Processors are named with
     their purpose and region. Mark unknown values as `TODO(Manu)` constants, never invented.
     Contact is `{privacy email}` from the constants.
   - Facts come from spec §14.3–14.4: AES-256-GCM, 24 h exports, 30 and 35 days, GDPR and DPDP,
     18+.
3. **`terms/page.tsx`.**
   - `pageMetadata({ title: "Terms", ... })`.
   - The 10 sections from direction §8.
   - Payments uses `KIT_PRICE` and `REFUND_RULE` verbatim from `_data/pricing.ts` and
     `_copy/shared.ts`.
   - Expert sessions: 45 minutes, priced per expert, free to reschedule or cancel up to 24 h
     before, no-shows charged.
   - Counsel placeholders for section 10.
4. **`opengraph-image.tsx`.**
   - `next/og` `ImageResponse`, 1200 × 630, with `alt`, `size` and `contentType` exports. Static:
     no request APIs.
   - Night background `THEME_COLORS.night`.
   - On the left: "Say one thing about yourself." in Geist 600, loaded from
     `geist/dist/fonts/geist-sans/Geist-SemiBold.ttf` with `fs`.
   - On the right: the `VoiceprintStill` of `SAMPLE_IDENTITY`, rendered with
     `renderToStaticMarkup`, `currentColor` replaced by the identity's hue hex, and embedded as an
     `<img src="data:image/svg+xml,...">`. Satori's SVG support is limited, so check that it
     renders.
   - All five pages inherit it.
5. **The line hand-off: implement this plan's §5 steps 2–4 exactly.**
   - **Sign-in.** `?from=line` mode, the "Keep your first line" heading, and a reserved two-line
     slot holding `KeptLine`. `KeptLine` reads `readFirstLine()` through `useSyncExternalStore`
     and wraps the line in `<SharedElement name={FIRST_LINE_TRANSITION}>` with `--voice-glow`.
     With empty or blocked storage it falls back to the normal headline in the same box. The form
     is otherwise unchanged.
   - **First run.** On the "time" step, the checkbox "Start Story Studio with the line you said on
     our homepage" (on by default; shown only if a line exists, with the line quoted). Add
     `firstLine` (optional, 1–200 characters) to the `completeFirstRun` input. The server creates
     a `conversation_note` source with `meta.origin = "homepage_line"`. Clear storage on success,
     or immediately if the box is unchecked.
   - **Studio.** `homepage-line.ts` holds the pure `homepageOpener(...)`. `turn.ts` calls it next
     to `expressOpener`: on the first session with no turns, the opener question quotes the line,
     using the copy in `_copy/keep-line.ts`. If that needs a migration or a model change, stop at
     the source and report why.
   - **Other sessions.** Nothing changes. Keep every existing sign-in, first-run and Studio test
     green.
6. **Copy** goes in `_copy/privacy.ts`, `_copy/terms.ts` and `_copy/keep-line.ts`.

**Tests.**

- `_legal/legal.test.ts`: unique section anchors, and the contents match the sections; terms
  includes `REFUND_RULE` verbatim.
- `first-run/first-line-seed.test.ts` (db mocked): one `conversation_note` source created with
  `firstLine`, and none without it.
- `lib/studio/homepage-line.test.ts`: the opener fires only on a first session with no turns.
- `sign-in/keep-line.test.ts`: `from=line` parsing, and the fallback when storage is empty.

**Done when** the four gates pass, `/privacy` and `/terms` look right at 390–1440 px in Night and
Day, the OG image renders (`curl http://localhost:3100/opengraph-image`), and landing →
`/sign-in?from=line` shows the kept line (simulate it by setting the storage key in the browser
console).

---

## 10. INTEGRATE (run last)

1. Read every package report and act on any "Requests" (Foundation-owned files).
2. Run all gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
   `pnpm --filter @admitstory/web bundle:check` (marketing ≤ 155 KB, app routes ≤ 160 KB).
3. `next start --port 3100`, then `pnpm lighthouse --marketing`: performance ≥ 90 and
   accessibility, best practices and SEO = 100 on all five pages. Fix or report. Check CLS < 0.02
   and that the LCP element is the H1 (the Lighthouse JSON `largest-contentful-paint-element`).
   Stop the server.
4. A manual pass at 390 and 1440, Night and Day, reduced motion, and tier 1 (`?tier=1` if B and A
   expose a forced tier in development only).
5. Write `docs/phase-9a.md` (ACs, deviations D1–D11, what Manu provides, the screen recordings
   still to make). Produce `marketing.patch` (`git diff` plus new files against `phase-0`) in the
   worktree. Don't commit.

---

## 11. What Manu provides (unchanged from the direction §11, with plan specifics)

1. The domain, which becomes `SITE_URL` (metadataBase, canonical URLs, sitemap, OG).
2. Deepgram and Turnstile keys. Until then: dev uses the fake STT server, and production shows
   "Speaking is paused…", plus "Play a sample" (silent, captioned) and "Write instead". With the
   key: run `pnpm --filter @admitstory/web marketing:sample` once to generate the voiced sample.
3. The legal entity, address, and hello and privacy emails (constants in `_copy/chrome.ts`,
   `_copy/privacy.ts` and `_copy/terms.ts`, marked `TODO(Manu)`), and counsel's review.
4. Pack and AI-policy verification (the FAQ list and policy tables appear only once verified).
5. Sign-off from screen recordings (§6.13) at tiers 3, 2 and 1 and with reduced motion.
6. Decisions on D1 (the ToastProvider lever) and D2 (localStorage for 24 h).

---

## Foundation notes

_(Foundation fills this in: measured first-load floor per marketing route, the deferred-island
proof result and pattern, anything a package must know.)_
