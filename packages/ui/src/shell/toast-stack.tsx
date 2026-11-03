"use client";

// The visible half of the toast system (Radix Toast). Only components/toast.tsx imports it,
// lazily, so it stays out of every route's first load.
//
// Toasts slide from the dock (spec §6.8): from 640px they sit at the bottom left, beside the side
// dock when there is one, and glide in from its side; below 640px they rise from the bottom dock.
// With reduced motion they only fade (120 ms). A swipe towards the dock dismisses one.

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
  "flex items-start gap-3 plane p-4 text-text shadow-overlay",
  "transition-[opacity,translate] duration-(--spring-glide-duration) ease-glide",
  "starting:translate-y-4 starting:opacity-0 sm:starting:-translate-x-4 sm:starting:translate-y-0",
  "motion-reduce:starting:translate-x-0 motion-reduce:starting:translate-y-0",
  "data-[state=closed]:animate-fade-out",
  "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none",
  "data-[swipe=cancel]:translate-x-0",
);

// Above the bottom dock on phones (when the signed-in shell is on the page); beside the side dock
// from 640px.
const VIEWPORT = cx(
  "fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 outline-none",
  "[body:has([data-slot=dock])_&]:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]",
  "sm:right-auto sm:bottom-3 sm:left-3 sm:w-96",
  "sm:[body:has([data-slot=dock])_&]:bottom-3 sm:[body:has([data-slot=dock])_&]:left-22",
);

export function ToastStack({ toasts, duration, onClose, onRemove }: ToastStackProps) {
  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection="left" label="Notification">
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
          className={TOAST}
        >
          <div className="flex flex-1 flex-col gap-1">
            <ToastPrimitive.Title className="font-medium">{t.title}</ToastPrimitive.Title>
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
            <XIcon size={20} aria-hidden />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className={VIEWPORT} />
    </ToastPrimitive.Provider>
  );
}
