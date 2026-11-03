"use client";

import type { HTMLAttributes, Ref } from "react";
import type { ThemePreference } from "../theme-preference";
import { IMMERSIVE_ATTRIBUTE } from "./theme-store";

export interface ImmersiveScopeProps extends HTMLAttributes<HTMLDivElement> {
  /** The theme cookie as read on the server, so the first paint is already in the right theme. */
  serverValue?: ThemePreference;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Wraps an immersive screen (Story Studio, kit generation, live mocks; spec §6.3). Since the paper
 * redesign it no longer forces Night: immersive screens sit on the same paper as the rest of the
 * app, in whatever theme the user chose, so the Studio never feels like a different product.
 */
export function ImmersiveScope({ serverValue: _serverValue, ref, ...rest }: ImmersiveScopeProps) {
  return <div ref={ref} {...rest} {...{ [IMMERSIVE_ATTRIBUTE]: "" }} />;
}
