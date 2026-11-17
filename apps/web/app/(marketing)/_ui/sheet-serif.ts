// The reading serif for sheets of paper on the landing page. The hero's sheets are on screen at
// first paint, so "/" preloads this roman (19.7 KB; the root layout declares the face lazily,
// SPEC §8.1), and every other sheet on the page uses the same file through this one declaration.
// Roman only: italic lines on a sheet use the root's lazy face (`font-reading italic`).

import { Source_Serif_4 } from "next/font/google";

export const sheetSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "400",
  style: "normal",
  display: "swap",
});
