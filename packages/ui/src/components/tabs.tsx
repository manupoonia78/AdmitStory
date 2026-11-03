"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "../lib/cx";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cx(
        "flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-edge p-1 glass-control [scrollbar-width:none]",
        className,
      )}
      {...rest}
    />
  );
}

// A segmented glass rail: the selected tab is lit glass (render.css `lit`) with signal text and a
// heavier weight, so selection is not colour alone.
export function TabsTrigger({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cx(
        "relative min-h-10 shrink-0 rounded-full px-4 font-medium text-text-soft hover:text-text",
        "transition-[color,background-color,box-shadow] duration-(--spring-snap-duration) ease-snap",
        "data-[state=active]:lit data-[state=active]:font-semibold data-[state=active]:text-signal",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cx("pt-6", className)} {...rest} />;
}
