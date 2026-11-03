"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "../lib/cx";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cx(
        "flex w-full max-w-full gap-7 overflow-x-auto border-b border-edge [scrollbar-width:none]",
        className,
      )}
      {...rest}
    />
  );
}

// Editorial tabs on a hairline: the selected tab is underlined in ink and set heavier, so
// selection is not colour alone.
export function TabsTrigger({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cx(
        "relative -mb-px min-h-11 shrink-0 border-b-2 border-transparent px-0.5 font-medium text-text-soft hover:text-text",
        "transition-[color,border-color] duration-(--spring-snap-duration) ease-snap",
        "data-[state=active]:border-text data-[state=active]:text-text",
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
