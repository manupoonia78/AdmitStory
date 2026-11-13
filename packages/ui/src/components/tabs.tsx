"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { useRef, type ComponentProps } from "react";
import { cx } from "../lib/cx";
import { SLIDING_RULE, useSlidingIndicator } from "../lib/sliding-indicator";

export const Tabs = TabsPrimitive.Root;

/**
 * Text tabs on a hairline (SPEC §2.9). One 1.25px rule sits under the selected tab and slides
 * between tabs on the glide spring; before it has been measured, the selected tab carries its
 * own underline, so selection is never colour alone.
 */
export function TabsList({ className, ...rest }: ComponentProps<typeof TabsPrimitive.List>) {
  const list = useRef<HTMLDivElement>(null);
  useSlidingIndicator(list, '[data-state="active"]');
  return (
    <TabsPrimitive.List
      ref={list}
      className={cx(
        "group/tabs flex w-full max-w-full gap-7 overflow-x-auto border-b border-edge [scrollbar-width:none]",
        SLIDING_RULE,
        className,
      )}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cx(
        "relative min-h-11 shrink-0 border-b-[1.25px] border-transparent px-0.5 text-ui text-text-soft hover:text-text",
        "transition-colors duration-(--dur-hover) ease-rise",
        "data-[state=active]:border-text data-[state=active]:text-text group-data-ind/tabs:data-[state=active]:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cx("pt-6", className)} {...rest} />;
}
