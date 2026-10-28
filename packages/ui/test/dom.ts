// Shared setup for jsdom component tests. Import it first in any "@vitest-environment jsdom" file.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  document.cookie = "theme=; Max-Age=0; Path=/";
  document.documentElement.removeAttribute("data-theme");
});

// jsdom lacks these browser APIs, which Radix and cmdk call.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
