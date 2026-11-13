// Server-safe. Preloads the reading serif on the routes that are for reading (SPEC §8.1): the
// essay editor, the recommender portal, the legal pages and the Profile Read.
//
// The root layout declares Source Serif 4 without preload, so --font-reading works everywhere
// and other routes pay nothing for it. next/font preloads a face on the routes whose layout or
// page uses the call, and names a preloaded file differently from a lazy one, so this second
// declaration has to be the one the text resolves to: the wrapper below re-points
// --font-source-serif at it for everything inside. `display: contents` keeps the wrapper out of
// the layout.

import { Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

const sourceSerifPreloaded = Source_Serif_4({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-source-serif",
});

export function ReadingFonts({ children }: { children: ReactNode }) {
  return <div className={`${sourceSerifPreloaded.variable} contents`}>{children}</div>;
}
