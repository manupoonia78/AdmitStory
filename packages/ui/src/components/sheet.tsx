"use client";

import { XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo, type ComponentProps, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { EdgeLight, useEdgeLight } from "../lib/edge-light";
import { mergeRefs } from "../lib/magnetic";
import { OVERLAY_CLASSES } from "./dialog";
import { IconButton } from "./icon-button";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  "title"
> {
  /** Every sheet has a visible title; it names the sheet for screen readers. */
  title: ReactNode;
  description?: ReactNode;
}

/**
 * A sheet that glides over from the right (spec §6.5: the Coach below 1280px, evidence and story
 * detail). It is a full-height plane with the 28px sheet radius on its leading corners, 400px wide
 * from 640px and nearly full width below, leaving a sliver of the page in view. It moves on the
 * glide spring (spec §6.6); with reduced motion it fades instead (theme.css). Focus is trapped
 * inside while it is open and returns to the trigger on close.
 */
export function SheetContent({
  title,
  description,
  className,
  children,
  ref,
  ...rest
}: SheetContentProps) {
  const edgeLight = useEdgeLight<HTMLDivElement>();
  const contentRef = useMemo(() => mergeRefs(ref, edgeLight), [ref, edgeLight]);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
      <DialogPrimitive.Content
        ref={contentRef}
        className={cx(
          "fixed inset-y-0 left-4 right-0 z-50 flex flex-col rounded-l-sheet border border-r-0 border-edge bg-depth text-text shadow-overlay sm:left-auto sm:w-[400px]",
          "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out focus:outline-none",
          className,
        )}
        {...rest}
      >
        <EdgeLight />
        <div className="flex items-start justify-between gap-4 border-b border-edge py-4 pl-7 pr-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-text-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton icon={XIcon} aria-label="Close" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto py-4 pl-7 pr-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
