import { APP_NAME } from "@admitstory/shared";
import { THEME_COOKIE, parseThemePreference, themeAttribute, themeColors } from "@admitstory/ui";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

// Three faces, one job each (paper redesign): Hanken Grotesk for the interface, Newsreader for
// display lines and reading, JetBrains Mono for eyebrows, figures and metadata. All variable.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

// Every page title is set in it, so it is preloaded. Optical-size axis, roman and italic.
const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
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
      className={`${hanken.variable} ${newsreader.variable} ${jetbrains.variable}`}
      // ThemeToggle updates data-theme on the client without a reload.
      suppressHydrationWarning
    >
      {/* No ToastProvider here: it sits in the layouts that toast ((app), the recommender
          portal), so public pages don't carry its ~4 KB (marketing plan D1). */}
      <body>{children}</body>
    </html>
  );
}
