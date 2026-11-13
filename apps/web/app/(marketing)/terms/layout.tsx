import type { ReactNode } from "react";
import { ReadingFonts } from "@/components/reading-fonts";

// A reading route: the long-form serif is preloaded here (SPEC §8.1).
export default function ReadingLayout({ children }: { children: ReactNode }) {
  return <ReadingFonts>{children}</ReadingFonts>;
}
