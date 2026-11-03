// Test-only helper (not exported from the barrel). jsdom has no matchMedia, and Motion reads
// "(prefers-reduced-motion)" once, the first time useReducedMotion() runs in a test file. Call
// stubReducedMotion() at the top of a jsdom test file, before anything renders.

/** Makes every prefers-reduced-motion query match `reduce`; other queries never match. */
export function stubReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion") && !query.includes("no-preference"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
