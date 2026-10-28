"use client";

import { XIcon } from "@phosphor-icons/react";
import { Toast as ToastPrimitive } from "radix-ui";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buttonStyles } from "./button-styles";

export interface ToastOptions {
  /**
   * Name the action that happened, repeating the button's verb (spec §6.7):
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

interface ToastEntry extends ToastOptions {
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

let nextId = 0;

export function ToastProvider({
  children,
  duration = 5000,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

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
      <ToastPrimitive.Provider duration={duration} swipeDirection="right" label="Notification">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            open={t.open}
            // Toasts with an action stay longer so there is time to reach the button.
            duration={t.action ? duration * 2 : duration}
            onOpenChange={(open) => {
              if (!open) close(t.id);
            }}
            onAnimationEnd={() => {
              if (!t.open) remove(t.id);
            }}
            className="flex items-start gap-3 rounded-panel border border-line bg-paper p-4 text-graphite shadow-overlay data-[state=closed]:animate-scrim-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)"
          >
            <div className="flex flex-1 flex-col gap-1">
              <ToastPrimitive.Title className="font-medium">{t.title}</ToastPrimitive.Title>
              {t.description ? (
                <ToastPrimitive.Description className="text-sm text-slate">
                  {t.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            {t.action ? (
              <ToastPrimitive.Action
                altText={t.action.altText}
                onClick={t.action.onAction}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                {t.action.label}
              </ToastPrimitive.Action>
            ) : null}
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className={buttonStyles({ variant: "quiet", size: "sm", shape: "icon" })}
            >
              <XIcon size={20} aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-20 right-4 left-4 z-50 flex flex-col gap-2 outline-none sm:bottom-4 sm:left-auto sm:w-96" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
