import { APP_NAME } from "@admitstory/shared";
import {
  THEME_COOKIE,
  ToastProvider,
  parseThemePreference,
  themeAttribute,
  themeColors,
} from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

// Interface and display face (spec §6.4): Geist, one variable file (100–900) from the `geist`
// package. GeistSans sets --font-geist-sans, which tokens.css reads into --font-ui.

// Reading face: a variable font with the optical-size axis (400 and 500 are used), roman and
// italic. Not preloaded: the shell has no reading text yet, so it loads only where it is used.
const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
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
    colorScheme: "light dark",
    themeColor: themeColors(await themePreference()),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The theme cookie is rendered on the server, so the first paint is already in the right theme.
  const theme = await themePreference();
  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${GeistSans.variable} ${newsreader.variable}`}
      // ThemeToggle updates data-theme on the client without a reload.
      suppressHydrationWarning
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
