"use client";

import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { whenIdle } from "../shell/when-idle";

export interface ToastOptions {
  /**
   * Name the action that happened, repeating the button's verb (spec §6.9):
   * "Draft updated", "Saved to your Fact Sheet". No exclamation marks.
   */
  title: string;
  description?: string;
  action?: {
    label: string;
    /** How to do the same thing without the toast, for screen reader users. */
    altText: string;
    onAction: () => void;
  };
}

export interface ToastEntry extends ToastOptions {
  id: number;
  open: boolean;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>.");
  return value;
}

// The Radix toast stack is ~14 KB gz and the provider sits in the root layout, so it would weigh
// on every route's first load (spec §6.11). It loads when the page is idle instead, or at once
// if a toast is asked for before then; toasts queue here in the meantime.
const loadStack = () => import("../shell/toast-stack");
const ToastStack = lazy(() => loadStack().then((m) => ({ default: m.ToastStack })));

let nextId = 0;

export function ToastProvider({
  children,
  duration = 5000,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [idle, setIdle] = useState(false);

  useEffect(() => whenIdle(() => setIdle(true)), []);

  const toast = useCallback((options: ToastOptions) => {
    nextId += 1;
    const entry: ToastEntry = { ...options, id: nextId, open: true };
    // Closed toasts are dropped here too, in case their exit animation never ran.
    setToasts((current) => [...current.filter((t) => t.open), entry]);
  }, []);

  const close = useCallback((id: number) => {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {idle || toasts.length > 0 ? (
        <Suspense fallback={null}>
          <ToastStack toasts={toasts} duration={duration} onClose={close} onRemove={remove} />
        </Suspense>
      ) : null}
    </ToastContext.Provider>
  );
}
