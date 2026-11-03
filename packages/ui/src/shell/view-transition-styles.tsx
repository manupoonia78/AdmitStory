// Server-safe: rendered by AppShell and by pages that use <SharedElement> outside the shell.
//
// The View Transitions choreography (spec §6.6: shared elements, not page swaps). React's
// <ViewTransition> names the parts that move and gives them a class; these rules say how each
// class moves, on the same spring curves as everything else (tokens.css --spring-*).
//   .route         app content when a dock link or the palette changes the route: the old view
//                  leaves in 120 ms, the new one rises 8px on glide while it fades in
//   .route-in/out  the same, for content that enters or leaves instead of updating in place
//   .flight        a shared element flying between two pages on drift (cards, titles)
//   .surface       a plain plane in a flight: its snapshot stretches to the box, so it never
//                  carries text (text flies as its own .flight element)
// React dedupes the <style> by href, so rendering it more than once is harmless.

export const VIEW_TRANSITION_CSS = `
::view-transition { pointer-events: none; }
::view-transition-old(root) { display: none; }
::view-transition-new(root) { animation: none; }
::view-transition-group(dock), ::view-transition-group(top-bar) { animation: none; z-index: 10; }
::view-transition-old(dock), ::view-transition-old(top-bar) { display: none; }
::view-transition-new(dock), ::view-transition-new(top-bar) { animation: none; }
::view-transition-group(.route) {
  animation-duration: var(--spring-glide-duration);
  animation-timing-function: var(--spring-glide);
}
::view-transition-old(.route), ::view-transition-old(.route-out) {
  animation: as-vt-fade-out 120ms linear both;
}
::view-transition-new(.route), ::view-transition-new(.route-in) {
  animation:
    as-vt-fade-in 120ms linear both,
    as-vt-rise var(--spring-glide-duration) var(--spring-glide) both;
}
::view-transition-group(.flight) {
  animation-duration: var(--spring-drift-duration);
  animation-timing-function: var(--spring-drift);
}
::view-transition-old(.surface), ::view-transition-new(.surface) { height: 100%; }
@keyframes as-vt-fade-in { from { opacity: 0; } }
@keyframes as-vt-fade-out { to { opacity: 0; } }
@keyframes as-vt-rise { from { translate: 0 0.5rem; } }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none !important; }
  ::view-transition-old(*) { animation: as-vt-fade-out 120ms linear both !important; }
  ::view-transition-new(*) { animation: as-vt-fade-in 120ms linear both !important; }
  ::view-transition-old(root), ::view-transition-old(dock), ::view-transition-old(top-bar) {
    display: none;
  }
  ::view-transition-new(root), ::view-transition-new(dock), ::view-transition-new(top-bar) {
    animation: none !important;
  }
}
`;

/** The view transition rules, hoisted into <head> once. */
export function ViewTransitionStyles() {
  return (
    <style href="admitstory-view-transitions" precedence="default">
      {VIEW_TRANSITION_CSS}
    </style>
  );
}
