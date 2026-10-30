# Phase 0.5: Look and feel prototype

Built 29–30 October 2026 on branch `phase-0`. Spec: `AdmitStory_Build_Spec.md`, §16 Phase 0.5,
against the revised §6 design system (Night/Day, Geist, the dock, `motion.ts`, the Voiceprint).

Phase 0 was built on the earlier §6 (paper/ink, Schibsted Grotesk, a left rail). The spec was
revised after Phase 0 shipped, so this phase replaced the design system underneath the existing
app rather than adding to it: `tokens.css`, the shell and every base component were rewritten to
the new tokens, and the app's screens came along unchanged in structure.

## Acceptance criteria

| Criterion (spec §16)                                              | Status      | How it is checked                                                                                                                                                                 |
| ----------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manu signs off on all four prototypes from screen recordings      | **Waiting** | The six `/prototype` routes run on fake data and are ready to record. This is the one criterion only you can close.                                                                |
| 60 fps on a mid-range Android at tier 2, 120 fps on a MacBook at tier 3 | **Waiting** | Needs the real devices. `?hud=1` on any prototype shows live frame rate, frame time and tier; `lib/frame-monitor.ts` demotes tier 3 → 2 on sustained slow frames, which is unit-tested. |
| Reduced-motion versions are reviewed too                          | Met in code | Every prototype has a reduced-motion e2e test asserting the still form: `prototype-studio` ("the story simply appears"), `prototype-kit` ("threads fade in place"), `prototype-workspace`, `prototype-duet`, `prototype-transitions` (120 ms fade). |

Last full local run (30 Oct): format, lint and typecheck clean; 1020 unit tests and 16 integration
tests passed (the integration tests against the Neon dev branch). The e2e suite has not been re-run
since Phase 0; it runs once at the end of Phase 1.

## What was built

**`packages/ui/src/motion.ts` (§6.6).** The four springs — `snap`, `glide`, `drift`, `settle` — as
the only motion vocabulary in the product. `spring(token)` for Motion, `useMotionToken(token)`
which returns a 120 ms opacity fade under `prefers-reduced-motion`, and `cssSpring(token)`, which
simulates the spring at 2 kHz and emits a CSS `linear()` easing plus a settle duration so CSS
transitions match the Motion springs exactly. `motion.test.ts` keeps the generated easings in
`tokens.css` in step with the numbers.

**Night and Day (§6.3).** `tokens.css` rewritten to the §6.3 palette: `--space`, `--depth`,
`--veil`, `--edge`, `--text`, `--text-soft`, `--signal`, `--voice`, `--record`, `--verified`,
`--needs`, `--risk`. Night is the default for immersive screens through `<ImmersiveScope>`, which
sets `data-theme="night"` on its subtree, so a Day document sheet can sit inside a Night screen.
Film grain is a static SVG noise layer at 2% over Night backgrounds. `contrast.test.ts` asserts
every text pair in both themes and fails if the two copies of the Night palette drift.

**Typography (§6.4).** Geist (variable, from the `geist` package) for interface and display;
Newsreader (Google Fonts, optical sizes) for reading and the interviewer's voice. The UI /
reading / display scale, display headlines at −0.04em and 0.95 line-height.

**The dock and the shell (§6.5).** The slim floating left dock with labels on hover, collapsing to
a floating bottom dock on mobile; `app-shell-frame.tsx` as the plane layout; the command palette as
a centred plane; `Sheet`; `Toast` that slides from the dock and repeats its button's verb.
`route-transition.tsx` uses the View Transitions API with a Motion fallback, and
`shared-element.tsx` flies the same element between routes on `drift`. `magnetic.ts` is the 6 px
pointer pull on primary actions, `edge-light.tsx` the soft edge light planes catch under the cursor.

**The Voiceprint (§6.2, §6.11), `packages/ui/src/voiceprint/`.** Drawn with OGL, not R3F, because
bundle size matters more here (§6.11 allows either): three premultiplied layers — a soft spherical
volume, filaments as loops of points, and free particles — in `renderer.ts` and `shaders.ts`, loaded
only by dynamic import after mount so OGL never counts against a route's initial JS.
`audio-features.ts` computes amplitude, spectral centroid and pitch movement per frame from an
AudioWorklet; `identity.ts` derives the stored identity parameters (average pitch, pace, pitch range,
pause rhythm) from a three-minute sample and maps them to one of 12 tuned hues, filament count,
swirl speed and asymmetry. Writers get the same treatment: sentence-length rhythm stands in for pace
and pitch, so someone who never speaks still gets their own form. The loop pauses when the tab is
hidden or the element is off-screen, frees its GPU resources on dispose, and rebuilds after a lost
context. `voiceprint-still.tsx` is the SVG fallback — a slow CSS opacity pulse at tier 1, completely
still under reduced motion.

**Performance tiers (§6.11).** `tier.ts` decides 3 / 2 / 1 from reduced motion, Save-Data, battery
saver, WebGL availability and the `detect-gpu` class, and demotes on sustained slow frames.
`decideTier()` is a pure function with unit tests. GPU benchmark data is served from
`apps/web/public/detect-gpu/` rather than a third-party CDN, and `benchmarks.test.ts` fails if that
copy drifts from the installed package.

**Studio components (`packages/ui/src/studio/`).** Written for the prototype and meant to carry into
Phase 1 unchanged: `RecordButton` (idle / listening / processing / error, Space to talk),
`LiveTranscript` (interim words at 40% opacity settling to final, never jittering per character),
`SpokenQuestion` (Newsreader display text brightening word by word against TTS timings),
`StoryCard` (compact / expanded, with `layoutId` for flights), `StoryShelf` and
`StoryCaptureProvider` (the ignite-condense-fly choreography), `CoverageMeter`, `ChapterTabs`.

**Other screens' components.** `kit/` (the assembly stage, threads of light, gap-questions plane),
`workspace/` (your-words glow, diff morph, NEED chips, revision bar, version scrubber, sentence
provenance), `interview/` (the duet stage).

**Six prototype routes** under `/prototype`, on fake data for a fictional applicant, gated by
`prototypesEnabled()`: on in development, and in a production build only with
`PROTOTYPES_ENABLED=1`. The four signature moments the spec names — Story Studio speaking and the
story-capture flight, kit assembly, the Workspace your-words glow and diff morph, the live-mock duet
stage — plus a Voiceprint lab (live microphone, the three-minute identity sample, all 12 hues, every
tier forceable) and a route-transitions page proving shared-element flights between two pages.
`?hud=1` shows the frame HUD on any of them.

## How to run it

```sh
pnpm dev     # http://localhost:3000/prototype
```

Each prototype plays itself: there is a control to start or replay the moment, so a screen
recording needs no interaction beyond one click. For the recordings §6.13 asks for:

- Record at 1x with the browser at a normal window size, one prototype per clip.
- Add `?hud=1` to see frame rate, frame time and the chosen tier in the corner.
- `/prototype/voiceprint` can force any tier, so tier 1 and 2 can be recorded on a fast machine.
- For the reduced-motion pass, turn on "Reduce motion" in macOS System Settings → Accessibility →
  Display, or Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion".

To review on a phone, run `pnpm dev` and open the dev server's network address, or deploy with
`PROTOTYPES_ENABLED=1`.

## Deviations from the spec, and why

- **OGL instead of React Three Fiber** for the Voiceprint. §6.11 offers the choice and says to pick
  OGL if bundle size matters more; it does — the app route budget is 160 KB gzipped and OGL is a
  fraction of three.js. The shaders are hand-written GLSL either way.
- **Rive is not used.** §6.8 specifies the record button as a Rive state machine. It is built with
  Motion and CSS against the same four springs instead, because a Rive runtime (~100 KB) plus an
  `.riv` asset for one four-state button costs more than it returns, and the button has to react to
  live amplitude, which is a prop, not an animation. Revisit if more small state illustrations
  appear.
- **Toast lives in the shell** (`shell/toast-stack.tsx`) rather than as a free component, so it can
  slide from the dock as §6.8 asks.
- **GSAP, ScrollTrigger and Lenis are not installed.** They are marketing-route only (§6.11) and the
  marketing site is Phase 9.
- **No sound.** §6.6 makes UI sounds optional and off by default, so nothing was built. §10's
  `ui_sounds` profile column does not exist yet either; it arrives with the other §10 profile
  columns this phase needed and did not add — `voiceprint jsonb`, `voiceprint_hue` and `theme` —
  in Phase 1. The theme preference is a cookie today (`theme-preference.ts`), read by the root
  layout so the first paint never flashes; Phase 1 moves it onto the profile and keeps the cookie
  as the fast path.
- **The Voiceprint's identity parameters are not persisted.** The lab derives them and keeps them
  in browser storage for the other prototypes. Phase 1 computes the written-answer seed from real
  Studio turns and stores it on the profile.
- **The 12 Voiceprint hues** are an addition to the tokens: §6.3 names three examples and says they
  are pre-tuned for contrast against both themes, so `voice-hues.ts` holds all 12 with a Night and a
  Day variant each, asserted by the contrast test.

## Not done, or needs you

- **The two sign-off criteria above:** your review of the recordings, and frame rates measured on a
  real mid-range Android and a recent MacBook. Everything else in this phase is testable in CI and
  is green.
- **A reference board.** §6.13 asks you to collect 10–15 Awwwards / FWA references into
  `docs/design/references.md`, each with a note on what to take from it. The file does not exist
  yet; it is direction for later craft passes, not a blocker.

## Left for later phases

- The prototypes are fake data behind a flag. Phase 1 wires the Studio components to real Studio
  turns and the Dossier; the Workspace and kit components wait for Phase 4, the duet stage for
  Phase 7. The prototype routes stay as a reference until the real screens pass the §6.13 craft
  checklist, then they go.
- `Constellation`, `LensInstrument`, `HorizonTimeline`, `MatrixTable`, `OptionSplit`, `DocCanvas`
  (TipTap), `SessionTimeline` and `RubricBar` from §6.8 are not built. The Constellation lands in
  Phase 1 with the Dossier; the rest follow their screens.
