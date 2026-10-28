"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cx } from "../lib/cx";

export interface TooltipProps {
  /** Supplementary text. Never the only name of a control: icon buttons still need aria-label. */
  content: ReactNode;
  /** A single focusable element. */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  className?: string;
}

/** Self-contained: carries its own provider so it works anywhere in the tree. */
export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration = 400,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cx(
              "z-50 max-w-64 rounded-control bg-graphite px-2 py-1 text-sm text-paper shadow-overlay",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
