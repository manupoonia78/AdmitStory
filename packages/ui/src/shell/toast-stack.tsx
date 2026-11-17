"use client";

// The visible half of the toast system (Radix Toast). Only components/toast.tsx imports it,
// lazily, so it stays out of every route's first load.
//
// Toasts (SPEC §6.1): frost, Night in both themes (part of the casing), bottom centre: centred
// on the bay from 1024px, above the floating dock below it. They rise 12px as they arrive (a
// transition from @starting-style, so a burst retargets) and fade out faster than they came. A
// swipe down dismisses one. With reduced motion they only fade.

import { XIcon } from "@phosphor-icons/react";
import { Toast as ToastPrimitive } from "radix-ui";
import { buttonStyles } from "../components/button-styles";
import type { ToastEntry } from "../components/toast";
import { cx } from "../lib/cx";

export interface ToastStackProps {
  toasts: readonly ToastEntry[];
  duration: number;
  onClose: (id: number) => void;
  onRemove: (id: number) => void;
}

const TOAST = cx(
  "casing-overlay flex min-h-13 w-full items-center gap-3 rounded-card py-3 pr-3 pl-5 text-text shadow-overlay",
  "transition-[opacity,translate] duration-250 ease-rise",
  "starting:translate-y-3 starting:opacity-0 motion-reduce:starting:translate-y-0",
  "data-[state=closed]:animate-[fade-out_150ms_linear_both]",
  "data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=move]:transition-none",
  "data-[swipe=cancel]:translate-y-0",
);

// Bottom centre; above the dock when the signed-in casing is on the page, on the bay from 1024px.
const VIEWPORT = cx(
  "fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] flex-col items-center gap-2 outline-none",
  "[body:has([data-slot=dock])_&]:bottom-[calc(80px+env(safe-area-inset-bottom))]",
  "lg:bottom-6 lg:[body:has([data-slot=dock])_&]:bottom-6 lg:[body:has([data-slot=dock])_&]:left-64",
);

export function ToastStack({ toasts, duration, onClose, onRemove }: ToastStackProps) {
  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection="down" label="Notification">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open={t.open}
          // Toasts with an action stay longer so there is time to reach the button.
          duration={t.action ? duration * 2 : duration}
          onOpenChange={(open) => {
            if (!open) onClose(t.id);
          }}
          onAnimationEnd={() => {
            if (!t.open) onRemove(t.id);
          }}
          data-theme="night"
          className={TOAST}
        >
          <div className="flex flex-1 flex-col gap-1">
            <ToastPrimitive.Title className="text-[14px] leading-5 font-medium">
              {t.title}
            </ToastPrimitive.Title>
            {t.description ? (
              <ToastPrimitive.Description className="text-sm text-text-soft">
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
            <XIcon size={16} aria-hidden />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className={VIEWPORT} />
    </ToastPrimitive.Provider>
  );
}
