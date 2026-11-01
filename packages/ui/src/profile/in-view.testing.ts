// Test-only helper (not exported from the barrel). jsdom has no IntersectionObserver: this one
// reports every observed element as fully in view as soon as it is observed.

export function stubInView(): void {
  class InView {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      const entry = {
        isIntersecting: true,
        intersectionRatio: 1,
        target,
      } as IntersectionObserverEntry;
      this.callback([entry], this as unknown as IntersectionObserver);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver = InView as unknown as typeof IntersectionObserver;
}
