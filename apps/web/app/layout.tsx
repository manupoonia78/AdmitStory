import { APP_NAME } from "@admitstory/shared";
import {
  MOTION_ATTRIBUTE_SCRIPT,
  THEME_COOKIE,
  parseThemePreference,
  themeAttribute,
  themeColors,
} from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Source_Serif_4 } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

// Four faces, one job each (SPEC §2.4, budget §8.1). All latin subsets with metric-matched
// fallbacks, so text never shifts when a face arrives.
//
// Geist: headlines and every piece of interface text. Variable, one 29 KB file.
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

// Instrument Serif: the one-to-three-word accent in a headline, the live transcript, the
// Voiceline's words. Italic only; the roman is never loaded, so it is never set upright.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--font-instrument-serif",
});

// Geist Mono: labels, margin notes, figures. Preloaded with the other two: a label sits on
// nearly every screen, and the three together are 68 KB where the old faces were 157 KB.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

// Source Serif 4: long-form reading on paper. Static 400 roman and italic at the family's
// default optical size (14, the text master). Declared here without preload so --font-reading
// resolves everywhere; the reading routes preload it themselves (components/reading-fonts.tsx).
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-source-serif",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Tell your story once and turn it into a school-by-school MBA application.",
  // App pages are private; the public marketing site (Phase 9) will opt back in per page.
  robots: { index: false, follow: false },
  applicationName: APP_NAME,
};

async function themePreference() {
  return parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
}

// The theme-color pair follows the theme cookie: "system" gives each media query its own theme's
// colour (Day or Night), a manual choice gives both the chosen one. ThemeToggle and the account menu update these
// tags on the client when the choice changes (applyThemeColor in @admitstory/ui).
export async function generateViewport(): Promise<Viewport> {
  return {
    width: "device-width",
    initialScale: 1,
    // Edge to edge (the mobile-native skill): fixed bars pad themselves with
    // env(safe-area-inset-*), which is 0 without this. The keyboard resizes the layout on Android.
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    colorScheme: "light dark",
    themeColor: themeColors(await themePreference()),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The theme cookie is rendered on the server, so the first paint is already in the right theme.
  const theme = await themePreference();
  // proxy.ts puts the request's CSP nonce in this header.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geist.variable} ${instrumentSerif.variable} ${geistMono.variable} ${sourceSerif.variable}`}
      // ThemeToggle updates data-theme on the client without a reload, and the script below sets
      // data-motion before first paint.
      suppressHydrationWarning
    >
      <head>
        {/* Entrances only get a hidden start state once this has run (SPEC §2.10). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: MOTION_ATTRIBUTE_SCRIPT }} />
      </head>
      {/* No ToastProvider here: it sits in the layouts that toast ((app), the recommender
          portal), so public pages don't carry its ~4 KB (marketing plan D1). */}
      <body>{children}</body>
    </html>
  );
}
