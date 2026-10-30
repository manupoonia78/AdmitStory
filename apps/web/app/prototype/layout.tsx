import { THEME_COOKIE, parseThemePreference, themeColors } from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prototypesEnabled } from "./_shared/enabled";
import { PrototypeFrame } from "./_shared/prototype-frame";

// Phase 0.5 look and feel prototypes (spec §6.13, §16): standalone routes on fake data, for
// sign-off before feature work. Never indexed; off in production unless PROTOTYPES_ENABLED=1.

export const metadata: Metadata = {
  title: { default: "Prototypes", template: "%s | Prototypes" },
  robots: { index: false, follow: false },
};

async function themePreference() {
  return parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
}

// Prototypes are immersive screens, so the browser chrome is Night unless Day was chosen.
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColors(await themePreference(), { immersive: true }) };
}

export default async function PrototypeLayout({ children }: { children: ReactNode }) {
  if (!prototypesEnabled()) notFound();
  return <PrototypeFrame theme={await themePreference()}>{children}</PrototypeFrame>;
}
