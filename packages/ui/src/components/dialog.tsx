"use client";

import { XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../lib/cx";
import { IconButton } from "./icon-button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const OVERLAY_CLASSES =
  "fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

export interface DialogContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  "title"
> {
  /** Every dialog has a visible title; it names the dialog for screen readers. */
  title: ReactNode;
  description?: ReactNode;
}

/**
 * A centred card for a short decision (rename, remove). It glides in from 98% scale on the glide
 * spring (opacity only with reduced motion).
 */
export function DialogContent({
  title,
  description,
  className,
  children,
  ref,
  ...rest
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
      <DialogPrimitive.Content
        ref={ref}
        className={cx(
          "fixed left-1/2 top-[12vh] z-50 flex max-h-[76vh] w-[min(calc(100%-2rem),32rem)] -translate-x-1/2 flex-col gap-4",
          "overflow-y-auto plane p-6 text-text shadow-overlay focus:outline-none",
          "transition-[opacity,scale] duration-(--spring-glide-duration) ease-glide starting:scale-[0.98] starting:opacity-0",
          "motion-reduce:starting:scale-100 data-[state=closed]:animate-fade-out",
          className,
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-title">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-text-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton icon={XIcon} aria-label="Close" className="-mr-2 -mt-2" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
