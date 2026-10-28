"use client";

import { XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../lib/cx";
import { OVERLAY_CLASSES } from "./dialog";
import { IconButton } from "./icon-button";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export interface DrawerContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  "title"
> {
  title: ReactNode;
  description?: ReactNode;
}

/**
 * Slide-over panel from the right (the Coach below 1280px, evidence drawers; spec §6.4).
 * Sliding is responsive motion (spec §6.6); reduced-motion users get an instant panel
 * via the global rule in theme.css.
 */
export function DrawerContent({
  title,
  description,
  className,
  children,
  ...rest
}: DrawerContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
      <DialogPrimitive.Content
        className={cx(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-paper text-graphite shadow-overlay sm:w-[380px]",
          "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out focus:outline-none",
          className,
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-bold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-slate">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton icon={XIcon} aria-label="Close" className="-mr-2" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
