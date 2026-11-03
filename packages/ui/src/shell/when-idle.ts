/**
 * Runs the callback when the browser is idle (or after 2 s where requestIdleCallback is missing,
 * as in Safari). Returns a cancel function. Used to load code that is not needed for first paint
 * but should be ready before it is wanted: the account menu, the toast stack.
 */
export function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 2000);
  return () => window.clearTimeout(id);
}
