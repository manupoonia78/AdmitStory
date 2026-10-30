"use client";

import type { HTMLAttributes, Ref } from "react";
import { immersiveTheme, type ThemePreference } from "../theme-preference";
import { IMMERSIVE_ATTRIBUTE, useThemePreference } from "./theme-store";

export interface ImmersiveScopeProps extends HTMLAttributes<HTMLDivElement> {
  /** The theme cookie as read on the server, so the first paint is already in the right theme. */
  serverValue?: ThemePreference;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Wraps an immersive screen (Story Studio, kit generation, live mocks; spec §6.3). Its subtree is
 * Night unless the user explicitly chose Day, whatever the system is set to, and it paints its
 * own --space background with film grain (theme.css). While it is on the page, the browser chrome
 * colour follows it too.
 */
export function ImmersiveScope({ serverValue, ref, ...rest }: ImmersiveScopeProps) {
  const preference = useThemePreference(serverValue);
  const theme = immersiveTheme(preference);
  return (
    <div
      ref={ref}
      {...rest}
      {...{ [IMMERSIVE_ATTRIBUTE]: "" }}
      // Day adds nothing: the subtree simply inherits the page's Day palette.
      data-theme={theme === "night" ? "night" : undefined}
    />
  );
}
