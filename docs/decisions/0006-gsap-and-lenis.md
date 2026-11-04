# 0006 — GSAP and Lenis on the marketing site only

Status: accepted (Phase 9a, 2026-11-02)

The landing page's pinned "follow one sentence" sequence (marketing direction §4.3) uses
`gsap@3.15.0` (core, ScrollTrigger, SplitText) and desktop smooth scroll uses `lenis@1.3.27`.
Both are pinned exactly in `apps/web`.

**Licence check (2 November 2026).** GSAP's "Standard 'no charge' license"
(https://gsap.com/standard-license) was re-read on this date. Since the Webflow acquisition GSAP
and all of its plugins, ScrollTrigger and SplitText included, are free for commercial use. The one
restriction is on products that let their users build no-code visual animations in competition
with Webflow. AdmitStories is not such a tool, so the licence fits. Re-check the page whenever GSAP
is upgraded (spec §6.11). Lenis is MIT.

**Where they may be imported.** Only `apps/web/app/(marketing)/_follow/follow-sequence.ts`
imports `gsap`, `gsap/ScrollTrigger` and `gsap/SplitText`; only
`apps/web/app/(marketing)/_motion/smooth-scroll.ts` imports `lenis` (the core, not `lenis/react`).
Both load with `import()` on desktop with a fine pointer and no reduced motion, never in a route's
first load. `@gsap/react` is not installed: the sequence drives server-rendered DOM from a plain
module, and `gsap.matchMedia()` plus `revert()` covers StrictMode cleanup.
