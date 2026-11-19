import type { Viewport } from "next";
import type { ReactNode } from "react";
import { ReadingFonts } from "@/components/reading-fonts";
import "./portal.css";

// A reading route: the long-form serif is preloaded here (SPEC §8.1). The portal is always paper
// (SPEC §6.14), so the browser chrome is the desk's colour in both schemes, not the casing's.
export const viewport: Viewport = { themeColor: "#ECE9E2" };

export default function ReadingLayout({ children }: { children: ReactNode }) {
  return <ReadingFonts>{children}</ReadingFonts>;
}
