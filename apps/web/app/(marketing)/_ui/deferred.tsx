"use client";

// Deferred hydration (plan §3.4, deviation D10): a real packages/ui component, server-rendered in
// full, whose JavaScript loads only when it is needed, or never.
//
//   "use client";
//   import { deferred } from "../_ui/deferred";
//   export const StoryFrameIsland = deferred(() => import("./frames/story-frame"), "never");
//
// How it works. On the server the lazy target resolves straight away, so its HTML is in the
// response. During hydration the same lazy component waits on a gate (visible, idle, the first
// interaction, or never). React keeps the server HTML of a Suspense boundary that suspends while
// hydrating, and hydrates it when the code arrives. So the page looks finished at once, the chunk
// isn't in first-load JS, and a "never" island's chunk is never requested.
//
// Rules for islands (see "Foundation notes" in docs/plans/marketing-plan.md):
// - The lazy target is an app-local "use client" module with a default export that statically
//   imports what it needs from @admitstory/ui. Never import("@admitstory/ui") (the barrel isn't
//   tree-shaken through a dynamic import).
// - Props must be serialisable (they cross from a server component) and must not change before the
//   island hydrates: an update to a still-dehydrated boundary makes React drop the server HTML.
// - After a client-side navigation (no server HTML to keep) the island loads at once instead.
// - One gate per island type: if a page renders the same island twice, the first to open the gate
//   loads both.

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";

export type DeferredWhen = "never" | "visible" | "idle" | "interaction";

export interface DeferredProps {
  /** IntersectionObserver rootMargin for "visible" (default: one viewport ahead). */
  margin?: string;
  /** Class for the island's wrapper div (it is a plain block by default). */
  islandClassName?: string;
}

const subscribeNothing = () => () => {};
const clientSnapshot = () => false;
const serverSnapshot = () => true;

interface Gate {
  promise: Promise<void>;
  open: () => void;
  opened: boolean;
}

function createGate(): Gate {
  let open = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  const gate: Gate = {
    promise,
    opened: false,
    open: () => {
      if (gate.opened) return;
      gate.opened = true;
      open();
    },
  };
  return gate;
}

function onIdle(callback: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => !cancelled && callback(), { timeout: 4000 });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(() => !cancelled && callback(), 1500);
      cancel = () => window.clearTimeout(id);
    }
  };
  let cancel = () => {};
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    cancel();
  };
}

/**
 * A thenable that calls back synchronously: React's lazy() then resolves within the same render
 * (no suspension), which a resolved Promise can't do (its callbacks always run later).
 */
function resolvedThenable<T>(value: T): Promise<T> {
  const thenable = {
    then(onFulfilled?: (value: T) => unknown) {
      onFulfilled?.(value);
      return thenable;
    },
  };
  return thenable as unknown as Promise<T>;
}

const INTERACTION_EVENTS = ["pointerover", "pointerdown", "focusin", "touchstart"] as const;

export function deferred<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  when: DeferredWhen,
): ComponentType<P & DeferredProps> {
  const gate = createGate();
  // Server: start loading as soon as the island module is evaluated, and once the target is in
  // memory hand it to React synchronously, so the HTML renders in place instead of as a streamed
  // <template> swap (which needs JS to reveal).
  let serverModule: { default: ComponentType<P> } | null = null;
  const serverLoad =
    typeof window === "undefined"
      ? load().then((module) => {
          serverModule = module;
          return module;
        })
      : null;
  // Hydration: wait for the gate.
  const Gated = lazy(() => {
    if (typeof window !== "undefined") return gate.promise.then(load);
    if (serverModule) return resolvedThenable(serverModule);
    return serverLoad ?? load();
  }) as unknown as ComponentType<P>;
  // A client-side navigation has no server HTML to keep: load at once.
  const Immediate = lazy(load) as unknown as ComponentType<P>;

  function Island(props: P & DeferredProps) {
    const { margin = "100% 0px", islandClassName } = props;
    const ref = useRef<HTMLDivElement>(null);
    // True while hydrating server HTML, false on a fresh client render (a client navigation).
    const hydrating = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
    // Decided once, on the first render, and never changed.
    const [mode] = useState<"gated" | "immediate">(() => (hydrating ? "gated" : "immediate"));

    // The boundary element is memoised on the props object, so the re-render React makes after
    // hydration (the snapshot above changes) hands the still-dehydrated boundary the very same
    // element and React bails out, keeping the server HTML. A new element would count as an update
    // and make React drop the server HTML for a client render.
    const boundary = useMemo(() => {
      const { margin: _margin, islandClassName: _className, ...rest } = props;
      const Target = mode === "gated" ? Gated : Immediate;
      return (
        <Suspense fallback={null}>
          <Target {...(rest as P)} />
        </Suspense>
      );
    }, [props, mode]);

    // The safety net. The server HTML can be streamed after the shell and revealed by React's
    // inline script; if that reveal never happens, or React drops the server HTML, the island
    // would stay empty for good (a "never" gate never opens). Once the page has loaded, an island
    // with nothing rendered loads its code and renders on the client instead.
    useEffect(() => {
      if (mode === "immediate") return;
      let frame = 0;
      const check = () => {
        frame = requestAnimationFrame(() => {
          const node = ref.current;
          if (node && !node.querySelector(":scope > :not(template)")) gate.open();
        });
      };
      if (document.readyState === "complete") check();
      else window.addEventListener("load", check, { once: true });
      return () => {
        window.removeEventListener("load", check);
        cancelAnimationFrame(frame);
      };
    }, [mode]);

    useEffect(() => {
      if (mode === "immediate" || gate.opened || when === "never") return;
      const node = ref.current;
      if (!node) return;

      if (when === "idle") return onIdle(gate.open);

      if (when === "interaction") {
        const open = () => gate.open();
        for (const type of INTERACTION_EVENTS) {
          node.addEventListener(type, open, { once: true, passive: true });
        }
        return () => {
          for (const type of INTERACTION_EVENTS) node.removeEventListener(type, open);
        };
      }

      // "visible"
      if (typeof IntersectionObserver === "undefined") {
        gate.open();
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            gate.open();
          }
        },
        { rootMargin: margin },
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [margin, mode]);

    return (
      <div ref={ref} data-island={when} className={islandClassName}>
        {boundary}
      </div>
    );
  }

  Island.displayName = "DeferredIsland";
  return Island;
}
