"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "../lib/cx";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}
      {...rest}
    />
  );
}

// The selected tab gets an ink underline as well as ink text, so selection is not colour alone.
export function TabsTrigger({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cx(
        "relative min-h-11 shrink-0 rounded-t-control px-3 font-medium text-slate hover:text-graphite",
        "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
        "data-[state=active]:text-ink data-[state=active]:after:bg-ink",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cx("pt-4", className)} {...rest} />;
}
