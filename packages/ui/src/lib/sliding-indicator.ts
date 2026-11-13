"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Measures the selected item of a group and writes its offset and width onto the group as
 * `--ind-x` and `--ind-w` (plain numbers, in px), then sets `data-ind`. The group's styles draw one indicator from
 * those and slide it with a transform, so the tab rule and the segmented control's inner pill
 * travel between options instead of blinking from one to the next (SPEC §2.9).
 *
 * Until it has measured (first paint, no JS) there is no `data-ind`, and each option shows its
 * own static selected state. The group must be positioned (`relative`).
 */
export function useSlidingIndicator(
  group: RefObject<HTMLElement | null>,
  selectedSelector: string,
): void {
  useLayoutEffect(() => {
    const element = group.current;
    if (!element) return;

    const measure = () => {
      const selected = element.querySelector<HTMLElement>(selectedSelector);
      if (!selected) {
        element.removeAttribute("data-ind");
        return;
      }
      element.style.setProperty("--ind-x", String(selected.offsetLeft));
      element.style.setProperty("--ind-w", String(selected.offsetWidth));
      element.setAttribute("data-ind", "");
    };

    measure();
    const mutations = new MutationObserver(measure);
    mutations.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "aria-selected", "aria-checked", "aria-pressed"],
    });
    const resizes = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resizes?.observe(element);
    return () => {
      mutations.disconnect();
      resizes?.disconnect();
    };
  }, [group, selectedSelector]);
}

/**
 * Classes for the tab rule: a 1.25px line under the selected tab that slides on the glide
 * spring. Put on the positioned group; the transform is the only thing that animates.
 */
export const SLIDING_RULE =
  "relative data-ind:after:absolute data-ind:after:bottom-0 data-ind:after:left-0 data-ind:after:h-[1.25px] " +
  "data-ind:after:w-px data-ind:after:origin-left data-ind:after:bg-text " +
  "data-ind:after:translate-x-[calc(var(--ind-x)*1px)] data-ind:after:scale-x-(--ind-w) " +
  "data-ind:after:transition-[translate,scale] data-ind:after:duration-(--spring-glide-duration) data-ind:after:ease-glide";

/**
 * Classes for the segmented control's inner pill: one fill step that slides behind the selected
 * option. Put on the positioned group; give the options `relative` so they sit above it.
 */
export const SLIDING_PILL =
  "relative data-ind:before:absolute data-ind:before:inset-y-1 data-ind:before:left-0 data-ind:before:rounded-full " +
  "data-ind:before:w-[calc(var(--ind-w)*1px)] data-ind:before:translate-x-[calc(var(--ind-x)*1px)] data-ind:before:bg-frost-hover " +
  "data-ind:before:transition-[translate,width] data-ind:before:duration-(--spring-glide-duration) data-ind:before:ease-glide";
